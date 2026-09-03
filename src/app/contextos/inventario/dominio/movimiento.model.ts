import { Rol } from '../../iam/dominio/usuario.model';

/** Hechos que dejan rastro en la linea de tiempo de un bien (RF-53). */
export type TipoMovimiento =
  | 'ALTA'
  | 'PRESTAMO'
  | 'DEVOLUCION'
  | 'MANTENIMIENTO'
  | 'OPERATIVO'
  | 'BAJA'
  | 'REINCORPORACION'
  | 'EDICION'
  | 'REUBICACION'
  /** RF-83: el equipo cambia de responsable dentro de la coordinacion. */
  | 'RESPONSABLE';

/**
 * Movimiento inmutable del historial de un bien (RF-53 .. RF-55).
 *
 * <p>Es de solo lectura por definicion: no existe endpoint ni pantalla que lo
 * edite o lo elimine, y su fecha la genera el servidor (RN-21).</p>
 */
export interface Movimiento {
  id: number;
  tipo: TipoMovimiento;
  tipoEtiqueta: string;
  condicionAnterior?: string;
  condicionNueva?: string;
  detalle?: string;
  usuario: string;
  rolUsuario?: Rol;
  rolEtiqueta?: string;
  /** Frase ya redactada por el backend: "Prestado por Ana Diaz (Responsable)". */
  resumen: string;
  fechaHora: string;
}

/**
 * Icono de la linea de tiempo. Acompana siempre al texto del movimiento:
 * el significado nunca depende solo del color ni solo de la forma (RNF-30).
 */
export function iconoMovimiento(tipo: TipoMovimiento): string {
  switch (tipo) {
    case 'ALTA':
      return 'agregar';
    case 'PRESTAMO':
      return 'prestamos';
    case 'DEVOLUCION':
      return 'restaurar';
    case 'MANTENIMIENTO':
      return 'mantenimiento';
    case 'OPERATIVO':
      return 'correcto';
    case 'BAJA':
      return 'baja';
    case 'REINCORPORACION':
      return 'restaurar';
    case 'EDICION':
      return 'editar';
    case 'REUBICACION':
      return 'ubicacion';
    case 'RESPONSABLE':
      return 'operadores';
    default:
      return 'reloj';
  }
}

/** Color del hito, siempre junto a su etiqueta de texto (RNF-30). */
export function claseMovimiento(tipo: TipoMovimiento): string {
  switch (tipo) {
    case 'ALTA':
    case 'OPERATIVO':
    case 'DEVOLUCION':
    case 'REINCORPORACION':
      return 'hito-verde';
    case 'PRESTAMO':
      return 'hito-ambar';
    case 'MANTENIMIENTO':
    case 'RESPONSABLE':
      return 'hito-marca-color';
    case 'BAJA':
      return 'hito-gris';
    default:
      return 'hito-neutro';
  }
}
