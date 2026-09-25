import { Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { OpcionPestana } from '../../../../compartido/presentacion/pestanas/pestanas';
import { RefrescoAutomatico } from '../../../../compartido/aplicacion/refresco-automatico';
import { mensajeError } from '../../../../compartido/infraestructura/http/error.interceptor';
import { SesionStore } from '../../../iam/aplicacion/sesion.store';
import { PrestamosFacade } from '../../../prestamos/aplicacion/prestamos.facade';
import { Prestamo } from '../../../prestamos/dominio/prestamo.model';
import { UsoExterno } from '../../../prestamos/dominio/uso-externo.model';
import { ModoUsoExterno } from '../../../reportes/presentacion/formato-uso/formato-uso';
import { InventarioFacade } from '../../aplicacion/inventario.facade';
import {
  Equipo,
  admiteBaja,
  admiteEdicion,
  admiteMantenimiento,
  admiteRetornoOperativo,
} from '../../dominio/equipo.model';
import {
  Movimiento,
  TipoMovimiento,
  claseMovimiento,
  iconoMovimiento,
} from '../../dominio/movimiento.model';

type AccionCondicion = 'mantenimiento' | 'operativo' | 'baja';

type PestanaFicha = 'equipo' | 'prestamos' | 'usos' | 'historial';


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
  private readonly sanitizador = inject(DomSanitizer);

  protected readonly esResponsable = this.sesion.esResponsable;
  /** El Administrador no ve titulo ni descripcion de pagina. */
  protected readonly esAdmin = this.sesion.esAdmin;

  protected readonly equipo = signal<Equipo | null>(null);
  protected readonly movimientos = signal<Movimiento[]>([]);
  protected readonly historialPrestamos = signal<Prestamo[]>([]);
  /** RF-78: usos externos del equipo, el más reciente primero. */
  protected readonly usosExternos = signal<UsoExterno[]>([]);
  protected readonly cargando = signal(true);
  protected readonly procesando = signal(false);
  protected readonly accionPendiente = signal<AccionCondicion | null>(null);

  /** Pestaña visible de la ficha: un tema a la vez. */
  protected readonly pestana = signal<PestanaFicha>('equipo');

  /**
   * Las pestañas de la ficha, en su orden. Cada una lleva su icono y, salvo la
   * del equipo, cuántos registros tiene: se sabe si hay algo que mirar antes
   * de abrirla.
   */
  protected readonly pestanas = computed<OpcionPestana<PestanaFicha>[]>(() => [
    { id: 'equipo', etiqueta: 'Equipo', icono: 'inventario', contador: null },
    { id: 'prestamos', etiqueta: 'Préstamos', icono: 'prestamos', contador: this.historialPrestamos().length },
    { id: 'usos', etiqueta: 'Usos externos', icono: 'relevo', contador: this.usosExternos().length },
    { id: 'historial', etiqueta: 'Historial', icono: 'reloj', contador: this.hitos().length },
  ]);

  /** RF-66b: prestamo cuyo detalle se esta consultando. */
  protected readonly prestamoDetalle = signal<Prestamo | null>(null);

  /** RF-78: ventana del uso externo, abierta sobre la ficha. */
  protected readonly formatoAbierto = signal(false);
  protected readonly usoElegido = signal<UsoExterno | null>(null);
  protected readonly modoUso = signal<ModoUsoExterno>('abrir');

  /** El uso externo en curso, si lo hay: mientras dure, el equipo está fuera. */
  protected readonly usoAbierto = computed(
    () => this.usosExternos().find((uso) => uso.estado === 'ABIERTO') ?? null,
  );

  /** RF-42: PDF elegido para sustentar la baja y su error de validación. */
  protected readonly documentoBaja = signal<File | null>(null);
  protected readonly errorDocumento = signal<string | null>(null);
  /** Un archivo se está arrastrando sobre la zona del PDF. */
  protected readonly arrastrandoDocumento = signal(false);
  /** Vista previa del PDF elegido, antes de enviarlo: confirma que es el documento correcto. */
  protected readonly previaBaja = signal<SafeResourceUrl | null>(null);
  private urlPreviaBaja: string | null = null;

  /** RF-42: vista previa del PDF de la baja. */
  protected readonly previaDocumento = signal<SafeResourceUrl | null>(null);
  protected readonly cargandoDocumento = signal(false);
  private urlDocumento: string | null = null;

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
        this.previaDocumento() === null &&
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

    // RF-78: usos externos del bien, guardados como parte de su historia.
    this.prestamos.usosExternos(this.id).subscribe({
      next: (lista) => this.usosExternos.set(lista),
      error: () => this.usosExternos.set([]),
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

  // ------------------------------------------- RF-78: uso externo

  /**
   * Uso externo: el equipo se presta para que lo use, dentro de la
   * institución, personal de otra institución con su encargado. Se registra
   * en dos partes y queda guardado; el PDF se imprime para firmarlo a mano.
   * Lo gestiona el Responsable, que es quien responde por el equipo.
   */
  protected get puedeGestionarUso(): boolean {
    return this.equipo() !== null && this.esResponsable();
  }

  /** Abrir un uso nuevo exige un equipo disponible y ningún uso en curso. */
  protected get puedeAbrirUso(): boolean {
    const equipo = this.equipo();
    return (
      !!equipo &&
      this.esResponsable() &&
      equipo.condicion === 'OPERATIVO' &&
      this.usoAbierto() === null
    );
  }

  protected abrirUsoExterno(): void {
    this.usoElegido.set(null);
    this.modoUso.set('abrir');
    this.formatoAbierto.set(true);
  }

  protected verUsoExterno(uso: UsoExterno, modo: ModoUsoExterno = 'ver'): void {
    this.usoElegido.set(uso);
    this.modoUso.set(modo);
    this.formatoAbierto.set(true);
  }

  protected cerrarFormatoDeUso(): void {
    this.formatoAbierto.set(false);
    this.usoElegido.set(null);
  }

  /** El uso se anuló: se cierra la ventana y la ficha vuelve a su estado normal. */
  protected alAnularUso(): void {
    this.cerrarFormatoDeUso();
    this.cargar(true);
  }

  /** Se abrió o se cerró un uso: cambian la condición y el historial del equipo. */
  protected alCambiarUso(): void {
    this.cargar(true);
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

  protected pedirAccion(accion: AccionCondicion): void {
    this.limpiarDocumentoBaja();
    this.accionPendiente.set(accion);
  }

  // ------------------------------------------- RF-42: baja con documento PDF

  /**
   * Solo un PDF de hasta 5 MB; el servidor lo vuelve a comprobar. Si es
   * válido, se muestra en la ventana para confirmar que es el documento
   * correcto antes de dar de baja el equipo. Nada se envía hasta confirmar.
   */
  protected async alElegirDocumento(evento: Event): Promise<void> {
    const campo = evento.target as HTMLInputElement;
    await this.recibirDocumento(campo.files?.[0] ?? null);
    // Se vacía siempre: así elegir otra vez el mismo archivo vuelve a disparar el cambio.
    campo.value = '';
  }

  /** Arrastrar el PDF sobre la zona equivale a elegirlo. */
  protected async alSoltarDocumento(evento: DragEvent): Promise<void> {
    evento.preventDefault();
    this.arrastrandoDocumento.set(false);
    if (!this.procesando()) {
      await this.recibirDocumento(evento.dataTransfer?.files?.[0] ?? null);
    }
  }

  protected alArrastrarDocumento(evento: DragEvent, encima: boolean): void {
    evento.preventDefault();
    this.arrastrandoDocumento.set(encima && !this.procesando());
  }

  /** Retira el PDF elegido sin cerrar la ventana. */
  protected quitarDocumento(): void {
    if (!this.procesando()) {
      this.limpiarDocumentoBaja();
    }
  }

  private async recibirDocumento(archivo: File | null): Promise<void> {
    this.limpiarDocumentoBaja();
    if (!archivo) {
      return;
    }
    const esPdf = archivo.type === 'application/pdf' || archivo.name.toLowerCase().endsWith('.pdf');
    if (!esPdf) {
      this.errorDocumento.set('Solo se admite un archivo PDF.');
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      this.errorDocumento.set('El PDF no puede superar los 5 MB.');
      return;
    }
    // Un archivo renombrado a .pdf no es un PDF: se miran sus primeros bytes.
    const cabecera = await archivo.slice(0, 5).text();
    if (cabecera !== '%PDF-') {
      this.errorDocumento.set('El archivo no es un PDF válido.');
      return;
    }
    this.documentoBaja.set(archivo);
    this.urlPreviaBaja = URL.createObjectURL(archivo);
    // Blob local recién creado por esta pantalla: Angular exige declararlo para un marco.
    this.previaBaja.set(this.sanitizador.bypassSecurityTrustResourceUrl(this.urlPreviaBaja));
  }

  /** Olvida el PDF elegido y libera su vista previa. */
  private limpiarDocumentoBaja(): void {
    if (this.urlPreviaBaja) {
      URL.revokeObjectURL(this.urlPreviaBaja);
      this.urlPreviaBaja = null;
    }
    this.previaBaja.set(null);
    this.documentoBaja.set(null);
    this.errorDocumento.set(null);
  }

  protected tamanoLegible(bytes: number): string {
    return bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  protected confirmarBaja(): void {
    const documento = this.documentoBaja();
    if (!documento || this.procesando()) {
      return;
    }
    this.procesando.set(true);
    this.inventario.darDeBaja(this.id, documento).subscribe({
      next: (actualizado) => {
        this.notificaciones.exito(`${actualizado.nombre} quedó dado de baja.`);
        this.procesando.set(false);
        this.accionPendiente.set(null);
        this.limpiarDocumentoBaja();
        this.cargar(true);
      },
      error: (error) => {
        this.procesando.set(false);
        this.errorDocumento.set(mensajeError(error, 'No se pudo dar de baja el equipo.'));
      },
    });
  }

  protected cancelarBaja(): void {
    if (!this.procesando()) {
      this.accionPendiente.set(null);
      this.limpiarDocumentoBaja();
    }
  }

  /** Muestra el PDF de la baja dentro de la ficha, igual que el del uso externo. */
  protected verDocumentoBaja(): void {
    const ruta = this.equipo()?.documentoBajaUrl;
    if (!ruta || this.cargandoDocumento()) {
      return;
    }
    this.cargandoDocumento.set(true);
    this.inventario.descargarDocumento(ruta).subscribe({
      next: (blob) => {
        this.liberarDocumento();
        this.urlDocumento = URL.createObjectURL(blob);
        // Blob del propio origen recién creado: Angular exige declararlo para un marco.
        this.previaDocumento.set(this.sanitizador.bypassSecurityTrustResourceUrl(this.urlDocumento));
        this.cargandoDocumento.set(false);
      },
      error: (error) => {
        this.cargandoDocumento.set(false);
        this.notificaciones.error(mensajeError(error, 'No se pudo abrir el documento de baja.'));
      },
    });
  }

  protected descargarDocumentoBaja(): void {
    const equipo = this.equipo();
    if (!this.urlDocumento || !equipo) {
      return;
    }
    const enlace = document.createElement('a');
    enlace.href = this.urlDocumento;
    enlace.download = `baja-${equipo.codigoInventario.replace(/[^A-Za-z0-9._-]/g, '-')}.pdf`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  }

  protected cerrarDocumentoBaja(): void {
    this.liberarDocumento();
    this.previaDocumento.set(null);
  }

  private liberarDocumento(): void {
    if (this.urlDocumento) {
      URL.revokeObjectURL(this.urlDocumento);
      this.urlDocumento = null;
    }
  }

  protected get tituloAccion(): string {
    switch (this.accionPendiente()) {
      case 'mantenimiento':
        return 'Enviar a mantenimiento';
      case 'operativo':
        return 'Devolver a condición operativa';
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
        return `${nombre} pasará a "En mantenimiento" y dejará de estar disponible para préstamo.`;
      case 'operativo':
        return `${nombre} volverá a estar disponible para préstamo.`;
      default:
        return '';
    }
  }

  protected confirmarAccion(motivo: string): void {
    const accion = this.accionPendiente();
    if (!accion || this.procesando()) {
      return;
    }
    this.procesando.set(true);

    // La baja no pasa por aqui: se sustenta con un PDF en su propia ventana.
    const peticion =
      accion === 'mantenimiento'
        ? this.inventario.enviarAMantenimiento(this.id, motivo)
        : this.inventario.devolverAOperativo(this.id, motivo);

    peticion.subscribe({
      next: (actualizado) => {
        this.notificaciones.exito(
          `${actualizado.nombre} quedo en condición ${actualizado.condicionEtiqueta}.`,
        );
        this.procesando.set(false);
        this.accionPendiente.set(null);
        this.cargar(true);
      },
      error: (error) => {
        this.notificaciones.error(mensajeError(error));
        this.procesando.set(false);
        this.accionPendiente.set(null);
      },
    });
  }
}
