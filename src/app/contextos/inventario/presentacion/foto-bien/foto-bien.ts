import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';

import { SesionStore } from '../../../iam/aplicacion/sesion.store';
import { InventarioFacade } from '../../aplicacion/inventario.facade';
import { Equipo } from '../../dominio/equipo.model';

/**
 * Fotografia del bien (RF-51).
 *
 * <p>El endpoint de archivos exige JWT, por lo que la imagen se descarga como
 * blob en lugar de enlazarse directamente desde el atributo src. La CSP
 * autoriza expresamente {@code img-src blob:} para este caso (RNF-07).</p>
 *
 * <p>La miniatura de la ficha se queda corta cuando lo que se quiere
 * comprobar es la etiqueta patrimonial o el numero de serie del equipo. Al
 * pulsarla, la fotografia se abre a tamano completo sobre un velo oscuro, y
 * se cierra con su boton, pulsando fuera de la imagen o con la tecla Escape
 * (RNF-32: toda accion accesible tambien por teclado).</p>
 */
@Component({
  selector: 'app-foto-bien',
  standalone: false,
  template: `
    <div class="tarjeta">
      <div class="tarjeta-cabecera">
        <h2>Fotografia</h2>
      </div>
      <div class="tarjeta-cuerpo texto-centrado">
        @if (url(); as imagen) {
          <!-- La imagen se envuelve en un boton y no en un simple manejador
               sobre el <img>: asi se alcanza con el tabulador y se activa con
               Intro o barra espaciadora sin codigo adicional. -->
          <button
            type="button"
            class="boton-foto"
            [attr.aria-label]="'Ver más grande la fotografía de ' + equipo.nombre"
            (click)="ampliar($event)">
            <img [src]="imagen" [alt]="'Fotografía de ' + equipo.nombre" class="foto-bien" />
          </button>
          <p class="texto-secundario texto-pequeno mt-1 mb-0">
            Pulse la fotografia para verla mas grande.
          </p>
        } @else {
          <div class="sin-foto">
            <app-icono nombre="foto" tamano="lg" />
            <p class="texto-secundario texto-pequeno mb-0">Este equipo aun no tiene fotografia.</p>
          </div>
        }

        @if (puedeCambiarla()) {
          <p class="ayuda-campo mt-1 mb-0">
            {{ url() ? 'Para sustituirla' : 'Para añadirla' }}, use <strong>Editar</strong>: la
            fotografía se confirma junto con el resto de los datos del equipo.
          </p>
        }
      </div>
    </div>

    @if (ampliada()) {
      @if (url(); as imagen) {
        <div
          class="visor-foto"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="'Fotografía de ' + equipo.nombre"
          (click)="cerrarAmpliada()">
          <div class="visor-foto-barra">
            <span class="visor-foto-titulo">{{ equipo.nombre }}</span>
            <button
              #botonCerrar
              type="button"
              class="btn btn-secundario"
              (click)="cerrarAmpliada()">
              <app-icono nombre="cerrar" tamano="sm" />
              <span>Cerrar</span>
            </button>
          </div>
          <img
            [src]="imagen"
            [alt]="'Fotografía de ' + equipo.nombre"
            class="visor-foto-imagen"
            (click)="$event.stopPropagation()" />
          <p class="visor-foto-ayuda mb-0">Pulse fuera de la imagen o la tecla Escape para cerrar.</p>
        </div>
      }
    }
  `,
})
export class FotoBien implements OnChanges, OnDestroy {
  @Input({ required: true }) equipo!: Equipo;

  private readonly inventario = inject(InventarioFacade);
  private readonly sesion = inject(SesionStore);

  protected readonly url = signal<string | null>(null);
  protected readonly ampliada = signal(false);

  /**
   * RF-51c: quien puede cambiarla, para decirle donde.
   *
   * <p>Desde la v3.10 la ficha solo la enseña: cambiarla es una modificacion
   * del bien y se hace donde se hacen todas, en <em>Editar</em>, con su
   * confirmacion. Aqui se subia suelta y sin revisar nada, y podia hacerlo
   * tambien el Operador, que sobre un equipo ya registrado no escribe
   * (RF-45).</p>
   */
  protected readonly puedeCambiarla = this.sesion.esResponsable;

  /** Miniatura desde la que se abrio el visor, para devolverle el foco. */
  private origenDelFoco: HTMLElement | null = null;

  /** Al abrirse el visor, el foco pasa a su boton de cierre (RNF-32). */
  @ViewChild('botonCerrar')
  protected set enfocarCierre(boton: ElementRef<HTMLButtonElement> | undefined) {
    boton?.nativeElement.focus();
  }

  ngOnChanges(): void {
    this.liberar();
    this.ampliada.set(false);
    if (!this.equipo?.fotoUrl) {
      return;
    }
    this.inventario.descargarFoto(this.equipo.fotoUrl).subscribe({
      next: (blob) => this.url.set(URL.createObjectURL(blob)),
      error: () => this.url.set(null),
    });
  }

  ngOnDestroy(): void {
    this.liberar();
  }

  protected ampliar(evento: Event): void {
    if (!this.url()) {
      return;
    }
    // Al cerrar, el foco vuelve a la miniatura desde la que se abrio: quien
    // navega con teclado retoma la ficha donde la dejo (RNF-32).
    this.origenDelFoco = evento.currentTarget as HTMLElement | null;
    this.ampliada.set(true);
  }

  protected cerrarAmpliada(): void {
    if (!this.ampliada()) {
      return;
    }
    this.ampliada.set(false);
    this.origenDelFoco?.focus();
    this.origenDelFoco = null;
  }

  @HostListener('document:keydown.escape')
  protected alPulsarEscape(): void {
    this.cerrarAmpliada();
  }

  private liberar(): void {
    const actual = this.url();
    if (actual) {
      URL.revokeObjectURL(actual);
      this.url.set(null);
    }
  }
}
