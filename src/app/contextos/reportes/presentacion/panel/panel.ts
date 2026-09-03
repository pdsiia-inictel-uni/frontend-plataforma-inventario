import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { NotificacionStore } from '../../../../compartido/aplicacion/notificacion.store';
import { RefrescoAutomatico } from '../../../../compartido/aplicacion/refresco-automatico';
import { mensajeError } from '../../../../compartido/infraestructura/http/error.interceptor';
import { SesionStore } from '../../../iam/aplicacion/sesion.store';
import { PanelFacade } from '../../aplicacion/panel.facade';
import { Conteo, PanelControl } from '../../dominio/panel.model';

/**
 * Panel de control (RF-75 .. RF-77).
 *
 * <p>Un solo componente con tres caras, porque los tres roles preguntan cosas
 * distintas: el Administrador quiere saber si la institucion esta bien
 * armada, el Responsable como esta su inventario y el Operador que puede
 * hacer ahora mismo.</p>
 */
@Component({
  selector: 'app-panel',
  standalone: false,
  templateUrl: './panel.html',
})
export class Panel {
  private readonly panel = inject(PanelFacade);
  private readonly sesion = inject(SesionStore);
  private readonly notificaciones = inject(NotificacionStore);
  private readonly refresco = inject(RefrescoAutomatico);
  private readonly router = inject(Router);

  protected readonly esAdmin = this.sesion.esAdmin;
  protected readonly esResponsable = this.sesion.esResponsable;
  protected readonly esOperador = this.sesion.esOperador;
  protected readonly usuario = this.sesion.usuario;

  protected readonly resumen = signal<PanelControl | null>(null);
  protected readonly cargando = signal(true);

  constructor() {
    this.cargar();
    // Un panel es un recuento: nace viejo. Lo que cuenta —equipos prestados,
    // vencidos, coordinaciones sin responsable— lo cambia otra persona en otra
    // pantalla, y el numero que se queda quieto no avisa de que ya no es cierto.
    this.refresco.alRefrescar(() => this.cargar(true));
  }

  /**
   * @param silencioso recarga de fondo: sin indicador de carga ni avisos de
   *                   error, para no interrumpir a quien esta leyendo.
   */
  protected cargar(silencioso = false): void {
    if (!silencioso) {
      this.cargando.set(true);
    }
    this.panel.resumen().subscribe({
      next: (resumen) => {
        this.resumen.set(resumen);
        this.cargando.set(false);
      },
      error: (error) => {
        if (!silencioso) {
          this.notificaciones.error(mensajeError(error, 'No se pudo cargar el panel.'));
        }
        this.cargando.set(false);
      },
    });
  }

  /** Proporcion de una barra respecto al mayor valor de su serie. */
  protected porcentaje(conteo: Conteo, serie: Conteo[]): number {
    const mayor = Math.max(...serie.map((c) => c.cantidad), 1);
    return Math.round((conteo.cantidad / mayor) * 100);
  }

  protected irA(ruta: string, parametros?: Record<string, string>): void {
    void this.router.navigate([ruta], parametros ? { queryParams: parametros } : {});
  }

  protected registrarEquipo(): void {
    void this.router.navigate(['/inventario/nuevo']);
  }

  protected registrarPrestamo(): void {
    void this.router.navigate(['/prestamos/nuevo']);
  }
}
