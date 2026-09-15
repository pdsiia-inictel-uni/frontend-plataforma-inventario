import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

/** Un filtro aplicado, tal como se enseña en su indicador: "Estado: Operativos". */
export interface FiltroActivo {
  clave: string;
  etiqueta: string;
  valor: string;
}

let secuencia = 0;

/**
 * Barra de consulta de los listados (RF-47, RF-67, RF-28, RNF-22).
 *
 * <p>Separa lo que se usa siempre de lo que se usa a veces. La búsqueda y las
 * acciones de la pantalla quedan a la vista en una sola fila; los filtros
 * secundarios se despliegan con el botón "Filtros" y, cerrados, no ocupan
 * sitio. Lo aplicado se sigue viendo con el panel cerrado, en indicadores que
 * se quitan uno a uno.</p>
 *
 * <p>Los campos del panel son un borrador: no consultan nada hasta pulsar
 * "Aplicar". Si el panel se cierra sin aplicar, la pantalla recibe
 * {@code descartado} y devuelve los campos a lo que ya estaba aplicado, de modo
 * que lo que se ve en los indicadores es siempre lo que filtra la tabla.</p>
 *
 * <p>Ranuras: {@code [barraBusqueda]} para el campo de búsqueda (y el selector
 * de coordinación del Administrador), {@code [barraAcciones]} para Exportar y la
 * acción principal, y el contenido sin marcar para los campos del panel.</p>
 */
@Component({
  selector: 'app-barra-filtros',
  standalone: false,
  template: `
    <div class="barra-consulta">
      <div class="barra-consulta-principal">
        <ng-content select="[barraBusqueda]" />
        @if (conPanel) {
          <button
            type="button"
            class="btn btn-secundario boton-filtros"
            [class.abierto]="abierto()"
            [attr.aria-expanded]="abierto()"
            [attr.aria-controls]="idPanel"
            (click)="alternar()">
            <app-icono nombre="filtros" tamano="sm" />
            <span>Filtros</span>
            @if (activos.length > 0) {
              <span class="contador-filtros">{{ activos.length }}</span>
            }
          </button>
        }
        @if (activos.length > 0) {
          <ul class="filtros-activos" aria-label="Filtros aplicados">
            @for (filtro of activos; track filtro.clave) {
              <li class="filtro-activo">
                <span class="filtro-activo-texto" [title]="filtro.etiqueta + ': ' + filtro.valor">
                  <span class="clave">{{ filtro.etiqueta }}:</span> {{ filtro.valor }}
                </span>
                <button
                  type="button"
                  class="filtro-activo-quitar"
                  [attr.aria-label]="'Quitar el filtro ' + filtro.etiqueta"
                  [title]="'Quitar el filtro ' + filtro.etiqueta"
                  (click)="quitado.emit(filtro.clave)">
                  <app-icono nombre="cerrar" tamano="sm" />
                </button>
              </li>
            }
            @if (activos.length > 1) {
              <li>
                <button type="button" class="btn-enlace quitar-filtros" (click)="alLimpiar()">
                  Quitar todos
                </button>
              </li>
            }
          </ul>
        }
      </div>
      <div class="barra-consulta-acciones">
        <ng-content select="[barraAcciones]" />
      </div>
    </div>

    @if (conPanel) {
      <div class="panel-filtros" role="group" aria-label="Filtros" [id]="idPanel" [hidden]="!abierto()">
        <div class="panel-filtros-campos">
          <ng-content />
        </div>
        <div class="panel-filtros-acciones">
          <button type="button" class="btn btn-secundario" (click)="alLimpiar()">Limpiar</button>
          <button type="button" class="btn btn-primario" (click)="alAplicar()">Aplicar</button>
        </div>
      </div>
    }
  `,
})
export class BarraFiltros {
  /** Lo que filtra la tabla ahora mismo, sin contar la búsqueda de texto. */
  @Input() activos: FiltroActivo[] = [];
  /** Una pantalla sin filtros secundarios solo usa la fila de búsqueda. */
  @Input() conPanel = true;

  @Output() readonly aplicado = new EventEmitter<void>();
  @Output() readonly limpiado = new EventEmitter<void>();
  @Output() readonly descartado = new EventEmitter<void>();
  @Output() readonly quitado = new EventEmitter<string>();

  protected readonly abierto = signal(false);
  protected readonly idPanel = `panel-filtros-${++secuencia}`;

  protected alternar(): void {
    if (this.abierto()) {
      // Cerrar sin aplicar deshace lo que se tocó en el panel.
      this.descartado.emit();
    }
    this.abierto.update((abierto) => !abierto);
  }

  protected alAplicar(): void {
    this.aplicado.emit();
    this.abierto.set(false);
  }

  protected alLimpiar(): void {
    this.limpiado.emit();
    this.abierto.set(false);
  }
}
