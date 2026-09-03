import { Component, EventEmitter, Input, Output } from '@angular/core';

/** Controles de paginacion de los listados (RF-21). */
@Component({
  selector: 'app-paginador',
  standalone: false,
  template: `
    <div class="paginador">
      <div>
        @if (totalElementos === 0) {
          Sin registros
        } @else {
          Mostrando {{ desde }} - {{ hasta }} de {{ totalElementos }} registro(s)
        }
      </div>
      <div class="paginador-controles">
        <label class="texto-pequeno" for="tamano-pagina">Filas</label>
        <select
          id="tamano-pagina"
          [ngModel]="tamano"
          (ngModelChange)="cambiarTamano($event)"
          name="tamano"
          aria-label="Registros por pagina">
          @for (t of tamanos; track t) {
            <option [ngValue]="t">{{ t }}</option>
          }
        </select>
        <button type="button" class="btn btn-sm btn-secundario" [disabled]="pagina === 0" (click)="ir(0)">
          &laquo;
        </button>
        <button type="button" class="btn btn-sm btn-secundario" [disabled]="pagina === 0" (click)="ir(pagina - 1)">
          Anterior
        </button>
        <span class="texto-pequeno">Pagina {{ totalPaginas === 0 ? 0 : pagina + 1 }} de {{ totalPaginas }}</span>
        <button
          type="button"
          class="btn btn-sm btn-secundario"
          [disabled]="pagina + 1 >= totalPaginas"
          (click)="ir(pagina + 1)">
          Siguiente
        </button>
        <button
          type="button"
          class="btn btn-sm btn-secundario"
          [disabled]="pagina + 1 >= totalPaginas"
          (click)="ir(totalPaginas - 1)">
          &raquo;
        </button>
      </div>
    </div>
  `,
})
export class Paginador {
  @Input() pagina = 0;
  @Input() tamano = 10;
  @Input() totalElementos = 0;
  @Input() totalPaginas = 0;

  @Output() paginaCambiada = new EventEmitter<number>();
  @Output() tamanoCambiado = new EventEmitter<number>();

  protected readonly tamanos = [10, 20, 50, 100];

  protected get desde(): number {
    return this.pagina * this.tamano + 1;
  }

  protected get hasta(): number {
    return Math.min((this.pagina + 1) * this.tamano, this.totalElementos);
  }

  protected ir(destino: number): void {
    if (destino >= 0 && destino < this.totalPaginas && destino !== this.pagina) {
      this.paginaCambiada.emit(destino);
    }
  }

  protected cambiarTamano(valor: number): void {
    this.tamanoCambiado.emit(Number(valor));
  }
}
