import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Confirmacion explicita antes de acciones criticas (RNF-13).
 */
@Component({
  selector: 'app-confirmacion',
  standalone: false,
  template: `
    <div class="modal-fondo" (click)="cancelar.emit()">
      <div class="modal modal-angosto" (click)="$event.stopPropagation()">
        <div class="modal-cabecera">
          <h3>{{ titulo }}</h3>
        </div>
        <div class="modal-cuerpo">
          <p class="mb-0">{{ mensaje }}</p>
          @if (detalle) {
            <p class="texto-secundario texto-pequeno mt-1 mb-0">{{ detalle }}</p>
          }
          @if (requiereMotivo) {
            <div class="campo mt-1">
              <label for="motivo-confirmacion">{{ etiquetaMotivo }}<span class="obligatorio">*</span></label>
              <textarea
                id="motivo-confirmacion"
                [(ngModel)]="motivo"
                name="motivo"
                rows="3"
                placeholder="Detalle el motivo"></textarea>
              @if (intentado && !motivo.trim()) {
                <span class="error-campo">Este dato es obligatorio.</span>
              }
            </div>
          }
        </div>
        <div class="modal-pie">
          <button type="button" class="btn btn-secundario" (click)="cancelar.emit()">Cancelar</button>
          <button
            type="button"
            class="btn"
            [class.btn-peligro]="peligrosa"
            [class.btn-primario]="!peligrosa"
            [disabled]="procesando"
            (click)="alConfirmar()">
            {{ procesando ? 'Procesando...' : textoConfirmar }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class Confirmacion {
  @Input() titulo = 'Confirmar operación';
  @Input() mensaje = '';
  @Input() detalle = '';
  @Input() textoConfirmar = 'Confirmar';
  @Input() peligrosa = false;
  @Input() procesando = false;
  @Input() requiereMotivo = false;
  @Input() etiquetaMotivo = 'Motivo';

  @Output() confirmar = new EventEmitter<string>();
  @Output() cancelar = new EventEmitter<void>();

  protected motivo = '';
  protected intentado = false;

  protected alConfirmar(): void {
    this.intentado = true;
    if (this.requiereMotivo && !this.motivo.trim()) {
      return;
    }
    this.confirmar.emit(this.motivo.trim());
  }
}
