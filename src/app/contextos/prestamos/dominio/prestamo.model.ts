import { OpcionSelect } from '../../../compartido/dominio/opcion-select.model';

/** Situacion de un prestamo (RF-67). */
export type EstadoPrestamo = 'ACTIVO' | 'DEVUELTO';

/** Salida y devolucion de un bien (RF-58 .. RF-68). */
export interface Prestamo {
  id: number;
  coordinacionId: number;
  equipoId: number;
  equipoNombre: string;
  equipoCodigoInventario: string;
  equipoNumeroSerie: string;
  nombrePersona: string;
  dniPersona: string;
  /** RF-59: usuario registrado que se lleva el bien (ausente en préstamos antiguos). */
  personaUsuarioId?: number | null;
  /** RF-59: coordinación de destino; su nombre viaja en {@code destino}. */
  coordinacionDestinoId?: number | null;
  destino?: string;
  fechaPrestamo: string;
  fechaEstimadaDevolucion?: string;
  observacionesSalida?: string;
  fechaDevolucion?: string;
  conforme?: boolean;
  reportaDano: boolean;
  observacionesRetorno?: string;
  usuarioPrestaId?: number;
  usuarioPrestaNombre?: string;
  usuarioRecibeId?: number;
  usuarioRecibeNombre?: string;
  estado: EstadoPrestamo;
  estadoEtiqueta: string;
  /** RF-67: supero la fecha comprometida y sigue sin devolverse. */
  vencido: boolean;
  diasAtraso: number;
}

/**
 * Registro de una salida (RF-59).
 *
 * <p>La fecha y hora de salida y el usuario que entrega los pone el servidor:
 * el cliente no los envia y cualquier valor que mandara seria ignorado
 * (RN-21).</p>
 */
export interface PrestamoPeticion {
  equipoId: number;
  /** Primero se elige la coordinación de destino... */
  coordinacionDestinoId: number;
  /** ...y dentro de ella, al Responsable u Operador que recibe el equipo. */
  personaUsuarioId: number;
  fechaEstimadaDevolucion?: string | null;
  observacionesSalida?: string | null;
}

/**
 * Coordinación a la que puede ir un equipo prestado (RF-59): cualquiera de la
 * institución, de su misma Dirección o de otra.
 */
export interface CoordinacionDestino {
  id: number;
  nombre: string;
  direccionId: number;
  direccionNombre?: string | null;
}

/** Las coordinaciones de destino agrupadas por su Dirección, para el selector. */
export interface GrupoDestino {
  direccion: string;
  coordinaciones: CoordinacionDestino[];
}

/**
 * Persona registrada a la que puede entregarse un equipo (RF-59): el
 * Responsable o un Operador activo de la coordinación de destino.
 */
export interface Destinatario {
  id: number;
  nombreCompleto: string;
  rolEtiqueta: string;
  coordinacionId: number;
}

/**
 * Checklist de conformidad de la devolucion (RF-61, RF-65).
 *
 * <p>Si no es conforme, la observacion de retorno es obligatoria: es la unica
 * constancia de en que estado volvio el bien (RN-18).</p>
 */
export interface DevolucionPeticion {
  conforme: boolean;
  reportaDano?: boolean;
  observacionesRetorno?: string | null;
}

/** Criterios de busqueda de prestamos (RF-66, RF-67). */
export interface FiltroPrestamos {
  q?: string;
  coordinacionId?: number | null;
  estado?: EstadoPrestamo | null;
  equipoId?: number | null;
  dni?: string | null;
  desde?: string | null;
  hasta?: string | null;
  vencidos?: boolean | null;
}

export const ESTADOS_PRESTAMO: OpcionSelect<EstadoPrestamo>[] = [
  { valor: 'ACTIVO', etiqueta: 'Activo' },
  { valor: 'DEVUELTO', etiqueta: 'Devuelto' },
];

/** Distintivo del prestamo: color y texto, nunca solo color (RNF-30). */
export function clasePrestamo(prestamo: Prestamo): string {
  if (prestamo.vencido) {
    return 'insignia insignia-vencido';
  }
  return prestamo.estado === 'ACTIVO' ? 'insignia insignia-prestado' : 'insignia insignia-disponible';
}

/** Texto del atraso en lenguaje natural (RNF-29). */
export function describirAtraso(prestamo: Prestamo): string {
  if (!prestamo.vencido) {
    return '';
  }
  return prestamo.diasAtraso === 1 ? '1 día de atraso' : `${prestamo.diasAtraso} días de atraso`;
}
