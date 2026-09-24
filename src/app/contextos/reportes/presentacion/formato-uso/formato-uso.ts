import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import {
  erroresDeCampo,
  mensajeError,
} from '../../../../compartido/infraestructura/http/error.interceptor';
import { Equipo } from '../../../inventario/dominio/equipo.model';
import { PrestamosFacade } from '../../../prestamos/aplicacion/prestamos.facade';
import { UsoExterno } from '../../../prestamos/dominio/uso-externo.model';
import { FormatoUsoFacade } from '../../aplicacion/formato-uso.facade';
import { FormatoUsoGenerado } from '../../dominio/formato-uso.model';

/** Lo que muestra la ventana en cada momento. */
export type ModoUsoExterno = 'abrir' | 'cerrar' | 'ver' | 'anular';

/**
 * Uso externo de un equipo (RF-78): el "Formato de registro de uso de equipos
 * de investigación", guardado en la base de datos en dos partes.
 *
 * <ul>
 *   <li><b>abrir</b> — puntos 1 a 5. El equipo pasa a Prestado.</li>
 *   <li><b>cerrar</b> — puntos 6 a 10, con la primera parte a la vista. El
 *       equipo vuelve al servicio.</li>
 *   <li><b>ver</b> — el registro completo, con su PDF para imprimir y firmar
 *       a mano (punto 9).</li>
 * </ul>
 */
@Component({
  selector: 'app-formato-uso',
  standalone: false,
  templateUrl: './formato-uso.html',
})
export class FormatoUso implements OnInit, OnDestroy {
  private readonly prestamos = inject(PrestamosFacade);
  private readonly formatos = inject(FormatoUsoFacade);
  private readonly notificaciones = inject(NotificacionStore);
  private readonly sanitizador = inject(DomSanitizer);

  @Input({ required: true }) equipo!: Equipo;
  /** El registro sobre el que se trabaja; nulo al abrir uno nuevo. */
  @Input() uso: UsoExterno | null = null;
  @Input() modoInicial: ModoUsoExterno = 'abrir';
  /** Solo el Responsable abre y cierra; los demás consultan e imprimen. */
  @Input() puedeGestionar = false;

  @Output() cerrado = new EventEmitter<void>();
  /** Se abrió o se cerró un registro: la ficha tiene que recargarse. */
  @Output() cambiado = new EventEmitter<UsoExterno>();
  /** El uso se anuló y se borró: la ficha recarga y la ventana se cierra. */
  @Output() anulado = new EventEmitter<void>();

  protected readonly modo = signal<ModoUsoExterno>('abrir');
  protected readonly registro = signal<UsoExterno | null>(null);
  protected readonly guardando = signal(false);
  protected readonly generando = signal(false);
  protected readonly errores = signal<Record<string, string>>({});

  protected readonly documento = signal<FormatoUsoGenerado | null>(null);
  protected readonly previa = signal<SafeResourceUrl | null>(null);
  private urlPrevia: string | null = null;


  // ----------------------------------------------- 1. Responsable del equipamiento
  protected encargadoNombre = '';
  protected encargadoCorreo = '';
  protected encargadoCelular = '';
  // ----------------------------------------------- 3. Datos del usuario
  protected usuarioNombre = '';
  protected usuarioCorreo = '';
  protected usuarioTelefono = '';
  // ----------------------------------------------- 4. Proyecto
  protected proyecto = '';
  // ----------------------------------------------- 5. Registro de uso
  // El inicio se escribe a mano, como en el formato en papel.
  protected fechaInicio = '';
  protected horaInicio = '';
  protected fechaFinPrevista = '';
  protected horaFinPrevista = '';
  protected actividad = '';
  // ----------------------------------------------- 6 y 7. Conformidad
  protected entregadoOperativo: boolean | null = null;
  protected devueltoOperativo: boolean | null = null;
  // ----------------------------------------------- 8. Incidentes
  protected incidente = '';
  protected accionCorrectiva = '';
  // ----------------------------------------------- 10. Observaciones
  protected observaciones = '';

  ngOnInit(): void {
    this.registro.set(this.uso);
    this.modo.set(this.uso ? this.modoInicial : 'abrir');
  }

  ngOnDestroy(): void {
    this.liberarPrevia();
  }

  protected get titulo(): string {
    switch (this.modo()) {
      case 'abrir':
        return 'Registrar uso externo';
      case 'cerrar':
        return 'Cerrar uso externo';
      case 'anular':
        return 'Anular uso externo';
      default:
        return `Uso externo N.º ${this.registro()?.id ?? ''}`;
    }
  }

  // --------------------------------------------------------- Parte 1

  protected get aperturaValida(): boolean {
    return (
      !!this.encargadoNombre.trim() &&
      !!this.usuarioNombre.trim() &&
      !!this.fechaInicio &&
      !!this.horaInicio &&
      this.finValido
    );
  }

  /** El fin previsto, si se indica, no puede ser anterior al inicio. */
  protected get finValido(): boolean {
    if (!this.fechaFinPrevista || !this.fechaInicio) {
      return true;
    }
    if (this.fechaFinPrevista !== this.fechaInicio) {
      return this.fechaFinPrevista > this.fechaInicio;
    }
    return !this.horaFinPrevista || !this.horaInicio || this.horaFinPrevista >= this.horaInicio;
  }

