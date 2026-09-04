/**
 * Configuracion del entorno - PRODUCCION.
 *
 * Sustituye a environment.ts al compilar con `ng build` (configuracion
 * production, fileReplacements de angular.json).
 *
 * Aqui NO va ningun secreto: este archivo termina dentro del JavaScript que
 * descarga el navegador y cualquiera lo lee (RNF-45). La clave de firma de los
 * tokens (APP_JWT_SECRET) vive solo en el backend.
 *
 * apiUrl es una ruta relativa, no una direccion: el nginx del frontend sirve la
 * aplicacion y reenvia /api al backend (bloque `location /api/` de nginx.conf),
 * de modo que para el navegador todo sale del mismo origen. No hay peticion
 * cruzada, no interviene CORS y connect-src 'self' basta (RNF-44b).
 *
 * Por eso la direccion del backend NO se escribe aqui: vive en el proxy_pass de
 * nginx.conf, que es configuracion del contenedor. Cocerla en este archivo la
 * metaria dentro del paquete compilado y cambiar de servidor obligaria a
 * reconstruir la imagen del frontend.
 */
export const environment = {
  produccion: true,
  /** Raiz de la API. Todos los adaptadores HTTP cuelgan de aqui. */
  apiUrl: '/api',
  nombreSistema: 'Sistema de Gestión de Inventarios',
  /** RN-01: la institucion es una constante, no un dato editable. */
  institucion: 'INICTEL-UNI',
  version: '3.8',
};
