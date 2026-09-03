import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { RefrescoAutomatico } from '../../../../compartido/aplicacion/refresco-automatico';
import { mensajeError } from '../../../../compartido/infraestructura/http/error.interceptor';
import { SesionStore } from '../../../iam/aplicacion/sesion.store';
import { PrestamosFacade } from '../../../prestamos/aplicacion/prestamos.facade';
import { Prestamo } from '../../../prestamos/dominio/prestamo.model';
import { InventarioFacade } from '../../aplicacion/inventario.facade';
import {
  Equipo,
  admiteBaja,
  admiteEdicion,
  admiteMantenimiento,
  admiteReincorporacion,
  admiteRetornoOperativo,
} from '../../dominio/equipo.model';
import {
  Movimiento,
  TipoMovimiento,
  claseMovimiento,
  iconoMovimiento,
} from '../../dominio/movimiento.model';

type AccionCondicion = 'mantenimiento' | 'operativo' | 'baja' | 'reincorporar';

/**
 * Movimientos que la linea de tiempo no repite (v3.9).
 *
 * <p>Los prestamos y las devoluciones tienen su propia tabla en esta misma
 * ficha, con la persona, las fechas y las observaciones de las dos puntas; en
 * la linea de tiempo aparecian otra vez y con menos datos, de modo que la
 * misma salida se leia dos veces y ninguna de las dos estaba completa.</p>
 *
 * <p>La <b>edicion</b> se retira por otra razon: la linea de tiempo cuenta lo
 * que le paso al equipo —donde estuvo, en que condicion, con quien—, y quien
 * corrigio un modelo mal escrito no es parte de esa historia. El dato sigue
 * registrado en el historial inmutable del bien, que no se toca (RN-21): lo
 * que cambia es que la ficha no lo muestra.</p>
 */
const MOVIMIENTOS_OCULTOS: readonly TipoMovimiento[] = ['PRESTAMO', 'DEVOLUCION', 'EDICION'];

/**
 * Ficha del bien con su linea de tiempo (RF-56, RF-57).
 *
 * <p>El historial se muestra en orden cronologico inverso y con lenguaje
 * claro: el usuario no deberia tener que interpretar codigos de estado para
 * saber que le paso al equipo.</p>
 */
@Component({
  selector: 'app-detalle-bien',
  standalone: false,
  templateUrl: './detalle-bien.html',
})
export class DetalleBien {
  private readonly inventario = inject(InventarioFacade);
  private readonly prestamos = inject(PrestamosFacade);
  private readonly sesion = inject(SesionStore);
  private readonly notificaciones = inject(NotificacionStore);
  private readonly refresco = inject(RefrescoAutomatico);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly esResponsable = this.sesion.esResponsable;

  protected readonly equipo = signal<Equipo | null>(null);
  protected readonly movimientos = signal<Movimiento[]>([]);
  protected readonly historialPrestamos = signal<Prestamo[]>([]);
  protected readonly cargando = signal(true);
  protected readonly procesando = signal(false);
  protected readonly accionPendiente = signal<AccionCondicion | null>(null);

  /** RF-66b: prestamo cuyo detalle se esta consultando. */
  protected readonly prestamoDetalle = signal<Prestamo | null>(null);

  /** RF-78: formato de registro de uso, abierto sobre la ficha. */
  protected readonly formatoAbierto = signal(false);

  /** RF-83: ventana de cambio del responsable del equipo. */
  protected readonly responsableAbierto = signal(false);

  /**
   * Lo que la linea de tiempo muestra: el ciclo de vida del equipo, sin lo
   * que ya cuenta la tabla de prestamos ni las correcciones de datos.
   */
  protected readonly hitos = computed(() =>
    this.movimientos().filter((movimiento) => !MOVIMIENTOS_OCULTOS.includes(movimiento.tipo)),
  );

  protected readonly iconoDe = iconoMovimiento;
  protected readonly claseDe = claseMovimiento;

