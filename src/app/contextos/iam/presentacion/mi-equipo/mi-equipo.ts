import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { RefrescoAutomatico } from '../../../../compartido/aplicacion/refresco-automatico';
import {
  erroresDeCampo,
  mensajeError,
} from '../../../../compartido/infraestructura/http/error.interceptor';
import { InventarioFacade } from '../../../inventario/aplicacion/inventario.facade';
import { SesionStore } from '../../aplicacion/sesion.store';
import { UsuariosFacade } from '../../aplicacion/usuarios.facade';
import {
  AsignacionRealizada,
  EstadoCuenta,
  PasswordTemporal,
  Usuario,
  UsuarioPeticion,
  claseEstadoCuenta,
} from '../../dominio/usuario.model';

/**
 * Mi equipo humano: integrantes de la coordinacion del Responsable (RF-29).
 *
 * <p>Una sola seccion, no dos: el propio Responsable arriba, en una tarjeta
 * destacada, y sus Operadores debajo. El Responsable puede dar de alta y
 * desactivar operadores de su coordinacion, y nada mas.</p>
 *
 * <p>Aqui el alta y la asignacion se resuelven de un tiron, al contrario que
 * en la pantalla de Personas del Administrador. La razon es que el puesto no
 * esta en duda: el Responsable solo puede crear operadores, y solo en la
 * coordinacion que administra. Preguntarle rol y coordinacion seria preguntar
 * lo que ya se sabe (RNF-22).</p>
 */
@Component({
  selector: 'app-mi-equipo',
  standalone: false,
  templateUrl: './mi-equipo.html',
})
export class MiEquipo {
  private readonly usuarios = inject(UsuariosFacade);
  private readonly inventario = inject(InventarioFacade);
  private readonly sesion = inject(SesionStore);
  private readonly notificaciones = inject(NotificacionStore);
  private readonly refresco = inject(RefrescoAutomatico);
  private readonly router = inject(Router);

  protected readonly coordinacion = this.sesion.coordinacion;
  protected readonly integrantes = signal<Usuario[]>([]);
  /**
   * RN-38: cuántos equipos lleva cada operador, por identificador.
   *
   * <p>Se pide entero y de una vez —el reparto de la coordinación es una sola
   * consulta (RF-84)— en lugar de preguntarlo operador por operador: la
   * pantalla necesita el dato de todos a la vez para saber a quién puede dar de
   * baja y a quién no.</p>
   */
  protected readonly equiposPorOperador = signal<Map<number, number>>(new Map());
  protected readonly cargando = signal(true);

  protected readonly formularioAbierto = signal(false);
  protected readonly enEdicion = signal<Usuario | null>(null);
  /** RNF-25: lo que el servidor rechazo del alta, campo por campo. */
  protected readonly erroresAlta = signal<Record<string, string>>({});
  protected readonly credencial = signal<PasswordTemporal | null>(null);
  /** RF-28d: contrasena que nace con el puesto del operador recien dado de alta. */
  protected readonly recienAsignado = signal<AsignacionRealizada | null>(null);
  /** RF-22b: cambio de estado pendiente de confirmar, con su destino. */
  protected readonly confirmacion = signal<{ usuario: Usuario; destino: EstadoCuenta } | null>(null);
  /** RNF-26: tambien las acciones sobre credenciales se confirman antes. */
  protected readonly confirmandoPassword = signal<Usuario | null>(null);
  protected readonly confirmandoDesbloqueo = signal<Usuario | null>(null);
  protected readonly procesando = signal(false);

  // El propio Responsable ya no se muestra sobre la tabla: es quien esta
  // mirando la pantalla, y presentarle sus propios datos ocupaba el sitio de
  // lo que viene a ver. Se sigue pidiendo a la API la coordinacion entera
  // —una sola consulta— y de ella se toman los operadores.

  protected readonly operadores = computed(() =>
    this.integrantes().filter((u) => u.rol === 'OPERADOR'),
  );

  constructor() {
    this.cargar();

    // El Administrador puede dar de alta, desactivar o retirar a un operador
    // de esta coordinacion desde su propia pantalla: quien la administra debe
    // ver a su gente tal como esta, no como estaba al abrirla.
    this.refresco.alRefrescar(() => {
      if (!this.ventanaAbierta) {
        this.cargar(true);
      }
    });
  }

