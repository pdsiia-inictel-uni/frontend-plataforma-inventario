/**
 * Categoria de bienes (RF-31, RF-32).
 *
 * <p>El catalogo es institucional y compartido por todas las Coordinaciones.
 * Desde la version 2.0 no lleva plantilla de atributos: el bien tiene un
 * conjunto de campos fijos (C-05 de la ERS).</p>
 */
export interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string;
  activa: boolean;
  fechaCreacion: string;
}

/** Alta y edicion de una categoria. */
export interface CategoriaPeticion {
  nombre: string;
  descripcion?: string | null;
}
