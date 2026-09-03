import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { mensajeError } from '../../../../compartido/infraestructura/http/error.interceptor';
import { Coordinacion } from '../../../organizacion/dominio/estructura.model';
import { SesionStore } from '../../aplicacion/sesion.store';
import { UsuariosFacade } from '../../aplicacion/usuarios.facade';
import {
  AsignacionRealizada,
  CoordinacionAsignada,
  Rol,
  Usuario,
  requiereCoordinacion,
} from '../../dominio/usuario.model';

/**
 * Asignacion del puesto de una persona ya registrada (RF-28d).
 *
 * <p>Es el segundo de los dos actos en que la v3.3 partio el alta. El primero
 * dijo quien es la persona; este dice que hace y donde, y es tambien el
 * momento en que nace su contrasena: antes de tener un puesto no habia nada
 * que pudiera hacer con ella.</p>
 *
 * <p><b>Aqui no se releva a nadie (v3.4).</b> Una coordinacion que ya tiene
 * responsable no admite otro: su nombre aparece, pero no puede elegirse, y la
 * ventana dice quien lo ocupa y donde se le da de baja (RF-26, RN-06). Hasta
 * la v3.3 asignar sustituia al vigente en el mismo acto, de modo que alguien
 * podia perder su cargo como efecto colateral de nombrar a otro.</p>
 *
 * <p>Y cada persona pertenece a una sola coordinacion (RN-05): quien ya tiene
 * puesto no recibe otro hasta que se le da de baja del que tiene, con el boton
 * <em>Dar de baja</em> de esta misma ventana.</p>
 *
 * <p><b>El puesto se da a quien esta libre (RN-33).</b> Vale para los tres
 * roles, tambien para el de administrador, que no ocupa coordinacion y hasta
 * ahora se colaba por esa rendija: quien ya es algo en el sistema no cambia de
 * puesto por el hecho de que se le asigne otro. Y nadie se asigna un puesto a
 * si mismo: quien reparte los puestos no es quien los recibe. La ventana lo
 * explica y apaga el boton; el servidor lo rechaza igualmente (RF-04).</p>
 */
@Component({
  selector: 'app-asignar-puesto',
  standalone: false,
  templateUrl: './asignar-puesto.html',
})
export class AsignarPuesto implements OnInit {
  private readonly usuarios = inject(UsuariosFacade);
  private readonly sesion = inject(SesionStore);
  private readonly notificaciones = inject(NotificacionStore);

  /** Persona a la que se le da el puesto. */
  @Input({ required: true }) persona!: Usuario;
  /** Coordinaciones activas entre las que elegir. */
  @Input() coordinaciones: Coordinacion[] = [];
  /**
   * La lista todavia esta en camino.
   *
   * <p>Sin esto, la ventana anuncia que no hay ninguna coordinacion durante el
   * instante que tarda la peticion, que es decirle al usuario que le falta
   * crear una cuando lo unico que le falta es esperar (RNF-24).</p>
   */
  @Input() cargandoCoordinaciones = false;
  /** Rol sugerido: lo fija quien llega desde una tarea concreta. */
  @Input() rolSugerido: Rol | null = null;
  /** Coordinacion sugerida, por el mismo motivo. */
  @Input() coordinacionSugerida: number | null = null;
  /**
   * Deja elegir entre los tres roles.
   *
   * <p>El Responsable que suma gente a su equipo solo puede crear operadores:
   * nombrar responsables y administradores es decision del Administrador
   * (RF-28d). Ofrecerle las otras dos opciones seria ofrecerle una accion que
   * el servidor rechazaria (RNF-23).</p>
   */
  @Input() permiteElegirRol = true;

  /** La persona quedo asignada: la lista de fuera debe recargarse. */
  @Output() asignado = new EventEmitter<AsignacionRealizada>();
  @Output() cancelado = new EventEmitter<void>();

  protected readonly guardando = signal(false);
  protected readonly resultado = signal<AsignacionRealizada | null>(null);
  /** Puesto que la persona tiene ahora mismo, si tiene alguno (RN-05). */
  protected readonly puestos = signal<CoordinacionAsignada[]>([]);
  /** Rol vigente de la persona; se vacia al darle de baja su puesto. */
  protected readonly rolVigente = signal<Rol | null>(null);
  protected readonly huboCambios = signal(false);

  /** RNF-26: confirmaciones flotantes de los dos actos criticos. */
  protected readonly confirmandoAsignacion = signal(false);
  protected readonly confirmandoBaja = signal<CoordinacionAsignada | null>(null);

  protected rolElegido: Rol = 'OPERADOR';
  protected coordinacionElegida: number | null = null;

  ngOnInit(): void {
    this.puestos.set(this.persona.coordinaciones ?? []);
    this.rolVigente.set(this.persona.rol ?? null);
    this.rolElegido = this.rolSugerido ?? this.persona.rol ?? 'OPERADOR';
    this.coordinacionElegida = this.coordinacionSugerida ?? null;
  }

  // ------------------------------------------------------------------ Roles

