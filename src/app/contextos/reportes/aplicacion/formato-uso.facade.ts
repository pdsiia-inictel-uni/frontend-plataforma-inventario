import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { FormatoUsoGenerado } from '../dominio/formato-uso.model';
import { DescargaPuerto, FormatoUsoPuerto } from '../dominio/puertos';

/**
 * Formato de registro de uso de equipos de investigacion (RF-78).
 *
 * <p>Dos operaciones y ninguna mas: pedir el documento y entregarselo al
 * navegador. Entre las dos hay una pantalla que lo enseña, porque un papel
 * que se va a firmar se lee antes de descargarlo (RF-79).</p>
 *
 * <p>El documento se dibuja a partir de un registro de uso externo guardado;
 * generarlo no escribe nada.</p>
 */
@Injectable({ providedIn: 'root' })
export class FormatoUsoFacade {
  private readonly formatos = inject(FormatoUsoPuerto);
  private readonly descarga = inject(DescargaPuerto);

  generar(usoId: number): Observable<FormatoUsoGenerado> {
    return this.formatos.generar(usoId);
  }

  /** Entrega al navegador el PDF que ya se genero, sin volver a pedirlo. */
  descargar(formato: FormatoUsoGenerado): void {
    this.descarga.guardar(formato);
  }
}
