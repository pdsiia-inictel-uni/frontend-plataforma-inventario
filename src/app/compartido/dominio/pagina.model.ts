/**
 * Tipos de paginacion compartidos por todos los contextos (RF-21).
 */

/** Envoltura de paginacion devuelta por la API. */
export interface Pagina<T> {
  contenido: T[];
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
  primera: boolean;
  ultima: boolean;
}

/** Peticion de paginacion y ordenamiento que entiende el backend. */
export interface CriterioPagina {
  pagina?: number;
  tamano?: number;
  ordenarPor?: string;
  descendente?: boolean;
}

export const PAGINA_VACIA: Pagina<never> = {
  contenido: [],
  pagina: 0,
  tamano: 10,
  totalElementos: 0,
  totalPaginas: 0,
  primera: true,
  ultima: true,
};
