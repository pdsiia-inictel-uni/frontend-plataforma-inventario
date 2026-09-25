import { Component, ElementRef, Input, OnDestroy, ViewChild, signal } from '@angular/core';

type EstadoCopia = 'inicial' | 'copiada' | 'manual';

/**
 * Contrasena temporal generada por el sistema, con boton para copiarla (RF-06).
 *
 * <p>La contrasena se muestra una sola vez: quien la entrega la copia de un
 * clic en lugar de transcribirla, que es donde se confunden la l con el 1 o la
 * O con el 0. El portapapeles solo existe en un contexto seguro (HTTPS o
 * localhost); si el navegador lo niega, el texto queda seleccionado y se pide
 * copiarlo con Ctrl+C, de modo que el boton nunca falla en silencio.</p>
 */
@Component({
  selector: 'app-credencial',
  standalone: false,
  template: `
    <div class="credencial-caja">
      <span class="credencial" #texto>{{ password }}</span>
      <button
        type="button"
        class="btn btn-secundario btn-sm"
        [attr.aria-label]="estado() === 'copiada' ? 'Contraseña copiada' : 'Copiar contraseña'"
        (click)="copiar()">
        <app-icono [nombre]="estado() === 'copiada' ? 'correcto' : 'copiar'" tamano="sm" />
        {{ estado() === 'copiada' ? 'Copiada' : 'Copiar' }}
      </button>
    </div>
    @if (estado() === 'manual') {
      <p class="texto-secundario texto-pequeno mt-1 mb-0">
        El navegador no permitió copiar. La contraseña quedó seleccionada: presione Ctrl+C.
      </p>
    }
    <span class="campo-oculto" aria-live="polite">{{ anuncio() }}</span>
  `,
})
export class Credencial implements OnDestroy {
  @Input({ required: true }) password: string | null | undefined = '';

  @ViewChild('texto', { static: true }) private texto!: ElementRef<HTMLElement>;

  protected readonly estado = signal<EstadoCopia>('inicial');
  protected readonly anuncio = signal('');

  private temporizador: ReturnType<typeof setTimeout> | null = null;

  protected async copiar(): Promise<void> {
    try {
      if (!navigator.clipboard) {
        throw new Error('Portapapeles no disponible');
      }
      await navigator.clipboard.writeText(this.password ?? '');
      this.estado.set('copiada');
      this.anuncio.set('Contraseña copiada al portapapeles.');
      this.volverAlInicio();
    } catch {
      this.seleccionarTexto();
      this.estado.set('manual');
      this.anuncio.set('No se pudo copiar. La contraseña quedó seleccionada: presione Ctrl+C.');
    }
  }

  ngOnDestroy(): void {
    if (this.temporizador) {
      clearTimeout(this.temporizador);
    }
  }

  /** El boton vuelve a decir «Copiar» para poder repetir la copia. */
  private volverAlInicio(): void {
    if (this.temporizador) {
      clearTimeout(this.temporizador);
    }
    this.temporizador = setTimeout(() => {
      this.estado.set('inicial');
      this.anuncio.set('');
    }, 2500);
  }

  private seleccionarTexto(): void {
    const seleccion = window.getSelection();
    if (!seleccion) {
      return;
    }
    const rango = document.createRange();
    rango.selectNodeContents(this.texto.nativeElement);
    seleccion.removeAllRanges();
    seleccion.addRange(rango);
  }
}
