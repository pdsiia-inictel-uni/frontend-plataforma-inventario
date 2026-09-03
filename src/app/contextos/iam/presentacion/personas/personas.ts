import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { RefrescoAutomatico } from '../../../../compartido/aplicacion/refresco-automatico';
import { PAGINA_VACIA, Pagina } from '../../../../compartido/dominio/pagina.model';
import { mensajeError } from '../../../../compartido/infraestructura/http/error.interceptor';
import { OrganizacionFacade } from '../../../organizacion/aplicacion/organizacion.facade';
import { Coordinacion } from '../../../organizacion/dominio/estructura.model';
import { SesionStore } from '../../aplicacion/sesion.store';
import { UsuariosFacade } from '../../aplicacion/usuarios.facade';
import {
  AsignacionRealizada,
  PasswordTemporal,
  ESTADOS_CUENTA,
  EstadoCuenta,
  ROLES,
  Rol,
  Usuario,
  claseEstadoCuenta,
  claseRol,
  coordinacionDe,
} from '../../dominio/usuario.model';

/**
 * Personas del sistema, vistas por el Administrador (RF-28).
 *
 * <p>Los tres roles viven en una sola lista con un filtro por rol, y con ellos
 * las personas que aun no tienen ninguno: desde la v3.3 el alta y el puesto
 * son dos actos distintos, asi que "registrada pero sin asignar" es un estado
 * normal y visible, no un hueco.</p>
 *
 * <p>Esta pantalla es tambien donde se nombra a los responsables: aqui se
 * busca primero a la persona —que es como se busca a la gente— y se le da el
 * puesto despues. Las tarjetas de Direcciones enlazan aqui con la coordinacion
 * ya cargada en la consulta. Lo que no se hace aqui es dar de baja a un
 * responsable vigente: eso ocurre en la tarjeta de su coordinacion, que es
 * donde se ve lo que la baja deja parado (RF-26).</p>
 *
 * <p>La tabla dice quien hay; la ficha de cada fila, quien es cada uno. El
 * DNI, el correo, la coordinacion y la edicion de los datos viven en esa
 * ficha (RF-28f): la lista se lee para encontrar a alguien, y una vez
 * encontrado se abre.</p>
 */
@Component({
  selector: 'app-personas',
  standalone: false,
  templateUrl: './personas.html',
})
export class Personas {
  private readonly usuarios = inject(UsuariosFacade);
  private readonly organizacion = inject(OrganizacionFacade);
  private readonly sesion = inject(SesionStore);
  private readonly notificaciones = inject(NotificacionStore);
  private readonly refresco = inject(RefrescoAutomatico);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly roles = ROLES;
  protected readonly estadosCuenta = ESTADOS_CUENTA;

  protected readonly pagina = signal<Pagina<Usuario>>(PAGINA_VACIA);
  protected readonly coordinaciones = signal<Coordinacion[]>([]);
  protected readonly cargando = signal(true);

  /**
   * La lista de coordinaciones se esta pidiendo al servidor (RF-28d).
   *
   * <p>La ventana de asignacion lo necesita para no anunciar que no hay
   * ninguna cuando lo que pasa es que todavia no han llegado: son dos cosas
   * distintas y llevan a acciones distintas (RNF-24).</p>
   */
  protected readonly coordinacionesCargando = signal(false);

  protected readonly formularioAbierto = signal(false);
  protected readonly enEdicion = signal<Usuario | null>(null);
  protected readonly credencial = signal<PasswordTemporal | null>(null);
  /** RF-22b: cambio de estado pendiente de confirmar, con su destino. */
  protected readonly confirmacion = signal<{ usuario: Usuario; destino: EstadoCuenta } | null>(null);

  /** RF-28f: persona cuya ficha se esta consultando, si hay alguna. */
  protected readonly detalle = signal<Usuario | null>(null);

  /** RNF-26: las acciones sobre credenciales se confirman antes de ejecutarse. */
  protected readonly confirmandoPassword = signal<Usuario | null>(null);
  protected readonly confirmandoDesbloqueo = signal<Usuario | null>(null);
  protected readonly procesando = signal(false);

  /** Persona a la que se le esta dando un puesto, si hay alguna (RF-28d). */
  protected readonly asignando = signal<Usuario | null>(null);

