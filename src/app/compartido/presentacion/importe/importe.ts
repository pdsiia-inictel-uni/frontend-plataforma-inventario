import {
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  inject,
} from '@angular/core';

import {
  contarSignificativos,
  formatearImporte,
  formatearImporteCompleto,
  importeANumero,
  posicionTrasSignificativos,
} from '../../dominio/importe.model';

/**
 * Campo de importe en soles.
 *
 * <p>Da formato mientras se escribe —millares con coma, centimos con punto—
 * y al salir completa los centimos, de modo que el usuario ve el numero como
 * lo vera en el inventario y no tiene que contar ceros (RNF-22).</p>
 *
 * <p>Se usa con enlace de dos vias sobre el numero, no sobre el texto:
 * {@code <input [(appImporte)]="costo">}. El componente sigue trabajando con
 * un {@code number | null} y no se entera del formato.</p>
 *
 * <p>No se apoya en {@code type="number"} a proposito: ese control no admite
 * separador de millares, y en muchos navegadores acepta notacion cientifica y
 * la rueda del raton cambia el valor sin querer.</p>
 */
/*
 * Independiente, a diferencia de los componentes del sistema: al no estar
 * declarada en el modulo raiz puede llevarla consigo cualquier plantilla que
 * la importe, incluida la de su propia prueba.
 */
@Directive({
  selector: 'input[appImporte]',
  standalone: true,
})
export class Importe implements OnChanges {
  private readonly campo = inject<ElementRef<HTMLInputElement>>(ElementRef);

  @Input('appImporte') valor: number | null = null;
  @Output('appImporteChange') valorCambiado = new EventEmitter<number | null>();

  /**
   * Refleja el valor que llega de fuera, salvo mientras el usuario escribe:
   * reescribir el campo bajo sus dedos le movería el cursor.
   */
  ngOnChanges(): void {
    const elemento = this.campo.nativeElement;
    if (document.activeElement === elemento) {
      return;
    }
    elemento.value = this.valor === null ? '' : formatearImporteCompleto(this.valor);
  }

  @HostListener('input')
  protected alEscribir(): void {
    const elemento = this.campo.nativeElement;
    const escrito = elemento.value;
    const cursor = elemento.selectionStart ?? escrito.length;
    const significativos = contarSignificativos(escrito.slice(0, cursor));

    const formateado = formatearImporte(escrito);
    elemento.value = formateado;
    const destino = posicionTrasSignificativos(formateado, significativos);
    elemento.setSelectionRange(destino, destino);

    this.valorCambiado.emit(importeANumero(formateado));
  }

  /** Al salir del campo los centimos se completan: 150 se muestra 150.00. */
  @HostListener('blur')
  protected alSalir(): void {
    const elemento = this.campo.nativeElement;
    const numero = importeANumero(elemento.value);
    elemento.value = numero === null ? '' : formatearImporteCompleto(numero);
    this.valorCambiado.emit(numero);
  }
}