  /** RF-28d: quien no puede repartir todos los puestos solo ve el suyo. */
  protected get rolesOfrecidos(): Rol[] {
    return this.permiteElegirRol ? ['RESPONSABLE', 'OPERADOR', 'ADMIN'] : ['OPERADOR'];
  }

  protected etiquetaRol(rol: Rol): string {
    switch (rol) {
      case 'ADMIN':
        return 'Administrador';
      case 'RESPONSABLE':
        return 'Responsable';
      default:
        return 'Operador';
    }
  }

  protected explicacionRol(rol: Rol): string {
    switch (rol) {
      case 'ADMIN':
        return 'Organiza la institución: coordinaciones, laboratorios, personas y catálogo. Consulta todos los inventarios, pero no registra ni presta equipos, y no pertenece a ninguna coordinación.';
      case 'RESPONSABLE':
        return 'A cargo del inventario de una coordinación: registra, edita, da de baja, presta y recibe equipos. Responde por una sola.';
      default:
        return 'Registra equipos y préstamos del día a día. Pertenece a una sola coordinación.';
    }
  }

  protected elegirRol(rol: Rol): void {
    this.rolElegido = rol;
    if (!requiereCoordinacion(rol)) {
      this.coordinacionElegida = null;
      return;
    }
    // El puesto de responsable elegido antes puede estar ocupado en la
    // coordinacion que ya estaba seleccionada: se suelta en lugar de dejar una
    // eleccion que el boton va a rechazar.
    if (this.ocupada(this.elegida)) {
      this.coordinacionElegida = null;
    }
  }

  // ---------------------------------------------------------- Coordinaciones

  protected get pideCoordinacion(): boolean {
    return requiereCoordinacion(this.rolElegido);
  }

  /** Solo se reparten puestos en coordinaciones que estan en funcionamiento. */
  protected get coordinacionesElegibles(): Coordinacion[] {
    return this.coordinaciones.filter((c) => c.activa);
  }

  /**
   * RN-06: esa coordinacion ya tiene responsable, asi que el puesto no esta
   * libre. Se muestra, pero no se puede elegir (RF-19b).
   */
  protected ocupada(coordinacion: Coordinacion | null): boolean {
    return (
      this.rolElegido === 'RESPONSABLE' && coordinacion != null && coordinacion.responsableId != null
    );
  }

  /** Coordinacion elegida, resuelta a su ficha completa. */
  protected get elegida(): Coordinacion | null {
    return this.coordinaciones.find((c) => c.id === this.coordinacionElegida) ?? null;
  }

  /** Todas las coordinaciones activas tienen ya su responsable (RN-06). */
  protected get todasConResponsable(): boolean {
    return (
      this.rolElegido === 'RESPONSABLE' &&
      this.coordinacionesElegibles.length > 0 &&
      this.coordinacionesElegibles.every((c) => c.responsableId != null)
    );
  }

  /**
   * RN-05, RN-33: la persona ya tiene puesto, y solo se asigna a quien no
   * tiene ninguno.
   *
   * <p>Darle otro exige darle de baja el que tiene. Se mira el rol y no solo
   * la coordinacion, porque el administrador no ocupa ninguna: sin esto, la
   * unica persona que podia cambiar de puesto de un golpe era justamente la
   * que organiza el sistema.</p>
   */
  protected get yaTienePuesto(): boolean {
    // `!= null` y no `!== null`: la persona sin puesto puede llegar con el rol
    // ausente, no en null, si el dato no paso por normalizarUsuario.
    return this.rolVigente() != null || this.puestos().length > 0;
  }

  /**
   * El puesto que tiene no esta en ninguna coordinacion: es administrador.
   *
   * <p>No hay nada que darle de baja desde aqui —su puesto no es una
   * asignacion—, asi que la ventana lo dice en lugar de ofrecer un boton que
   * no llevaria a ninguna parte (RNF-23).</p>
   */
  protected get puestoInstitucional(): boolean {
    return this.yaTienePuesto && this.puestos().length === 0;
  }

  /**
   * RN-33: quien reparte los puestos no es quien los recibe.
   *
   * <p>Un administrador que se cambia a si mismo el rol se deja fuera de su
   * propia pantalla, y nadie mas tiene por que haberlo decidido.</p>
   */
  protected get esUnoMismo(): boolean {
    return this.sesion.usuario()?.id === this.persona.id;
  }

  /** No hay ninguna a la que asignar, y no es que esten por llegar. */
  protected get sinCoordinaciones(): boolean {
    return (
      this.pideCoordinacion && !this.cargandoCoordinaciones && this.coordinacionesElegibles.length === 0
    );
  }

  protected get puedeAsignar(): boolean {
    if (this.guardando() || this.yaTienePuesto || this.esUnoMismo) {
      return false;
    }
    if (!this.pideCoordinacion) {
      return true;
    }
    return (
      !this.cargandoCoordinaciones && this.coordinacionElegida !== null && !this.ocupada(this.elegida)
    );
  }

