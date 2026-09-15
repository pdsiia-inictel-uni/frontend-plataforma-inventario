import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { RefrescoAutomatico } from '../../../../compartido/aplicacion/refresco-automatico';
import {
  erroresDeCampo,
  mensajeError,
} from '../../../../compartido/infraestructura/http/error.interceptor';
import { FiltroActivo } from '../../../../compartido/presentacion/barra-filtros/barra-filtros';
import { SesionStore } from '../../aplicacion/sesion.store';
import { UsuariosFacade } from '../../aplicacion/usuarios.facade';
import {
  AsignacionRealizada,
  ESTADOS_CUENTA,
  EstadoCuenta,
  PasswordTemporal,
  Usuario,
  UsuarioPeticion,
  claseEstadoCuenta,
  claseRol,
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
  private readonly sesion = inject(SesionStore);
  private readonly notificaciones = inject(NotificacionStore);
  private readonly refresco = inject(RefrescoAutomatico);
  private readonly router = inject(Router);

  protected readonly coordinacion = this.sesion.coordinacion;
  protected readonly integrantes = signal<Usuario[]>([]);
  protected readonly cargando = signal(true);

  /**
   * RF-28f, RF-29: operador cuya ficha se esta consultando. La lista dice quien
   * hay, igual que la de Personas del Administrador; editar, restablecer la
   * contrasena, ver sus equipos, desbloquear y dar de baja viven en la ficha.
   */
  protected readonly detalle = signal<Usuario | null>(null);

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

  // ------------------------------------------------------------------ Filtros
  //
  // La misma barra que Personas, Inventario y Prestamos: busqueda a la vista y
  // el estado de la cuenta en el panel de filtros. Los operadores de una
  // coordinacion llegan enteros en una sola consulta, asi que se filtran aqui
  // sin volver a preguntar al servidor.

  protected readonly estadosCuenta = ESTADOS_CUENTA;
  protected texto = '';
  protected estadoFiltro: EstadoCuenta | null = null;
  /** Lo que se aplico con Buscar o Aplicar; tocar los campos no filtra hasta confirmarlo. */
  private readonly textoAplicado = signal('');
  private readonly estadoAplicado = signal<EstadoCuenta | null>(null);

  protected aplicarFiltros(): void {
    this.textoAplicado.set(this.texto.trim().toLowerCase());
    this.estadoAplicado.set(this.estadoFiltro);
  }

  /** El panel se cerró sin aplicar: el campo vuelve a lo que filtra. */
  protected descartarFiltros(): void {
    this.estadoFiltro = this.estadoAplicado();
  }

  protected limpiarFiltros(): void {
    this.texto = '';
    this.estadoFiltro = null;
    this.aplicarFiltros();
  }

  protected quitarFiltro(clave: string): void {
    if (clave === 'estado') {
      this.estadoFiltro = null;
      this.estadoAplicado.set(null);
    }
  }

  /** Indicadores de lo aplicado, visibles también con el panel cerrado. */
  protected get filtrosActivos(): FiltroActivo[] {
    const estado = this.estadoAplicado();
    if (estado === null) {
      return [];
    }
    const etiqueta = ESTADOS_CUENTA.find((e) => e.valor === estado)?.etiqueta ?? estado;
    return [{ clave: 'estado', etiqueta: 'Cuenta', valor: etiqueta }];
  }

  protected get hayFiltros(): boolean {
    return this.textoAplicado() !== '' || this.estadoAplicado() !== null;
  }

  /** Operadores que cumplen la busqueda (nombre, DNI, usuario o correo) y el estado. */
  protected get operadoresFiltrados(): Usuario[] {
    const texto = this.textoAplicado();
    const estado = this.estadoAplicado();
    return this.operadores().filter((u) => {
      if (estado !== null && u.estado !== estado) {
        return false;
      }
      if (!texto) {
        return true;
      }
      return [u.nombreCompleto, u.dni, u.username, u.correo]
        .some((campo) => (campo ?? '').toLowerCase().includes(texto));
    });
  }

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
      this.detalle() !== null ||
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
  }

  protected verDetalle(operador: Usuario): void {
    this.detalle.set(operador);
  }

  protected cerrarDetalle(): void {
    this.detalle.set(null);
  }

  /** RF-84: abre el inventario ya acotado a lo que lleva ese operador. */
  protected verEquiposDe(operador: Usuario): void {
    this.detalle.set(null);
    void this.router.navigate(['/inventario'], { queryParams: { responsable: operador.id } });
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
    this.detalle.set(null);
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
    this.detalle.set(null);
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
  /** RNF-30: el rol, por color Y por texto, igual que en Personas. */
  protected claseDelRol(operador: Usuario): string {
    return claseRol(operador.rol);
  }

  protected claseDelEstado(estado: EstadoCuenta): string {
    return claseEstadoCuenta(estado);
  }

  // ------------------------------------------- RF-06, RF-08: credenciales

  protected pedirRestablecerPassword(usuario: Usuario): void {
    this.detalle.set(null);
    this.confirmandoPassword.set(usuario);
  }

  protected get mensajePassword(): string {
    const usuario = this.confirmandoPassword();
    return usuario ? `Se generará una contraseña nueva para ${usuario.nombreCompleto}.` : '';
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
      ? `${usuario.nombreCompleto} volverá a poder intentar el ingreso ahora mismo.`
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
