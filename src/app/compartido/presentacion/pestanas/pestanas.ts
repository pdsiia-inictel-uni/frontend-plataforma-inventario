import { Component, EventEmitter, Input, Output } from '@angular/core';

import { NombreIcono } from '../icono/icono';

/** Una pestaña: su clave, su nombre y, si es una lista, cuántos registros tiene. */
export interface OpcionPestana<T extends string = string> {
  id: T;
  etiqueta: string;
  icono?: NombreIcono;
  /** Registros de la pestaña; se omite (o null) en la que no es una lista. */
  contador?: number | null;
}

/**
 * Fila de pestañas del sistema: la misma letra, el mismo tamaño y el mismo
 * comportamiento en todas las pantallas que reparten su contenido por temas.
 *
 * <p>Cada pestaña lleva icono, nombre y, si procede, su recuento: se sabe si
 * hay algo que mirar antes de abrirla, y un cero se ve apagado. La activa se
 * marca con color, fondo y una barra inferior —no solo con color (RNF-30)—.</p>
 *
 * <p>Sigue el patrón de pestañas de WAI-ARIA (RNF-32): las flechas pasan a la
 * vecina, Inicio y Fin a los extremos, y solo la activa entra en el recorrido
 * con Tab. La pantalla pone el contenido debajo, en un elemento con la clase
 * {@code pestanas-panel} y el id {@code panel-<prefijo>}.</p>
 */
@Component({
  selector: 'app-pestanas',
  standalone: false,
  template: `
    <div class="pestanas" role="tablist" [attr.aria-label]="etiqueta" (keydown)="mover($event)">
      @for (opcion of opciones; track opcion.id) {
        <button
          type="button"
          role="tab"
          class="pestana"
          [id]="prefijo + '-' + opcion.id"
          [class.activa]="activa === opcion.id"
          [attr.aria-selected]="activa === opcion.id"
          [attr.aria-controls]="'panel-' + prefijo"
          [attr.tabindex]="activa === opcion.id ? 0 : -1"
          (click)="elegir(opcion.id)">
          @if (opcion.icono) {
            <app-icono [nombre]="opcion.icono" tamano="sm" />
          }
          <span>{{ opcion.etiqueta }}</span>
          @if (opcion.contador !== undefined && opcion.contador !== null) {
            <span
              class="pestana-contador"
              [class.vacio]="opcion.contador === 0"
              [attr.aria-label]="opcion.contador === 1 ? '1 registro' : opcion.contador + ' registros'">
              {{ opcion.contador }}
            </span>
          }
        </button>
      }
    </div>
  `,
})
export class Pestanas {
  @Input({ required: true }) opciones: readonly OpcionPestana[] = [];
  @Input({ required: true }) activa = '';
  /** Nombre accesible de la fila, p. ej. "Secciones de la ficha". */
  @Input() etiqueta = 'Secciones';
  /** Prefijo de los id: enlaza cada pestaña con el panel de la pantalla. */
  @Input() prefijo = 'pestana';
  @Output() readonly activaChange = new EventEmitter<string>();

  protected elegir(id: string): void {
    if (id !== this.activa) {
      this.activa = id;
      this.activaChange.emit(id);
    }
  }

  protected mover(evento: KeyboardEvent): void {
    const total = this.opciones.length;
    const actual = this.opciones.findIndex((opcion) => opcion.id === this.activa);
    let destino: number;
    switch (evento.key) {
      case 'ArrowRight': destino = (actual + 1) % total; break;
      case 'ArrowLeft': destino = (actual - 1 + total) % total; break;
      case 'Home': destino = 0; break;
      case 'End': destino = total - 1; break;
      default: return;
    }
    evento.preventDefault();
    this.elegir(this.opciones[destino].id);
    const boton = (evento.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]')[destino];
    boton?.focus();
    boton?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}
