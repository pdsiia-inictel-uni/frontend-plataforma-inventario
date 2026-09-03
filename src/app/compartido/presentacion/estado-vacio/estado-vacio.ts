import { Component, Input } from '@angular/core';

import { NombreIcono } from '../icono/icono';

/**
 * Estado vacio explicativo (RNF-24).
 *
 * <p>Una tabla en blanco deja al usuario sin saber si el sistema fallo, si
 * filtro de mas o si aun no hay nada. Este bloque responde siempre a las dos
 * preguntas: que pasa y cual es el siguiente paso concreto.</p>
 */
@Component({
  selector: 'app-estado-vacio',
  standalone: false,
  template: `
    <div class="estado-vacio">
      <app-icono [nombre]="icono" tamano="lg" />
      <h3>{{ titulo }}</h3>
      @if (mensaje) {
        <p class="texto-secundario">{{ mensaje }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class EstadoVacio {
  @Input() titulo = 'Aun no hay nada que mostrar';
  @Input() mensaje = '';
  @Input() icono: NombreIcono = 'inventario';
}