  /** El texto del boton dice exactamente lo que va a ocurrir (RNF-31). */
  protected get textoConfirmar(): string {
    if (this.guardando()) {
      return 'Asignando...';
    }
    return this.rolElegido === 'ADMIN' ? 'Nuevo administrador' : 'Asignar puesto';
  }

  /** RNF-26: la consecuencia, en palabras concretas, antes de confirmar. */
  protected get mensajeConfirmacion(): string {
    if (this.rolElegido === 'ADMIN') {
      return `${this.persona.nombreCompleto} sera administrador del sistema.`;
    }
    const destino = this.elegida?.nombre ?? 'la coordinacion elegida';
    return (
      `${this.persona.nombreCompleto} quedara como ` +
      `${this.rolElegido === 'RESPONSABLE' ? 'responsable' : 'operador'} de ${destino}.`
    );
  }

  protected get detalleConfirmacion(): string {
    const estrena = this.persona.rol == null;
    const credenciales = estrena
      ? 'Se generará su contraseña, que se muestra una sola vez.'
      : 'Conserva la contraseña que ya tenía.';
    if (this.rolElegido === 'ADMIN') {
      return `Vera el inventario de todas las coordinaciones, en modo consulta. ${credenciales}`;
    }
    return `Sera la unica coordinacion en la que trabaje. ${credenciales}`;
  }

  // --------------------------------------------------------------- Acciones

  protected pedirConfirmacionDeAsignacion(): void {
    if (!this.puedeAsignar) {
      return;
    }
    this.confirmandoAsignacion.set(true);
  }

  protected asignar(): void {
    if (!this.puedeAsignar) {
      return;
    }
    this.confirmandoAsignacion.set(false);
    this.guardando.set(true);
    this.usuarios
      .asignar(this.persona.id, {
        rol: this.rolElegido,
        coordinacionId: this.pideCoordinacion ? this.coordinacionElegida : null,
      })
      .subscribe({
        next: (realizada) => {
          this.guardando.set(false);
          this.huboCambios.set(true);
          this.puestos.set(realizada.usuario.coordinaciones ?? []);
          this.rolVigente.set(realizada.usuario.rol);
          this.resultado.set(realizada);
        },
        error: (error) => {
          this.guardando.set(false);
          this.notificaciones.error(mensajeError(error, 'No se pudo asignar el puesto.'));
        },
      });
  }

  protected pedirConfirmacionDeBaja(coordinacion: CoordinacionAsignada): void {
    this.confirmandoBaja.set(coordinacion);
  }

  protected get mensajeBaja(): string {
    const puesto = this.confirmandoBaja();
    if (!puesto) {
      return '';
    }
    return (
      `${this.persona.nombreCompleto} dejara de ser ` +
      `${this.rolVigente() === 'RESPONSABLE' ? 'responsable' : 'operador'} de ` +
      `${this.nombreDe(puesto)}.`
    );
  }

  protected get detalleBaja(): string {
    return this.rolVigente() === 'RESPONSABLE'
      ? 'La coordinación quedará sin responsable y no podrá registrar ni prestar equipos hasta que se nombre a otro. La cuenta de la persona sigue activa, sin puesto.'
      : 'Su cuenta sigue activa, sin puesto, y su historial en los equipos y préstamos se conserva.';
  }

  /**
   * RF-26, RF-28d: da de baja el puesto de la persona.
   *
   * <p>Vuelve a quedar registrada pero sin puesto. No se le desactiva la
   * cuenta: dejar un puesto no es dejar la institucion.</p>
   */
  protected darDeBaja(): void {
    const coordinacion = this.confirmandoBaja();
    if (!coordinacion) {
      return;
    }
    this.confirmandoBaja.set(null);
    this.guardando.set(true);
    this.usuarios.retirar(this.persona.id, coordinacion.id).subscribe({
      next: (actualizada) => {
        this.guardando.set(false);
        this.huboCambios.set(true);
        this.puestos.set(actualizada.coordinaciones ?? []);
        this.rolVigente.set(actualizada.rol);
        this.notificaciones.exito(
          `${actualizada.nombreCompleto} ya no trabaja en ${coordinacion.nombre ?? 'esa coordinacion'}.`,
        );
      },
      error: (error) => {
        this.guardando.set(false);
        this.notificaciones.error(mensajeError(error));
      },
    });
  }

  protected nombreDe(coordinacion: CoordinacionAsignada): string {
    return coordinacion.nombre ?? `Coordinacion #${coordinacion.id}`;
  }

  protected cerrar(): void {
    const ultimo = this.resultado();
    if (ultimo) {
      this.asignado.emit(ultimo);
      return;
    }
    if (this.huboCambios()) {
      // Se dio de baja un puesto sin asignar ninguno: la lista de fuera tambien
      // cambio y hay que recargarla.
      this.asignado.emit({
        usuario: { ...this.persona, rol: this.rolVigente(), coordinaciones: this.puestos() },
        mensaje: '',
      });
      return;
    }
    this.cancelado.emit();
  }
}
