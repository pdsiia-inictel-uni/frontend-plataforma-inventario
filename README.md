## Desarrollo de Sistema de Inventariado de INICTEL-UNI

- Java 21 (Backend)
- Sprint Boot (Maven)
- Angular 21 (Frontend)
- Base de datos (PostgreSQL 17)

**Desarrollado por [@velardesoft](https://github.com/velardesoft)**

## Licencia MIT

Distribuido bajo la **Licencia MIT**. El texto completo esta en el archivo
[LICENSE](LICENSE) de este directorio.

## Variables de entorno

Angular no lee archivos `.env`: la configuracion se compila dentro del paquete.
Vive en dos archivos, y `ng build` sustituye el primero por el segundo
(`fileReplacements` de `angular.json`).

| Archivo | Cuando se usa | `apiUrl` |
|---|---|---|
| `src/environments/environment.ts` | `ng serve` y `ng build --configuration development` | `/api` a traves de `proxy.conf.json` hacia `http://localhost:8080` |
| `src/environments/environment.prod.ts` | `ng build` (produccion, es la que va en la imagen Docker) | `/api`, que el nginx del frontend reenvia al backend |

En ninguno de los dos va un secreto: todo lo que se escribe ahi termina dentro
del JavaScript que descarga el navegador (RNF-45).

Cada archivo empieza con la constante `ORIGEN_API`, que es el unico valor que
se toca al cambiar de backend.

### Apuntar a un backend ya desplegado

**Mismo dominio** (el nginx de este proyecto sirve la aplicacion y reenvia
`/api`): no se toca `ORIGEN_API`. Basta cambiar `proxy_pass` en `nginx.conf`.
No interviene CORS.

**Dominios separados** (por ejemplo frontend en Vercel y backend en Render):

1. `environment.prod.ts` → `const ORIGEN_API = 'https://mi-backend.ejemplo';`
   (sin barra final y sin `/api`).
2. Backend, `.env.prod` seccion 8 →
   `APP_CORS_ORIGENES_PERMITIDOS=https://mi-frontend.ejemplo`, con el origen
   exacto y sin barra final. La configuracion de CORS ya esta implementada
   (`SeguridadConfig`): admite `Authorization` y expone `Content-Disposition`,
   que es la cabecera que da nombre a los reportes descargados.
3. `src/index.html`, etiqueta `<meta>` de la CSP → anadir el origen del backend
   a `connect-src`. La CSP se evalua **antes** que CORS: sin esto la peticion
   no llega a salir del navegador.
4. `seguridad-cabeceras.conf` → el mismo anadido en `connect-src`, solo si el
   frontend se sigue sirviendo con el nginx de este proyecto.

El backend debe responder por HTTPS: la pagina va por HTTPS y
`upgrade-insecure-requests` reescribe cualquier llamada `http://`.
