/**
 * Uso externo de un equipo (RF-78): préstamo para que lo use, dentro de la
 * institución, personal de otra institución —UPC, UTEC...— con su encargado.
 *
 * <p>Es el "Formato de registro de uso de equipos de investigación",
 * guardado en dos partes: la apertura (puntos 1 a 5) y el cierre (6 a 10).
 * El punto 2 lo pone el sistema a partir del equipo, y el 9 —las firmas— se
 * pone a mano sobre el PDF impreso.</p>
 */
export type EstadoUso = 'ABIERTO' | 'CERRADO';

export interface UsoExterno {
  id: number;
  equipoId: number;
  coordinacionId: number;
  equipoNombre: string;
  equipoCodigoInventario: string;
  // 1. Responsable del equipamiento (Coordinador): investigador encargado
  encargadoNombre: string;
  encargadoCorreo?: string | null;
  encargadoCelular?: string | null;
  // 2
  estadoEquipoInicio: string;
  // 3
  usuarioNombre: string;
  usuarioCorreo?: string | null;
  usuarioTelefono?: string | null;
  // 4
  proyecto?: string | null;
  // 5
  fechaInicio: string;
  fechaFinPrevista?: string | null;
  horaFinPrevista?: string | null;
  actividad?: string | null;
  registradoPorNombre?: string | null;
  // 6 a 10
  entregadoOperativo?: boolean | null;
  devueltoOperativo?: boolean | null;
  incidente?: string | null;
  accionCorrectiva?: string | null;
  observaciones?: string | null;
  fechaCierre?: string | null;
  cerradoPorNombre?: string | null;
  estado: EstadoUso;
  estadoEtiqueta: string;
}

/** Primera parte: puntos 1 a 5. La fecha y la hora de inicio se escriben a mano. */
export interface AbrirUsoExternoPeticion {
  encargadoNombre: string;
  encargadoCorreo: string | null;
  encargadoCelular: string | null;
  usuarioNombre: string;
  usuarioCorreo: string | null;
  usuarioTelefono: string | null;
  proyecto: string | null;
  fechaInicio: string;
  horaInicio: string;
  fechaFinPrevista: string | null;
  horaFinPrevista: string | null;
  actividad: string | null;
}

/** Parte final: puntos 6 a 10. */
export interface CerrarUsoExternoPeticion {
  entregadoOperativo: boolean;
  devueltoOperativo: boolean;
  incidente: string | null;
  accionCorrectiva: string | null;
  observaciones: string | null;
}
