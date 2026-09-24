/**
 * Formato de registro de uso de equipos de investigacion (RF-78), en PDF.
 *
 * <p>Se genera a partir de un registro de uso externo guardado: su apertura
 * (puntos 1 a 5), su cierre si ya lo tiene (6 a 10) y los datos del equipo
 * (punto 2). Las firmas (punto 9) salen en blanco para firmarse a mano.</p>
 */
export interface FormatoUsoGenerado {
  nombre: string;
  contenido: Blob;
}
