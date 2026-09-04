/**
 * Configuracion del entorno - DESARROLLO LOCAL (`ng serve`).
 *
 * Este archivo es el que compila `ng build --configuration development`. En
 * produccion el empaquetador lo sustituye por environment.prod.ts
 * (fileReplacements de angular.json), de modo que ningun valor de aqui viaja
 * al paquete publicado.
 *
 * Aqui NO va ningun secreto: todo lo que se escribe en un archivo del frontend
 * acaba dentro del JavaScript que descarga el navegador y cualquiera lo lee
 * (RNF-45). El token JWT lo emite el backend al iniciar sesion; el frontend
 * solo lo guarda y lo reenvia (jwt.interceptor).
 */

/**
 * Origen del backend. Es el UNICO valor que se toca al cambiar de servidor.
 *
 *   ''                        Mismo origen. `ng serve` reenvia /api hacia
 *                             http://localhost:8080 con proxy.conf.json, asi
 *                             que el navegador no ve una peticion cruzada y no
 *                             interviene CORS. Es el modo por defecto y el
 *                             recomendado para trabajar en local.
 *
 *   'https://api.ejemplo.pe'  Backend ya desplegado. La peticion pasa a ser de
 *                             otro origen y hacen falta DOS cosas mas:
 *
 *     1. Backend: anadir http://localhost:4200 a APP_CORS_ORIGENES_PERMITIDOS
 *        del .env que use ese servidor. Ya viene puesto en backend/.env.
 *     2. index.html: la Content-Security-Policy declara connect-src 'self' y
 *        el navegador bloquea la llamada aunque CORS la permita. Hay que
 *        anadir el origen:  connect-src 'self' https://api.ejemplo.pe
 *
 * Sin barra final: la ruta se compone abajo.
 */
const ORIGEN_API = '';

export const environment = {
  produccion: false,
  /** Raiz de la API. Todos los adaptadores HTTP cuelgan de aqui. */
  apiUrl: `${ORIGEN_API}/api`,
  nombreSistema: 'Sistema de Gestión de Inventarios',
  /** RN-01: la institucion es una constante, no un dato editable. */
  institucion: 'Desarrollado por INICTEL-UNI',
  version: '3.8',
};
