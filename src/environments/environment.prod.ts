/**
 * Configuracion del entorno - PRODUCCION.
 *
 * Sustituye a environment.ts al compilar con `ng build` (configuracion
 * production, fileReplacements de angular.json).
 *
 * Aqui NO va ningun secreto, por el mismo motivo que en desarrollo: este
 * archivo termina dentro del JavaScript publico (RNF-45). La clave de firma de
 * los tokens (APP_JWT_SECRET) vive solo en el backend.
 */

/**
 * Origen del backend desplegado. Es el UNICO valor que se toca al cambiar de
 * servidor, y decide si el despliegue necesita CORS o no.
 *
 * ---------------------------------------------------------------------------
 * MODO A - MISMO ORIGEN  (valor '')  <- el que usa la imagen Docker de aqui
 * ---------------------------------------------------------------------------
 * El nginx del frontend sirve la aplicacion y reenvia /api al backend
 * (bloque `location /api/` de nginx.conf). Para el navegador todo sale del
 * mismo dominio: no hay peticion cruzada, no interviene CORS y la CSP
 * connect-src 'self' basta. Al desplegar solo hay que apuntar el proxy_pass de
 * nginx.conf al backend real. NADA que cambiar en este archivo.
 *
 * ---------------------------------------------------------------------------
 * MODO B - DOMINIOS SEPARADOS  (p. ej. frontend en Vercel, backend en Render)
 * ---------------------------------------------------------------------------
 * Se escribe abajo el origen del backend, sin barra final ni /api:
 *
 *     const ORIGEN_API = 'https://inventario-api.onrender.com';
 *
 * y hay que acompanarlo de otros tres cambios, o la llamada se bloquea:
 *
 *   1. Backend (.env.prod, seccion 8):
 *        APP_CORS_ORIGENES_PERMITIDOS=https://dominio-del-frontend
 *      Origen exacto, sin barra final. Es lo que autoriza al navegador; la
 *      configuracion de CORS ya esta implementada (SeguridadConfig) y admite
 *      la cabecera Authorization y expone Content-Disposition, que es la que
 *      da nombre a los reportes descargados.
 *
 *   2. index.html, etiqueta <meta> de la CSP: anadir el origen a connect-src,
 *        connect-src 'self' https://inventario-api.onrender.com
 *      La CSP se aplica ANTES que CORS: sin esto la peticion no llega a salir.
 *
 *   3. seguridad-cabeceras.conf (solo si el frontend se sirve con el nginx de
 *      este proyecto): el mismo anadido en connect-src de la cabecera
 *      Content-Security-Policy, que es la que manda sobre la etiqueta meta.
 *
 * El backend debe ir por HTTPS: la pagina se sirve por HTTPS y la directiva
 * upgrade-insecure-requests convierte cualquier llamada http:// en https://.
 */
const ORIGEN_API = 'http://192.168.14.11:8083';

export const environment = {
  produccion: true,
  /** Raiz de la API. Todos los adaptadores HTTP cuelgan de aqui. */
  apiUrl: `${ORIGEN_API}/api`,
  nombreSistema: 'Sistema de Gestión de Inventarios',
  /** RN-01: la institucion es una constante, no un dato editable. */
  institucion: 'INICTEL-UNI',
  version: '3.8',
};
