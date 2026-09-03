import { Component, EventEmitter, Input, OnDestroy, Output, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { mensajeError } from '../../../../compartido/infraestructura/http/error.interceptor';
import { Equipo } from '../../../inventario/dominio/equipo.model';
import { FormatoUsoFacade } from '../../aplicacion/formato-uso.facade';
import { FormatoUsoGenerado, FormatoUsoPeticion } from '../../dominio/formato-uso.model';

/**
 * Formato de registro de uso de equipos de investigacion (RF-78, RF-79).
 *
 * <p>Es el papel que el laboratorio hace firmar cuando un equipo sale a
 * trabajar, y hasta ahora se rellenaba a mano en un documento aparte, con los
 * datos del equipo copiados de donde se pudiera. Aqui los pone el sistema
 * —codigo patrimonial, marca, modelo, serie, valor y la condicion en que el
 * bien esta ahora mismo— y la persona escribe lo que solo ella sabe.</p>
 *
 * <p><b>Genera un documento y nada mas (RN-36).</b> No registra el prestamo,
 * no toca el historial del bien y no cambia su condicion: el equipo sigue
 * Operativo despues de emitirlo. Por eso la pantalla lo dice dos veces —en la
 * vista previa y al descargar—: quien emite el formato tiene que acordarse de
 * registrar despues la salida en el sistema (RF-59), que es lo unico que
 * deja constancia de que el equipo no esta.</p>
 *
 * <p>Dos pasos: se rellena, y despues se ve el PDF entero antes de
 * descargarlo. Un formato que se firma no se descarga a ciegas.</p>
 */
@Component({
  selector: 'app-formato-uso',
  standalone: false,
  templateUrl: './formato-uso.html',
})
export class FormatoUso implements OnDestroy {
  private readonly formatos = inject(FormatoUsoFacade);
  private readonly notificaciones = inject(NotificacionStore);
  private readonly sanitizador = inject(DomSanitizer);
  private readonly router = inject(Router);

  /** Equipo cuyo formato se emite; sus datos van impresos en el documento. */
  @Input({ required: true }) equipo!: Equipo;

  @Output() cerrado = new EventEmitter<void>();

  protected readonly generando = signal(false);
  /** El PDF ya generado, a la espera de que se lea y se descargue. */
  protected readonly documento = signal<FormatoUsoGenerado | null>(null);
  protected readonly previa = signal<SafeResourceUrl | null>(null);
  protected readonly descargado = signal(false);

  /** URL temporal del blob; se libera al cerrar para no dejarla colgando. */
  private urlPrevia: string | null = null;

  // ------------------------------------------------- 1. Responsable (manual)
  protected investigadorEncargado = '';
  protected correoEncargado = '';
  protected celularEncargado = '';

  // ----------------------------------------------- 3. Datos del usuario
  protected nombreInvestigador = '';
  protected correoInvestigador = '';
  protected telefonoInvestigador = '';

  // ------------------------------------------------------- 4. Proyecto
  protected proyecto = '';

  // -------------------------------------------------- 5. Registro de uso
  // El inicio no se pregunta: es el momento en que se emite el documento, y
  // lo pone el reloj del servidor (RF-78).
  protected fechaFinUso = '';
  protected horaFinUso = '';
  protected actividadRealizada = '';

  // ------------------------------------------ 6 y 7. Entrega y devolucion
  protected entregadoOperativo: boolean | null = null;
  protected devueltoOperativo: boolean | null = null;

  // ------------------------------------------------------ 8. Incidentes
  protected incidente = '';
  protected accionCorrectiva = '';

  // ---------------------------------------------------- 10. Observaciones
  protected observaciones = '';

  ngOnDestroy(): void {
    this.liberarPrevia();
  }

  /** RF-78: el documento se ve entero antes de bajarlo (RF-79). */
  protected verVistaPrevia(): void {
    if (this.generando()) {
      return;
    }
    this.generando.set(true);
    this.formatos.generar(this.equipo.id, this.peticion).subscribe({
      next: (generado) => {
        this.liberarPrevia();
        this.urlPrevia = URL.createObjectURL(generado.contenido);
        // El blob es del propio origen y lo acaba de crear esta pantalla: no
        // hay nada que sanear, pero Angular exige declararlo explicitamente
        // para poder ponerlo en el src de un marco.
        this.previa.set(this.sanitizador.bypassSecurityTrustResourceUrl(this.urlPrevia));
        this.documento.set(generado);
        this.descargado.set(false);
        this.generando.set(false);
      },
      error: (error) => {
        this.generando.set(false);
        this.notificaciones.error(mensajeError(error, 'No se pudo generar el formato.'));
      },
    });
  }

  /** Vuelve al formulario conservando lo escrito. */
  protected volverAEditar(): void {
    this.liberarPrevia();
    this.documento.set(null);
    this.previa.set(null);
  }

  /**
   * Descarga el PDF que ya esta generado, sin volver a pedirlo.
   *
   * <p>Y recuerda, en el mismo acto, lo que el documento no hace: el equipo
   * sigue figurando donde estaba y la salida no consta en ninguna parte hasta
   * que se registre el prestamo (RF-79).</p>
   */
  protected descargar(): void {
    const generado = this.documento();
    if (!generado) {
      return;
    }
    this.formatos.descargar(generado);
    this.descargado.set(true);
    this.notificaciones.alerta(
      'Formato descargado. Recuerde registrar el préstamo del equipo: este documento no lo registra.',
    );
  }

  /** Lleva a registrar la salida de verdad, que es lo que el formato no hace. */
  protected irARegistrarPrestamo(): void {
    this.cerrar();
    void this.router.navigate(['/prestamos/nuevo']);
  }

  protected cerrar(): void {
    this.liberarPrevia();
    this.cerrado.emit();
  }

  /** Nada es obligatorio: el formato se imprime y se acaba de rellenar a mano. */
  private get peticion(): FormatoUsoPeticion {
    return {
      investigadorEncargado: this.limpio(this.investigadorEncargado),
      correoEncargado: this.limpio(this.correoEncargado),
      celularEncargado: this.limpio(this.celularEncargado),
      nombreInvestigador: this.limpio(this.nombreInvestigador),
      correoInvestigador: this.limpio(this.correoInvestigador),
      telefonoInvestigador: this.limpio(this.telefonoInvestigador),
      proyecto: this.limpio(this.proyecto),
      fechaFinUso: this.limpio(this.fechaFinUso),
      horaFinUso: this.limpio(this.horaFinUso),
      actividadRealizada: this.limpio(this.actividadRealizada),
      entregadoOperativo: this.entregadoOperativo,
      devueltoOperativo: this.devueltoOperativo,
      incidente: this.limpio(this.incidente),
      accionCorrectiva: this.limpio(this.accionCorrectiva),
      observaciones: this.limpio(this.observaciones),
    };
  }

  /**
   * El campo vacio viaja como nulo, no como cadena vacia: una fecha en blanco
   * no es una fecha de cero caracteres, y el servidor la espera ausente.
   */
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
