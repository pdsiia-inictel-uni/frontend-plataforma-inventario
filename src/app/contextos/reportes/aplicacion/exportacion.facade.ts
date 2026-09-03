import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { FiltroInventario } from '../../inventario/dominio/equipo.model';
import { ArchivoExportado, DescargaPuerto, ExportacionPuerto } from '../dominio/puertos';
import type { FormatoExportacion } from '../dominio/puertos';

export type { FormatoExportacion } from '../dominio/puertos';

/**
 * Exportacion del inventario filtrado (RF-23): pide el archivo al backend y
 * lo entrega al navegador.
 */
@Injectable({ providedIn: 'root' })
export class ExportacionFacade {
  private readonly exportacion = inject(ExportacionPuerto);
  private readonly descarga = inject(DescargaPuerto);

  inventario(formato: FormatoExportacion, filtro: FiltroInventario): Observable<ArchivoExportado> {
    return this.exportacion.inventario(formato, filtro).pipe(
      tap((archivo) => this.descarga.guardar(archivo)),
    );
  }
}