  /**
   * Tarea que trajo al Administrador hasta aqui.
   *
   * <p>Las tarjetas de Direcciones enlazan a esta pantalla para asignar el
   * responsable de una coordinacion concreta. Mientras dura el encargo, la
   * pantalla lo dice en su encabezado y las filas ofrecen "Asignar aqui" en
   * lugar del "Asignar" generico: quien llego con una tarea no deberia tener
   * que recordar cual era (RNF-22).</p>
   */
  protected readonly encargo = signal<{ coordinacionId: number; rol: Rol } | null>(null);

  protected texto = '';
  /** RF-28: null muestra a todas las personas, sea cual sea su rol. */
  protected rolFiltro: Rol | null = null;
  protected coordinacionId: number | null = null;
  /** RF-28e: true deja solo a las personas registradas que aun no tienen puesto. */
  protected sinAsignarFiltro: boolean | null = null;
  protected estadoFiltro: EstadoCuenta | null = null;
  protected numeroPagina = 0;
  protected tamano = 10;

  /** Coordinacion del encargo en curso, resuelta a su ficha. */
  protected readonly coordinacionDelEncargo = computed(() => {
    const encargo = this.encargo();
    return encargo ? (this.coordinaciones().find((c) => c.id === encargo.coordinacionId) ?? null) : null;
  });

  constructor() {
    this.cargarCoordinaciones();

    // Otras pantallas enlazan aqui con la tarea ya planteada.
    const parametros = this.ruta.snapshot.queryParamMap;
    const rol = this.leerRol(parametros.get('rol'));
    const asignarA = Number(parametros.get('asignarA'));
    if (asignarA) {
      this.encargo.set({ coordinacionId: asignarA, rol: rol ?? 'RESPONSABLE' });
    }
    const coordinacion = Number(parametros.get('coordinacion'));
    if (coordinacion) {
      this.coordinacionId = coordinacion;
    }
    if (rol && !asignarA) {
      this.rolFiltro = rol;
    }
    this.buscar();

    // El panel de coordinaciones sin responsable es una tarea pendiente, y las
    // tareas pendientes las resuelve tambien el de al lado: dejarlo quieto
    // hasta la siguiente recarga manual es pedir que se asigne dos veces el
    // mismo puesto. Mientras haya una ventana abierta no se toca nada de lo
    // que hay debajo (RNF-26).
    this.refresco.alRefrescar(() => {
      if (this.ventanaAbierta) {
        return;
      }
      this.buscar(true);
      this.cargarCoordinaciones(true);
    });
  }

  /**
   * Hay una ventana en curso sobre la que el usuario esta decidiendo algo.
   *
   * <p>Recargar la lista por debajo no rompe nada, pero cambiar lo que hay
   * detras de una confirmacion abierta es cambiarle la pregunta a quien esta a
   * punto de responderla.</p>
   */
  private get ventanaAbierta(): boolean {
    return (
      this.formularioAbierto() ||
      this.detalle() !== null ||
      this.asignando() !== null ||
      this.confirmacion() !== null ||
      this.confirmandoPassword() !== null ||
      this.confirmandoDesbloqueo() !== null ||
      this.credencial() !== null
    );
  }

  private leerRol(valor: string | null): Rol | null {
    return valor === 'ADMIN' || valor === 'RESPONSABLE' || valor === 'OPERADOR' ? valor : null;
  }

  /**
   * @param recargar descarta lo memorizado y vuelve a preguntar al servidor.
   *                 Lo pide el refresco automatico, que existe justamente para
   *                 enterarse de lo que cambio fuera de esta pantalla.
   */
  private cargarCoordinaciones(recargar = false): void {
    const consulta = recargar
      ? this.organizacion.recargarCoordinaciones()
      : this.organizacion.coordinacionesDisponibles();
    this.coordinacionesCargando.set(true);
    consulta.subscribe({
      next: (lista) => {
        this.coordinaciones.set(lista);
        this.coordinacionesCargando.set(false);
      },
      error: () => {
        this.coordinacionesCargando.set(false);
        if (!recargar) {
          this.coordinaciones.set([]);
        }
      },
    });
  }

  /**
   * Nombre en plural de lo que se esta listando, para que la pantalla vacia
   * hable de personas concretas: "No hay responsables que mostrar".
   */
  protected get pluralDelFiltro(): string {
    if (this.sinAsignarFiltro === true) {
      return 'personas sin asignar';
    }
    switch (this.rolFiltro) {
      case 'ADMIN':
        return 'administradores';
      case 'RESPONSABLE':
        return 'responsables';
      case 'OPERADOR':
        return 'operadores';
      default:
        return 'personas';
    }
  }

