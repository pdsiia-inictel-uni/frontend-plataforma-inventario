/**
 * Declaracion de {@code import.meta.glob}, que el empaquetador resuelve en
 * tiempo de compilacion sustituyendo la llamada por un objeto literal.
 *
 * <p>La usa la prueba de regresion de la Content-Security-Policy (RNF-07)
 * para recorrer las plantillas del proyecto sin acceder al sistema de
 * archivos. Se declara aqui en lugar de anadir los tipos completos del
 * empaquetador al proyecto: es lo unico que se necesita de ellos.</p>
 */
interface ImportMeta {
  glob(
    patron: string,
    opciones: { query: string; import: string; eager: true },
  ): Record<string, string>;
}