  private readonly id = Number(this.ruta.snapshot.paramMap.get('id'));

  constructor() {
    this.cargar();

    // La condicion del equipo y su linea de tiempo cambian con lo que hagan
    // los demas: si alguien lo presta mientras esta ficha esta abierta, lo que
    // se lee aqui deja de ser cierto sin que nada lo diga.
    this.refresco.alRefrescar(() => {
      // RNF-48: nada se recarga por debajo de una ventana abierta.
      if (
        this.accionPendiente() === null &&
        this.prestamoDetalle() === null &&
        !this.responsableAbierto() &&
        !this.formatoAbierto() &&
        !this.procesando()
      ) {
        this.cargar(true);
      }
    });
  }

  /**
   * @param silencioso recarga de fondo: sin indicador de carga, sin avisos de
   *                   error y, sobre todo, sin sacar al usuario de la ficha.
   *                   Un fallo pasajero del servidor no puede cerrar una
   *                   pantalla que el usuario esta leyendo.
   */
  protected cargar(silencioso = false): void {
    if (!silencioso) {
      this.cargando.set(true);
    }
    this.inventario.obtener(this.id).subscribe({
      next: (equipo) => {
        this.equipo.set(equipo);
        this.cargando.set(false);
      },
      error: (error) => {
        this.cargando.set(false);
        if (silencioso) {
          return;
        }
        this.notificaciones.error(mensajeError(error, 'No se pudo cargar el equipo.'));
        void this.router.navigate(['/inventario']);
      },
    });

    this.inventario.historial(this.id).subscribe({
      next: (lista) => this.movimientos.set(lista),
      error: () => this.movimientos.set([]),
    });

    // RF-66: historial de prestamos del bien, dentro del alcance del usuario.
    this.prestamos.historialPorBien(this.id).subscribe({
      next: (lista) => this.historialPrestamos.set(lista),
      error: () => this.historialPrestamos.set([]),
    });
  }

  protected volver(): void {
    void this.router.navigate(['/inventario']);
  }

  // ---------------------------------------------------- RF-66b: un prestamo

  /**
   * Abre el detalle de una salida del equipo.
   *
   * <p>La tabla responde a "cuantas veces salio y con quien"; el detalle, a
   * "que se dijo al entregarlo y que se dijo al recibirlo, y quien firmo cada
   * una de las dos cosas". Las observaciones de salida y de retorno son la
   * unica constancia del estado en que el bien fue y volvio (RN-18), y hasta
   * la v3.8 no se veian en ninguna pantalla de la ficha.</p>
   */
  protected verPrestamo(prestamo: Prestamo): void {
    this.prestamoDetalle.set(prestamo);
  }

  protected cerrarPrestamo(): void {
    this.prestamoDetalle.set(null);
  }

  // ------------------------------------------- RF-78: formato de uso en PDF

  /**
   * El formato de registro de uso que el laboratorio hace firmar.
   *
   * <p>Solo lo emite el Responsable, que es quien lo firma como coordinador.
   * Genera un PDF y nada mas: no registra el prestamo, no deja movimiento en
   * el historial y no cambia la condicion del bien (RN-36). La ventana lo
   * recuerda al enseñar el documento y al descargarlo, porque el papel firmado
   * y el registro del sistema son dos cosas distintas y hay que hacer las
   * dos.</p>
   */
  protected get puedeEmitirFormato(): boolean {
    return this.equipo() !== null && this.esResponsable();
  }

  protected abrirFormatoDeUso(): void {
    this.formatoAbierto.set(true);
  }

  protected cerrarFormatoDeUso(): void {
    this.formatoAbierto.set(false);
  }

  // -------------------------------------- RF-83: responsable del equipo

  /**
   * Solo el Responsable reparte los equipos de su coordinación (RN-37), y un
   * bien dado de baja no está a cargo de nadie: no hay nada que repartir.
   */
  protected get puedeCambiarResponsable(): boolean {
    const equipo = this.equipo();
    return !!equipo && this.esResponsable() && equipo.activo;
  }