  /** RNF-30: el rol se distingue por color Y por texto, nunca solo por color. */
  protected claseDelRol(rol: Rol | null): string {
    return claseRol(rol);
  }

  /** RF-22b, RNF-30: y el estado de la cuenta, que ahora tiene tres valores. */
  protected claseDelEstado(estado: EstadoCuenta): string {
    return claseEstadoCuenta(estado);
  }

  /** RN-05: una persona pertenece a una sola coordinacion (RF-28d). */
  protected coordinacionDe(persona: Usuario): string {
    return coordinacionDe(persona);
  }

  /**
   * RN-33: quien reparte los puestos no es quien los recibe.
   *
   * <p>La fila del propio Administrador no ofrece asignar: cambiarse el rol a
   * si mismo le dejaria fuera de esta pantalla. Su ficha sigue abierta con
   * "Ver detalle", que es lo que de verdad se va a mirar ahi (RNF-23).</p>
   */
  protected esUnoMismo(persona: Usuario): boolean {
    return this.sesion.usuario()?.id === persona.id;
  }

  /**
   * @param silencioso recarga de fondo: sin indicador de carga ni avisos de
   *                   error, para no interrumpir a quien esta leyendo la lista.
   */
  protected buscar(silencioso = false): void {
    if (!silencioso) {
      this.cargando.set(true);
    }
    this.usuarios
      .buscar(
        {
          q: this.texto.trim() || undefined,
          rol: this.rolFiltro,
          coordinacionId: this.coordinacionId,
          sinAsignar: this.sinAsignarFiltro,
          estado: this.estadoFiltro,
        },
        { pagina: this.numeroPagina, tamano: this.tamano, ordenarPor: 'primerApellido' },
      )
      .subscribe({
        next: (pagina) => {
          this.pagina.set(pagina);
          this.cargando.set(false);
        },
        error: (error) => {
          if (!silencioso) {
            this.notificaciones.error(mensajeError(error, 'No se pudo cargar la lista.'));
          }
          this.cargando.set(false);
        },
      });
  }

  protected aplicarFiltros(): void {
    this.numeroPagina = 0;
    this.buscar();
  }

  protected limpiarFiltros(): void {
    this.texto = '';
    this.rolFiltro = null;
    this.coordinacionId = null;
    this.sinAsignarFiltro = null;
    this.estadoFiltro = null;
    this.aplicarFiltros();
  }

  /** Hay algun filtro puesto: cambia lo que dice la pantalla si no hay resultados. */
  protected get hayFiltros(): boolean {
    return (
      this.texto.trim().length > 0 ||
      this.rolFiltro !== null ||
      this.coordinacionId !== null ||
      this.sinAsignarFiltro !== null ||
      this.estadoFiltro !== null
    );
  }

  protected irAPagina(destino: number): void {
    this.numeroPagina = destino;
    this.buscar();
  }

  protected cambiarTamano(nuevo: number): void {
    this.tamano = nuevo;
    this.numeroPagina = 0;
    this.buscar();
  }

  // ------------------------------------------------------------- Formulario

  /**
   * RF-16b: el alta no depende de que exista ninguna coordinacion.
   *
   * <p>Hasta la v3.2 no podia registrarse a nadie sin estructura, porque el
   * alta exigia adscribir. Ahora el registro previo solo dice quien es la
   * persona, y eso puede hacerse el primer dia.</p>
   */
  protected nuevaPersona(): void {
    this.enEdicion.set(null);
    this.formularioAbierto.set(true);
  }

  /** RF-28f: la edicion se abre desde la ficha, con los datos a la vista. */
  protected editar(usuario: Usuario): void {
    this.detalle.set(null);
    this.enEdicion.set(usuario);
    this.formularioAbierto.set(true);
  }

  // ------------------------------------------------------------ RF-28f: ficha

  protected verDetalle(persona: Usuario): void {
    this.detalle.set(persona);
  }

  protected cerrarDetalle(): void {
    this.detalle.set(null);
  }

