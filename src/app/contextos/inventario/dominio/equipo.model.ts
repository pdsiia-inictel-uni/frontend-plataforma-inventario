import { OpcionSelect } from '../../../compartido/dominio/opcion-select.model';

/** Condicion actual de un bien (RF-34, C-06 de la ERS). */
export type CondicionEquipo = 'OPERATIVO' | 'PRESTADO' | 'MANTENIMIENTO' | 'BAJA';

/** Fila del listado de inventario (RF-47, RF-50). */
export interface EquipoResumen {
  id: number;
  nombre: string;
  marca: string;
  modelo: string;
  numeroSerie: string;
  codigoInventario: string;
  codigoPatrimonial: string;
  categoria?: string;
  laboratorio?: string;
  condicion: CondicionEquipo;
  condicionEtiqueta: string;
  /** RF-34: fecha de la orden de compra, en formato ISO (yyyy-MM-dd). */
  fechaAdquisicion: string;
  costo: number;
  /** RN-19: devuelto con dano, a la espera de que el Responsable decida. */
  revisionPendiente: boolean;
  fechaRegistro: string;
}

/** Ficha completa del bien (RF-34). */
export interface Equipo {
  id: number;
  coordinacionId: number;
  coordinacion: string;
  laboratorioId?: number;
  laboratorio?: string;
  nombre: string;
  marca: string;
  modelo: string;
  numeroSerie: string;
  codigoInventario: string;
  codigoPatrimonial: string;
  categoriaId?: number;
  categoria?: string;
  condicion: CondicionEquipo;
  condicionEtiqueta: string;
  /** RF-34: fecha de la orden de compra, en formato ISO (yyyy-MM-dd). */
  fechaAdquisicion: string;
  costo: number;
  observaciones?: string;
  fotoUrl?: string;
  revisionPendiente: boolean;
  motivoBaja?: string;
  fechaBaja?: string;
  responsableId?: number;
  /** RF-36: el Responsable vigente al momento del alta. */
  responsable?: string;
  /**
   * RF-83: Operador que tiene el equipo a su cargo.
   *
   * <p>Ausente cuando lo lleva el Responsable de la coordinación, que es como
   * nace todo bien y donde vuelve cuando se le retira a un operador.</p>
   */
  responsableEquipoId?: number;
  /**
   * Nombre de quien responde por el equipo hoy: el operador a su cargo o, si
   * no tiene, el Responsable vigente. El servidor lo resuelve, de modo que la
   * ficha nunca se queda sin nombre que mostrar.
   */
  responsableEquipo?: string;
  registradoPor?: string;
  fechaRegistro: string;
  fechaActualizacion?: string;
  activo: boolean;
}

/**
 * Alta y edicion de un bien (RF-34).
 *
 * <p>No incluye condicion, coordinacion, responsable ni fechas: todos los
 * genera el servidor y cualquier valor que enviara el cliente seria
 * ignorado (RF-35, RF-37, RN-21).</p>
 */
export interface EquipoPeticion {
  nombre: string;
  marca: string;
  modelo: string;
  numeroSerie: string;
  codigoInventario: string;
  codigoPatrimonial: string;
  categoriaId: number;
  laboratorioId?: number | null;
  /** RF-34: fecha de la orden de compra, en formato ISO (yyyy-MM-dd). */
  fechaAdquisicion: string;
  costo: number;
  observaciones?: string | null;
}

/** Criterios de busqueda del inventario (RF-47 .. RF-49). */
export interface FiltroInventario {
  q?: string;
  coordinacionId?: number | null;
  categoriaId?: number | null;
  laboratorioId?: number | null;
  condicion?: CondicionEquipo | null;
  /** RF-47: la pestana "Todos" ignora el filtro de condicion. */
  todas?: boolean;
}

/**
 * Pestanas del listado (RF-47).
 *
 * <p><b>"Todos" es la primera y viene activa al entrar (v3.9).</b> Hasta la
 * v3.8 lo era "Operativos", con la idea de responder a "que tengo
 * disponible"; en el uso real la pregunta que trae aqui es "que hay", y quien
 * entraba veia un inventario incompleto sin que nada se lo dijera: los
 * equipos prestados, los que estan en mantenimiento y los dados de baja
 * faltaban del recuento, y el usuario que no encontraba uno concluia que no
 * estaba registrado. El resto conserva su orden.</p>
 */
export interface PestanaCondicion {
  clave: string;
  etiqueta: string;
  condicion: CondicionEquipo | null;
  todas: boolean;
}

export const PESTANAS_INVENTARIO: PestanaCondicion[] = [
  { clave: 'todos', etiqueta: 'Todos', condicion: null, todas: true },
  { clave: 'operativos', etiqueta: 'Operativos', condicion: 'OPERATIVO', todas: false },
  { clave: 'mantenimiento', etiqueta: 'En mantenimiento', condicion: 'MANTENIMIENTO', todas: false },
  { clave: 'baja', etiqueta: 'Dados de baja', condicion: 'BAJA', todas: false },
  { clave: 'prestados', etiqueta: 'Prestados', condicion: 'PRESTADO', todas: false },
];

export const CONDICIONES: OpcionSelect<CondicionEquipo>[] = [
  { valor: 'OPERATIVO', etiqueta: 'Operativo' },
  { valor: 'PRESTADO', etiqueta: 'Prestado' },
  { valor: 'MANTENIMIENTO', etiqueta: 'En mantenimiento' },
  { valor: 'BAJA', etiqueta: 'Dado de baja' },
];

/**
 * Primera fecha admitida para la adquisicion de un bien (RF-34).
 *
 * <p>Desde la v3.10 el sistema guarda la fecha entera y no solo el año: el
 * formato de registro de uso pide la de la orden de compra (RF-78), y de un
 * año no se saca una fecha.</p>
 */
export const FECHA_MINIMA_ADQUISICION = '1980-01-01';

/** RN-25: la fecha de adquisicion no puede ser futura. */
export function fechaMaximaAdquisicion(): string {
  return hoyIso();
}

/**
 * La fecha de hoy tal como la esperan los campos {@code type="date"}.
 *
 * <p>No se usa {@code toISOString()}: convierte a UTC, y en Lima —cinco horas
 * por detras— cada tarde devuelve la fecha del dia siguiente, de modo que el
 * maximo del campo dejaba pasar un dia futuro.</p>
 */
export function hoyIso(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/**
 * Acciones que admite un bien segun su condicion (ERS 8.3).
 *
 * <p>La interfaz no muestra opciones que terminarian en un error de permisos
 * o de regla de negocio (RNF-23): un bien prestado no ofrece "Dar de baja"
 * porque RN-17 lo prohibe hasta registrar la devolucion.</p>
 */
export function admiteEdicion(equipo: { condicion: CondicionEquipo }): boolean {
  return equipo.condicion !== 'BAJA';
}

export function admiteMantenimiento(equipo: { condicion: CondicionEquipo }): boolean {
  return equipo.condicion === 'OPERATIVO';
}

export function admiteBaja(equipo: { condicion: CondicionEquipo }): boolean {
  return equipo.condicion === 'OPERATIVO' || equipo.condicion === 'MANTENIMIENTO';
}

export function admiteReincorporacion(equipo: { condicion: CondicionEquipo }): boolean {
  return equipo.condicion === 'BAJA';
}

export function admiteRetornoOperativo(equipo: { condicion: CondicionEquipo }): boolean {
  return equipo.condicion === 'MANTENIMIENTO';
}
