/**
 * Configuracion del entorno - DESARROLLO LOCAL (`ng serve`).
 *
 * En produccion el empaquetador lo sustituye por environment.prod.ts
 * (fileReplacements de angular.json), de modo que ningun valor de aqui viaja al
 * paquete publicado.
 *
 * Aqui NO va ningun secreto: todo lo que se escribe en un archivo del frontend
 * acaba dentro del JavaScript que descarga el navegador (RNF-45). El token JWT
 * lo emite el backend al iniciar sesion; el frontend solo lo guarda y lo
 * reenvia (jwt.interceptor).
 *
 * apiUrl es una ruta relativa, igual que en produccion: `ng serve` reenvia /api
 * hacia http://localhost:8080 segun proxy.conf.json, asi que el navegador no ve
 * una peticion cruzada y no interviene CORS. Para trabajar contra otro backend
 * se cambia el `target` de proxy.conf.json, no este archivo.
 */
export const environment = {
  produccion: false,
  /** Raiz de la API. Todos los adaptadores HTTP cuelgan de aqui. */
  apiUrl: '/api',
  nombreSistema: 'Sistema de Gestión de Inventarios',
  /** RN-01: la institucion es una constante, no un dato editable. */
  institucion: 'Desarrollado por INICTEL-UNI',
  version: '3.8',
};
