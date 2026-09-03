import { DOCUMENT } from '@angular/common';
import { Injectable, Renderer2, RendererFactory2, inject } from '@angular/core';

import { ArchivoExportado, DescargaPuerto } from '../dominio/puertos';

/**
 * Adaptador de descarga de archivos en el navegador.
 *
 * <p>Usa {@link Renderer2} en lugar de manipular el DOM directamente y libera
 * la URL temporal al terminar; no requiere ningun atributo ni script en linea,
 * de modo que la CSP estricta se mantiene intacta (RNF-04).</p>
 */
@Injectable({ providedIn: 'root' })
export class DescargaNavegadorAdapter extends DescargaPuerto {
  private readonly documento = inject(DOCUMENT);
  private readonly renderer: Renderer2;

  constructor() {
    super();
    this.renderer = inject(RendererFactory2).createRenderer(null, null);
  }

  override guardar(archivo: ArchivoExportado): void {
    const url = URL.createObjectURL(archivo.contenido);
    const enlace: HTMLAnchorElement = this.renderer.createElement('a');

    this.renderer.setAttribute(enlace, 'href', url);
    this.renderer.setAttribute(enlace, 'download', archivo.nombre);
    this.renderer.appendChild(this.documento.body, enlace);
    enlace.click();

    this.renderer.removeChild(this.documento.body, enlace);
    URL.revokeObjectURL(url);
  }
}
