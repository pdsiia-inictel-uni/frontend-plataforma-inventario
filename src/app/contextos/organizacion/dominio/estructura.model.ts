/**
 * Jerarquia organizacional de la institucion (ERS seccion 2.2).
 *
 * INICTEL-UNI > Direccion > Coordinacion > Laboratorio. La institucion es una
 * constante del sistema (RN-01) y por eso no tiene modelo propio: viaja como
 * un simple nombre en la estructura.
 */

/** Direccion de la institucion (RF-10). */
export interface Direccion {
  id: number;
  nombre: string;
  sigla?: string;
  descripcion?: string;
  activa: boolean;
  fechaCreacion: string;
}

/** Alta y edicion de una direccion. */
export interface DireccionPeticion {
  nombre: string;
  sigla?: string | null;
  descripcion?: string | null;
}

/**
 * Coordinacion: unidad de aislamiento del sistema (RF-11).
 *
 * Trae el resumen en linea que exige RF-15 para la vista de estructura, de
 * modo que el Administrador ve de un vistazo si la coordinacion puede operar.
 */
export interface Coordinacion {
  id: number;
  direccionId: number;
  direccionNombre: string;
  nombre: string;
  descripcion?: string;
  activa: boolean;
  responsableId?: number;
  responsable?: string;
  operadores: number;
  laboratorios: number;
  bienesOperativos: number;
  bienesPrestados: number;
  bienesEnMantenimiento: number;
  bienesDadosDeBaja: number;
  bienesTotal: number;
}

/** Edicion de una coordinacion. */
export interface CoordinacionPeticion {
  direccionId: number;
  nombre: string;
  descripcion?: string | null;
}

/**
 * Alta de una coordinacion junto a su primer laboratorio (RN-26).
 *
 * <p>Los dos nacen en el mismo acto: una coordinacion sin laboratorios no
 * puede registrar bienes, y crearla "para completarla despues" deja una
 * unidad a medio hacer que nadie puede usar.</p>
 */
export interface NuevaCoordinacionPeticion extends CoordinacionPeticion {
  laboratorioNombre: string;
  laboratorioUbicacion?: string | null;
}

/** Laboratorio: ubicacion fisica opcional de un bien (RF-12). */
export interface Laboratorio {
  id: number;
  coordinacionId: number;
  nombre: string;
  ubicacion?: string;
  activo: boolean;
  bienesUbicados: number;
}

/** Alta y edicion de un laboratorio. */
export interface LaboratorioPeticion {
  coordinacionId: number;
  nombre: string;
  ubicacion?: string | null;
}

/** Rama del arbol: una direccion con sus coordinaciones. */
export interface RamaDireccion {
  direccion: Direccion;
  coordinaciones: Coordinacion[];
}

/** Arbol completo que consulta el Administrador (RF-09, RF-15). */
export interface Estructura {
  institucion: string;
  direcciones: RamaDireccion[];
  /** RF-75: alerta critica; una coordinacion sin responsable no puede operar. */
  coordinacionesSinResponsable: number;
}

/**
 * Ambito de trabajo que se muestra en el encabezado de cada vista.
 *
 * ERS 8.1: el usuario nunca debe dudar de donde esta parado, asi que la
 * coordinacion se nombra siempre junto a su direccion.
 */
export function describirAmbito(coordinacion?: Coordinacion | null): string {
  if (!coordinacion) {
    return '';
  }
  return `${coordinacion.nombre} - ${coordinacion.direccionNombre}`;
}

/** Una coordinacion sin responsable vigente no admite operacion (RN-07). */
export function sinResponsable(coordinacion: Coordinacion): boolean {
  return coordinacion.responsableId == null;
}
