/** Cuerpo uniforme de error que devuelve la API (RNF-12). */
export interface RespuestaError {
  fechaHora: string;
  estado: number;
  codigo: string;
  mensaje: string;
  ruta: string;
  errores?: Record<string, string>;
}

/** Codigo con el que el backend exige el cambio de contrasena (RF-06). */
export const CODIGO_CAMBIO_PASSWORD = 'CAMBIO_PASSWORD_REQUERIDO';
