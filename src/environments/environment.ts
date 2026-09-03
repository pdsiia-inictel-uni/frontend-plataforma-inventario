/**
 * Configuracion del entorno.
 *
 * En desarrollo, `ng serve` redirige /api hacia http://localhost:8080
 * mediante proxy.conf.json, de modo que no hay problemas de CORS.
 * En produccion el frontend se publica detras del mismo dominio que la API.
 */
export const environment = {
  produccion: false,
  apiUrl: '/api',
  nombreSistema: 'Sistema de Gestión de Inventarios',
  /** RN-01: la institucion es una constante, no un dato editable. */
  institucion: 'Desarrollado por INICTEL-UNI',
  version: '3.8',
};
