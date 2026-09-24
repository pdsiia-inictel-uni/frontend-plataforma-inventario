import { Observable } from 'rxjs';

import { FiltroInventario } from '../../inventario/dominio/equipo.model';
import { FormatoUsoGenerado } from './formato-uso.model';
import { PanelControl } from './panel.model';

/** Formatos de exportacion admitidos (RF-23). */
export type FormatoExportacion = 'xlsx' | 'csv' | 'pdf';

/** Archivo generado por el backend, listo para descargarse. */
export interface ArchivoExportado {
  nombre: string;
  contenido: Blob;
}

/** Puertos del contexto de reportes. */
export abstract class PanelPuerto {
  abstract resumen(): Observable<PanelControl>;
}

export abstract class ExportacionPuerto {
  abstract inventario(formato: FormatoExportacion, filtro: FiltroInventario): Observable<ArchivoExportado>;
}

/** RF-78: PDF del formato de registro de uso de un uso externo guardado. */
export abstract class FormatoUsoPuerto {
  abstract generar(usoId: number): Observable<FormatoUsoGenerado>;
}

/** Puerto de descarga: aisla del dominio la manipulacion del navegador. */
export abstract class DescargaPuerto {
  abstract guardar(archivo: ArchivoExportado): void;
}