  /**
   * Hay una ventana en curso sobre la que el usuario esta decidiendo algo
   * (RNF-26).
   */
  private get ventanaAbierta(): boolean {
    return (
      this.formularioAbierto() ||
      this.confirmacion() !== null ||
      this.confirmandoPassword() !== null ||
      this.confirmandoDesbloqueo() !== null ||
      this.credencial() !== null ||
      this.recienAsignado() !== null
    );
  }

  /**
   * @param silencioso recarga de fondo: sin indicador de carga ni avisos de
   *                   error, para no interrumpir a quien esta leyendo.
   */
  protected cargar(silencioso = false): void {
    const coordinacionId = this.sesion.coordinacionId();
    if (!coordinacionId) {
      this.cargando.set(false);
      return;
    }
    if (!silencioso) {
      this.cargando.set(true);
    }
    this.usuarios.integrantesDe(coordinacionId, false).subscribe({
      next: (lista) => {
        this.integrantes.set(lista);
        this.cargando.set(false);
      },
      error: (error) => {
        if (!silencioso) {
          this.notificaciones.error(mensajeError(error, 'No se pudo cargar el equipo.'));
        }
        this.cargando.set(false);
      },
    });

    // RN-38: quién lleva equipos, para decir de quién se puede prescindir y de
    // quién no. Va aparte porque es otro contexto y su fallo no debe dejar la
    // pantalla sin la lista de personas, que es lo que se viene a ver.
    this.inventario.responsablesDeEquipo(coordinacionId).subscribe({
      next: (reparto) => {
        const cuenta = new Map<number, number>();
        for (const fila of reparto) {
          if (fila.usuarioId) {
            cuenta.set(fila.usuarioId, fila.cantidad);
          }
        }
        this.equiposPorOperador.set(cuenta);
      },
      error: () => this.equiposPorOperador.set(new Map()),
    });
  }

  /** RN-38: equipos en servicio a nombre de ese operador. */
  protected equiposDe(operador: Usuario): number {
    return this.equiposPorOperador().get(operador.id) ?? 0;
  }

  /** RF-84: abre el inventario ya acotado a lo que lleva ese operador. */
  protected verEquiposDe(operador: Usuario): void {
    void this.router.navigate(['/inventario'], { queryParams: { responsable: operador.id } });
  }

  /**
   * Por qué el botón de baja está desactivado, y qué hacer al respecto.
   *
   * <p>La salida está en manos de quien lee este aviso: es el Responsable quien
   * reparte los equipos de su coordinación (RF-83).</p>
   */
  protected motivoBloqueoBaja(operador: Usuario): string {
    const cantidad = this.equiposDe(operador);
    if (cantidad === 0) {
      return 'Dar de baja de la institución';
    }
    const equipos = cantidad === 1 ? 'un equipo' : `${cantidad} equipos`;
    return (
      `No se puede dar de baja: tiene ${equipos} a su cargo. Entrégueselos a otro operador de la ` +
      'coordinación o quédeselos usted desde la ficha de cada equipo, y la baja quedará disponible.'
    );
  }

  protected get coordinacionId(): number | null {
    return this.sesion.coordinacionId();
  }

  protected nuevoOperador(): void {
    this.enEdicion.set(null);
    this.erroresAlta.set({});
    this.formularioAbierto.set(true);
  }

  protected editar(usuario: Usuario): void {
    this.enEdicion.set(usuario);
    this.erroresAlta.set({});
    this.formularioAbierto.set(true);
  }

