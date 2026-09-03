import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { PanelControl } from '../dominio/panel.model';
import { PanelPuerto } from '../dominio/puertos';

/** Indicadores del panel de control (RF-32). */
@Injectable({ providedIn: 'root' })
export class PanelFacade {
  private readonly panel = inject(PanelPuerto);

  resumen(): Observable<PanelControl> {
    return this.panel.resumen();
  }
}