  /**
   * El alta termina en el alta, y nada mas.
   *
   * <p>La pantalla confirma que la persona quedo registrada y dice cual es el
   * paso siguiente, pero no lo abre: encadenar la ventana de asignacion daba
   * por hecho que quien registra ya tiene decidido el puesto, y era justo lo
   * que la v3.3 dejo de dar por hecho al partir el alta en dos (RF-16b). Quien
   * lo tenga decidido lo asigna desde la fila, que es donde vive esa accion y
   * donde seguira estando manana (RF-28d).</p>
   */
  protected alGuardar(persona: Usuario): void {
    const eraAlta = this.enEdicion() === null;
    this.formularioAbierto.set(false);
    this.enEdicion.set(null);
    this.buscar();
    if (eraAlta) {
      this.notificaciones.exito(
        `${persona.nombreCompleto} quedo registrada. Asignele una coordinacion y su rol ` +
          'para que pueda entrar.',
      );
    }
  }

  protected cerrarFormulario(): void {
    this.formularioAbierto.set(false);
    this.enEdicion.set(null);
  }

  // ------------------------------------------------------- RF-28d: puestos

  /**
   * RF-28d: abre la ventana del puesto con las coordinaciones que hay ahora.
   *
   * <p>La lista se vuelve a pedir al abrir, y no solo al entrar a la pantalla:
   * una coordinacion recien creada en Direcciones tiene que poder recibir a su
   * gente sin recargar el navegador, y una lista que se quedo vacia por un
   * fallo anterior no puede condenar a la sesion entera a no poder asignar a
   * nadie. La ventana se abre en el acto y la lista entra en cuanto llega
   * (RNF-31).</p>
   */
  protected asignarPuesto(persona: Usuario): void {
    this.detalle.set(null);
    this.asignando.set(persona);
    this.cargarCoordinaciones(true);
  }

  protected alAsignar(realizada: AsignacionRealizada): void {
    this.asignando.set(null);
    if (realizada.mensaje) {
      this.notificaciones.exito(realizada.mensaje);
    }
    // El resumen de las coordinaciones cambio: quien tiene responsable y quien
    // no se decide justo aqui (RF-28b).
    this.cargarCoordinaciones(true);
    this.buscar();
    this.terminarEncargo();
  }

  /** Rol sugerido en el modal: el del encargo, si se llego con uno. */
  protected get rolSugerido(): Rol | null {
    return this.encargo()?.rol ?? null;
  }

  protected get coordinacionSugerida(): number | null {
    return this.encargo()?.coordinacionId ?? null;
  }

  protected cancelarEncargo(): void {
    this.terminarEncargo();
  }

  private terminarEncargo(): void {
    if (!this.encargo()) {
      return;
    }
    this.encargo.set(null);
    // La ruta deja de mencionar una tarea que ya no esta en curso.
    void this.router.navigate([], { relativeTo: this.ruta, queryParams: {} });
  }

  // --------------------------------------------------------------- Acciones

  /**
   * RF-22b: suspender es apartar a quien va a volver; dar de baja es despedir.
   *
   * <p>Las dos abren la misma ventana de confirmacion, que se explica sola
   * segun el destino: la pregunta que hay que responder no es "¿seguro?", sino
   * "¿esta persona vuelve o no vuelve?" (RNF-26).</p>
   */
  protected pedirCambioEstado(usuario: Usuario, destino: EstadoCuenta): void {
    this.detalle.set(null);
    this.confirmacion.set({ usuario, destino });
  }

  /** El mismo boton aparta y trae de vuelta, segun donde este la persona. */
  protected pedirSuspension(usuario: Usuario): void {
    this.pedirCambioEstado(usuario, usuario.estado === 'SUSPENDIDA' ? 'ACTIVA' : 'SUSPENDIDA');
  }

  protected confirmarCambioEstado(): void {
    const peticion = this.confirmacion();
    if (!peticion) {
      return;
    }
    this.usuarios.cambiarEstado(peticion.usuario.id, peticion.destino).subscribe({
      next: (actualizada) => {
        this.notificaciones.exito(this.confirmacionHecha(actualizada, peticion.destino));
        this.confirmacion.set(null);
        this.buscar();
        // Una baja puede haber dejado una coordinacion sin responsable (RN-34).
        this.cargarCoordinaciones(true);
      },
      error: (error) => {
        this.notificaciones.error(mensajeError(error));
        this.confirmacion.set(null);
      },
    });
  }

  private confirmacionHecha(usuario: Usuario, destino: EstadoCuenta): string {
    switch (destino) {
      case 'SUSPENDIDA':
        return `${usuario.nombreCompleto} queda suspendido y conserva su puesto.`;
      case 'BAJA':
        return `${usuario.nombreCompleto} queda dado de baja de la institucion y sin puesto.`;
      default:
        return `${usuario.nombreCompleto} vuelve a poder ingresar al sistema.`;
    }
  }

