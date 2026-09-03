import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { FormatoUsoGenerado, FormatoUsoPeticion } from '../dominio/formato-uso.model';
import { DescargaPuerto, FormatoUsoPuerto } from '../dominio/puertos';

/**
 * Formato de registro de uso de equipos de investigacion (RF-78).
 *
 * <p>Dos operaciones y ninguna mas: pedir el documento y entregarselo al
 * navegador. Entre las dos hay una pantalla que lo enseña, porque un papel
 * que se va a firmar se lee antes de descargarlo (RF-79).</p>
 *
 * <p>No hay ningun caso de uso de consulta ni de borrado: el formato no se
 * guarda en ninguna parte (RN-36).</p>
 */
@Injectable({ providedIn: 'root' })
export class FormatoUsoFacade {
  private readonly formatos = inject(FormatoUsoPuerto);
  private readonly descarga = inject(DescargaPuerto);

  generar(equipoId: number, datos: FormatoUsoPeticion): Observable<FormatoUsoGenerado> {
    return this.formatos.generar(equipoId, datos);
  }

  /** Entrega al navegador el PDF que ya se genero, sin volver a pedirlo. */
  descargar(formato: FormatoUsoGenerado): void {
    this.descarga.guardar(formato);
  }
}
