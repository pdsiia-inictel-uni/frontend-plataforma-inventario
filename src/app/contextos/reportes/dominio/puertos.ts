import { Observable } from 'rxjs';

import { FiltroInventario } from '../../inventario/dominio/equipo.model';
import { FormatoUsoGenerado, FormatoUsoPeticion } from './formato-uso.model';
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

/**
 * RF-78: formato de registro de uso de un equipo, en PDF.
 *
 * <p>Devuelve el documento y no guarda nada: el servidor lo dibuja con los
 * datos del bien y lo que se escribio a mano, y lo entrega. No hay operacion
 * de consulta ni de borrado porque no hay nada que consultar ni que borrar
 * (RN-36).</p>
 */
export abstract class FormatoUsoPuerto {
  abstract generar(equipoId: number, datos: FormatoUsoPeticion): Observable<FormatoUsoGenerado>;
}

/** Puerto de descarga: aisla del dominio la manipulacion del navegador. */
export abstract class DescargaPuerto {
  abstract guardar(archivo: ArchivoExportado): void;
}
