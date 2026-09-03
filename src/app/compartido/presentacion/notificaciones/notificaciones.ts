import { Component, inject } from '@angular/core';

import { NotificacionStore } from '../../aplicacion/notificacion.store';

/** Avisos emergentes de la aplicacion. */
@Component({
  selector: 'app-notificaciones',
  standalone: false,
  template: `
    <div class="notificaciones" role="status" aria-live="polite">
      @for (n of store.lista(); track n.id) {
        <div class="notificacion" [class]="'notificación ' + n.tipo">
          <span class="texto">{{ n.mensaje }}</span>
          <button type="button" class="cerrar" (click)="store.cerrar(n.id)" aria-label="Cerrar aviso">
            <app-icono nombre="cerrar" tamano="sm" />
          </button>
        </div>
      }
    </div>
  `,
})
export class Notificaciones {
  protected readonly store = inject(NotificacionStore);
}