  protected get tituloConfirmacion(): string {
    switch (this.confirmacion()?.destino) {
      case 'SUSPENDIDA':
        return 'Suspender la cuenta';
      case 'BAJA':
        return 'Dar de baja de la institución';
      default:
        return this.confirmacion()?.usuario.estado === 'BAJA'
          ? 'Reincorporar a la institución'
          : 'Reactivar la cuenta';
    }
  }

  protected get textoConfirmacion(): string {
    switch (this.confirmacion()?.destino) {
      case 'SUSPENDIDA':
        return 'Suspender';
      case 'BAJA':
        return 'Dar de baja';
      default:
        return this.confirmacion()?.usuario.estado === 'BAJA' ? 'Reincorporar' : 'Reactivar';
    }
  }

  protected get confirmacionEsPeligrosa(): boolean {
    return this.confirmacion()?.destino === 'BAJA';
  }

  protected get mensajeConfirmacion(): string {
    const peticion = this.confirmacion();
    if (!peticion) {
      return '';
    }
    const nombre = peticion.usuario.nombreCompleto;
    switch (peticion.destino) {
      case 'SUSPENDIDA':
        return `${nombre} dejara de poder ingresar mientras dure la suspension.`;
      case 'BAJA':
        return `${nombre} dejara de pertenecer a la institucion.`;
      default:
        return `${nombre} volvera a poder ingresar al sistema.`;
    }
  }

  protected get detalleConfirmacion(): string {
    const peticion = this.confirmacion();
    if (!peticion) {
      return '';
    }
    switch (peticion.destino) {
      case 'SUSPENDIDA':
        return (
          'Es una ausencia temporal —vacaciones, un permiso, una licencia—: conserva su puesto y ' +
          'lo recupera tal cual al reactivarla.'
        );
      case 'BAJA':
        return (
          'Ademas de no poder entrar, deja su puesto: si era responsable, su coordinación quedará ' +
          'parada hasta que se nombre a otro. Sus datos y su historial en los equipos y préstamos ' +
          'se conservan, y puede reincorporarla si vuelve a trabajar aquí.'
        );
      default:
        return peticion.usuario.estado === 'BAJA'
          ? 'Vuelve con su cuenta, pero sin puesto: el que tenía se cubrio cuando se fue. Asignele uno para que pueda trabajar.'
          : 'Recupera el puesto que tenía antes de la suspension.';
    }
  }

  // ------------------------------------------- RF-06, RF-08: credenciales

  protected pedirRestablecerPassword(usuario: Usuario): void {
    this.detalle.set(null);
    this.confirmandoPassword.set(usuario);
  }

  protected get mensajePassword(): string {
    const usuario = this.confirmandoPassword();
    return usuario
      ? `Se generara una contrasena nueva para ${usuario.nombreCompleto}.`
      : '';
  }

  protected restablecerPassword(): void {
    const usuario = this.confirmandoPassword();
    if (!usuario) {
      return;
    }
    this.procesando.set(true);
    this.usuarios.restablecerPassword(usuario.id).subscribe({
      next: (credencial) => {
        this.procesando.set(false);
        this.confirmandoPassword.set(null);
        this.credencial.set(credencial);
      },
      error: (error) => {
        this.procesando.set(false);
        this.confirmandoPassword.set(null);
        this.notificaciones.error(mensajeError(error));
      },
    });
  }

  protected pedirDesbloqueo(usuario: Usuario): void {
    this.detalle.set(null);
    this.confirmandoDesbloqueo.set(usuario);
  }

  protected get mensajeDesbloqueo(): string {
    const usuario = this.confirmandoDesbloqueo();
    return usuario
      ? `${usuario.nombreCompleto} volvera a poder intentar el ingreso ahora mismo.`
      : '';
  }

  protected desbloquear(): void {
    const usuario = this.confirmandoDesbloqueo();
    if (!usuario) {
      return;
    }
    this.procesando.set(true);
    this.usuarios.desbloquear(usuario.id).subscribe({
      next: () => {
        this.procesando.set(false);
        this.confirmandoDesbloqueo.set(null);
        this.notificaciones.exito('Cuenta desbloqueada.');
        this.buscar();
      },
      error: (error) => {
        this.procesando.set(false);
        this.confirmandoDesbloqueo.set(null);
        this.notificaciones.error(mensajeError(error));
      },
    });
  }
}