  protected abrir(): void {
    if (!this.aperturaValida || this.guardando()) {
      return;
    }
    this.guardando.set(true);
    this.errores.set({});
    this.prestamos
      .abrirUsoExterno(this.equipo.id, {
        encargadoNombre: this.encargadoNombre.trim(),
        encargadoCorreo: this.limpio(this.encargadoCorreo),
        encargadoCelular: this.limpio(this.encargadoCelular),
        usuarioNombre: this.usuarioNombre.trim(),
        usuarioCorreo: this.limpio(this.usuarioCorreo),
        usuarioTelefono: this.limpio(this.usuarioTelefono),
        proyecto: this.limpio(this.proyecto),
        fechaInicio: this.fechaInicio,
        horaInicio: this.horaInicio,
        fechaFinPrevista: this.limpio(this.fechaFinPrevista),
        horaFinPrevista: this.limpio(this.horaFinPrevista),
        actividad: this.limpio(this.actividad),
      })
      .subscribe({
        next: (uso) => {
          this.guardando.set(false);
          this.registro.set(uso);
          this.modo.set('ver');
          this.notificaciones.exito(
            `Uso externo registrado (N.º ${uso.id}): ${uso.equipoNombre} quedó prestado. ` +
              'Cierre el registro cuando el equipo vuelva.',
          );
          this.cambiado.emit(uso);
        },
        error: (error) => this.alFallar(error, 'No se pudo registrar el uso externo.'),
      });
  }

  // --------------------------------------------------------- Parte 2

  protected get cierreValido(): boolean {
    return (
      this.entregadoOperativo !== null &&
      this.devueltoOperativo !== null &&
      (this.devueltoOperativo || !!this.incidente.trim())
    );
  }

  protected irACerrar(): void {
    this.errores.set({});
    this.modo.set('cerrar');
  }

  protected cerrarRegistro(): void {
    const uso = this.registro();
    if (!uso || !this.cierreValido || this.guardando()) {
      return;
    }
    this.guardando.set(true);
    this.errores.set({});
    this.prestamos
      .cerrarUsoExterno(uso.id, {
        entregadoOperativo: this.entregadoOperativo!,
        devueltoOperativo: this.devueltoOperativo!,
        incidente: this.limpio(this.incidente),
        accionCorrectiva: this.limpio(this.accionCorrectiva),
        observaciones: this.limpio(this.observaciones),
      })
      .subscribe({
        next: (cerrado) => {
          this.guardando.set(false);
          this.registro.set(cerrado);
          this.modo.set('ver');
          this.notificaciones.exito(
            cerrado.devueltoOperativo
              ? `Registro de uso cerrado. ${cerrado.equipoNombre} vuelve a estar disponible.`
              : `Registro de uso cerrado. ${cerrado.equipoNombre} queda pendiente de revisión.`,
          );
          this.cambiado.emit(cerrado);
        },
        error: (error) => this.alFallar(error, 'No se pudo cerrar el registro de uso.'),
      });
  }

  // --------------------------------------------------------- Anulación

  /** Pide confirmación antes de anular: el registro se borra. */
  protected pedirAnulacion(): void {
    this.modo.set('anular');
  }

  protected anularRegistro(): void {
    const uso = this.registro();
    if (!uso || this.guardando()) {
      return;
    }
    this.guardando.set(true);
    this.prestamos.anularUsoExterno(uso.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.notificaciones.exito(
          `Uso externo anulado. ${uso.equipoNombre} vuelve a estar disponible.`,
        );
        this.anulado.emit();
      },
      error: (error) => {
        this.guardando.set(false);
        this.notificaciones.error(mensajeError(error, 'No se pudo anular el uso externo.'));
      },
    });
  }

  // --------------------------------------------------------- PDF

  protected verPdf(): void {
    const uso = this.registro();
    if (!uso || this.generando()) {
      return;
    }
    this.generando.set(true);
    this.formatos.generar(uso.id).subscribe({
      next: (generado) => {
        this.liberarPrevia();
        this.urlPrevia = URL.createObjectURL(generado.contenido);
        // Blob del propio origen recién creado: Angular exige declararlo para un marco.
        this.previa.set(this.sanitizador.bypassSecurityTrustResourceUrl(this.urlPrevia));
        this.documento.set(generado);
        this.generando.set(false);
      },
      error: (error) => {
        this.generando.set(false);
        this.notificaciones.error(mensajeError(error, 'No se pudo generar el PDF.'));
      },
    });
  }

  protected volverDelPdf(): void {
    this.liberarPrevia();
    this.documento.set(null);
    this.previa.set(null);
  }

  protected descargar(): void {
    const generado = this.documento();
    if (generado) {
      this.formatos.descargar(generado);
    }
  }

  protected cerrar(): void {
    this.liberarPrevia();
    this.cerrado.emit();
  }

  protected siNo(valor: boolean | null | undefined): string {
    return valor === true ? 'Sí' : valor === false ? 'No' : '—';
  }

  // --------------------------------------------------------- Apoyo

  private alFallar(error: unknown, mensaje: string): void {
    this.guardando.set(false);
    this.errores.set(erroresDeCampo(error));
    this.notificaciones.error(mensajeError(error, mensaje));
  }

  /** El campo vacío viaja como nulo, no como cadena vacía. */
  private limpio(valor: string): string | null {
    const texto = valor.trim();
    return texto.length > 0 ? texto : null;
  }

  private liberarPrevia(): void {
    if (this.urlPrevia) {
      URL.revokeObjectURL(this.urlPrevia);
      this.urlPrevia = null;
    }
  }
}