  /**
   * RF-16e: registra al operador y le da su puesto en la misma accion, y en
   * una sola peticion.
   *
   * <p>Hasta la v3.8 eran dos llamadas encadenadas desde aqui, y el segundo
   * eslabon podia romperse solo: entonces la persona quedaba registrada sin
   * puesto, invisible en esta pantalla —que muestra la coordinacion, y ella
   * no tenia ninguna— y con su DNI ya ocupado, de modo que ni se podia
   * corregir ni se podia repetir el alta. Ahora las dos viajan juntas y el
   * servidor las resuelve en una transaccion: o queda el operador entero, o
   * no queda nada.</p>
   */
  protected registrarOperador(datos: UsuarioPeticion): void {
    const coordinacionId = this.sesion.coordinacionId();
    if (!coordinacionId) {
      return;
    }
    this.erroresAlta.set({});
    this.usuarios.registrarYAsignar(datos, { rol: 'OPERADOR', coordinacionId }).subscribe({
      next: (realizada) => {
        this.formularioAbierto.set(false);
        this.enEdicion.set(null);
        this.recienAsignado.set(realizada);
        this.cargar();
      },
      error: (error) => {
        // El formulario sigue abierto con los datos escritos: lo que hay que
        // corregir es un campo, y el error se senala junto a el (RNF-25).
        this.erroresAlta.set(erroresDeCampo(error));
        this.notificaciones.error(mensajeError(error, 'No se pudo registrar al operador.'));
      },
    });
  }

  /** Solo llega desde la edicion: el alta pasa por {@link registrarOperador}. */
  protected alGuardar(): void {
    this.formularioAbierto.set(false);
    this.enEdicion.set(null);
    this.erroresAlta.set({});
    this.cargar();
  }

  protected cerrarFormulario(): void {
    this.formularioAbierto.set(false);
    this.enEdicion.set(null);
    this.erroresAlta.set({});
  }

  /**
   * RF-22b, RF-29: el Responsable da de baja a sus Operadores y los reincorpora.
   *
   * <p>A los suyos y a nadie más, y solo a los Operadores: sobre sí mismo y
   * sobre cualquier otro rol decide el Administrador. Dar de baja es la salida
   * de la institución, y deja la plaza libre (RN-34).</p>
   */
  protected pedirCambioEstado(usuario: Usuario, destino: EstadoCuenta): void {
    this.confirmacion.set({ usuario, destino });
  }

  protected confirmarCambioEstado(): void {
    const peticion = this.confirmacion();
    if (!peticion) {
      return;
    }
    this.usuarios.cambiarEstado(peticion.usuario.id, peticion.destino).subscribe({
      next: (actualizado) => {
        this.notificaciones.exito(
          peticion.destino === 'BAJA'
            ? `${actualizado.nombreCompleto} queda dado de baja de la institución.`
            : `${actualizado.nombreCompleto} vuelve a poder ingresar.`,
        );
        this.confirmacion.set(null);
        this.cargar();
      },
      error: (error) => {
        this.notificaciones.error(mensajeError(error));
        this.confirmacion.set(null);
      },
    });
  }

  protected get tituloConfirmacion(): string {
    return this.confirmacion()?.destino === 'BAJA'
      ? 'Dar de baja de la institución'
      : 'Reincorporar a la institución';
  }

  protected get textoConfirmacion(): string {
    return this.confirmacion()?.destino === 'BAJA' ? 'Dar de baja' : 'Reincorporar';
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
    return peticion.destino === 'BAJA'
      ? `${nombre} dejará de pertenecer a la institución.`
      : `${nombre} volverá a poder ingresar al sistema.`;
  }

  protected get detalleConfirmacion(): string {
    return this.confirmacion()?.destino === 'BAJA'
      ? 'Dejará de ser operador de su coordinación. Sus datos y su historial en los equipos y ' +
          'préstamos se conservan.'
      : 'Vuelve con su cuenta, pero sin puesto: tendrá que asignárselo de nuevo para que trabaje ' +
          'en la coordinación.';
  }

  /** RF-22b, RNF-30: el estado de la cuenta, por color Y por texto. */
  protected claseDelEstado(estado: EstadoCuenta): string {
    return claseEstadoCuenta(estado);
  }

  // ------------------------------------------- RF-06, RF-08: credenciales

  protected pedirRestablecerPassword(usuario: Usuario): void {
    this.confirmandoPassword.set(usuario);
  }

  protected get mensajePassword(): string {
    const usuario = this.confirmandoPassword();
    return usuario ? `Se generara una contrasena nueva para ${usuario.nombreCompleto}.` : '';
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
        this.cargar();
      },
      error: (error) => {
        this.procesando.set(false);
        this.confirmandoDesbloqueo.set(null);
        this.notificaciones.error(mensajeError(error));
      },
    });
  }
}