  protected abrirResponsableDeEquipo(): void {
    this.responsableAbierto.set(true);
  }

  protected cerrarResponsableDeEquipo(): void {
    this.responsableAbierto.set(false);
  }

  protected alCambiarResponsable(actualizado: Equipo): void {
    this.responsableAbierto.set(false);
    // La ficha se repinta con lo que devolvio el servidor y el historial gana
    // el movimiento del cambio, asi que se recarga entera.
    this.equipo.set(actualizado);
    this.cargar(true);
  }

  protected editar(): void {
    void this.router.navigate(['/inventario', this.id, 'editar']);
  }

  // ------------------------------------------------- Acciones de condicion

  protected get puedeEditar(): boolean {
    const equipo = this.equipo();
    return !!equipo && this.esResponsable() && admiteEdicion(equipo);
  }

  protected get puedeMantenimiento(): boolean {
    const equipo = this.equipo();
    return !!equipo && this.esResponsable() && admiteMantenimiento(equipo);
  }

  protected get puedeRetornoOperativo(): boolean {
    const equipo = this.equipo();
    return !!equipo && this.esResponsable() && admiteRetornoOperativo(equipo);
  }

  protected get puedeBaja(): boolean {
    const equipo = this.equipo();
    return !!equipo && this.esResponsable() && admiteBaja(equipo);
  }

  protected get puedeReincorporar(): boolean {
    const equipo = this.equipo();
    return !!equipo && this.esResponsable() && admiteReincorporacion(equipo);
  }

  protected pedirAccion(accion: AccionCondicion): void {
    this.accionPendiente.set(accion);
  }

  protected get tituloAccion(): string {
    switch (this.accionPendiente()) {
      case 'mantenimiento':
        return 'Enviar a mantenimiento';
      case 'operativo':
        return 'Devolver a condición operativa';
      case 'baja':
        return 'Dar de baja el equipo';
      case 'reincorporar':
        return 'Reincorporar al inventario';
      default:
        return '';
    }
  }

  protected get mensajeAccion(): string {
    const equipo = this.equipo();
    if (!equipo) {
      return '';
    }
    const nombre = `${equipo.nombre} (${equipo.codigoInventario})`;
    switch (this.accionPendiente()) {
      case 'mantenimiento':
        return `${nombre} pasara a "En mantenimiento" y dejara de estar disponible para prestamo.`;
      case 'operativo':
        return `${nombre} volvera a estar disponible para prestamo.`;
      case 'baja':
        return `Se dara de baja ${nombre}. Dejara de aparecer en el inventario operativo, pero se conservara en el historial.`;
      default:
        return `${nombre} volvera al inventario en condicion Operativo.`;
    }
  }

  protected get accionEsPeligrosa(): boolean {
    return this.accionPendiente() === 'baja';
  }

  protected confirmarAccion(motivo: string): void {
    const accion = this.accionPendiente();
    if (!accion || this.procesando()) {
      return;
    }
    this.procesando.set(true);

    const peticion =
      accion === 'mantenimiento'
        ? this.inventario.enviarAMantenimiento(this.id, motivo)
        : accion === 'operativo'
          ? this.inventario.devolverAOperativo(this.id, motivo)
          : accion === 'baja'
            ? this.inventario.darDeBaja(this.id, motivo)
            : this.inventario.reincorporar(this.id, motivo);

    peticion.subscribe({
      next: (actualizado) => {
        this.notificaciones.exito(
          `${actualizado.nombre} quedo en condicion ${actualizado.condicionEtiqueta}.`,
        );
        this.procesando.set(false);
        this.accionPendiente.set(null);
        this.cargar();
      },
      error: (error) => {
        this.notificaciones.error(mensajeError(error));
        this.procesando.set(false);
        this.accionPendiente.set(null);
      },
    });
  }
}
