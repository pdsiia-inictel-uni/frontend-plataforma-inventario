import { Component, Input } from '@angular/core';

/**
 * Progreso visible de un formulario por pasos (RNF-28).
 *
 * <p>El registro de un bien y el relevo de responsable se dividen en pasos
 * cortos; sin una barra de progreso el usuario no sabe cuanto le falta ni
 * puede volver sobre lo ya respondido.</p>
 */
@Component({
  selector: 'app-pasos',
  standalone: false,
  template: `
    <ol class="pasos" [attr.aria-label]="'Paso ' + (actual + 1) + ' de ' + titulos.length">
      @for (titulo of titulos; track titulo; let i = $index) {
        <li
          class="paso"
          [class.paso-actual]="i === actual"
          [class.paso-completo]="i < actual"
          [attr.aria-current]="i === actual ? 'step' : null">
          <span class="paso-numero">
            @if (i < actual) {
              <app-icono nombre="correcto" tamano="sm" />
            } @else {
              {{ i + 1 }}
            }
          </span>
          <span class="paso-titulo">{{ titulo }}</span>
        </li>
      }
    </ol>
  `,
})
export class Pasos {
  @Input({ required: true }) titulos: string[] = [];
  /** Indice del paso en curso, empezando en cero. */
  @Input() actual = 0;
}
