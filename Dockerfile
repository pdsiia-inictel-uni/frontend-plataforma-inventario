# =============================================================================
# Frontend - Sistema de Gestion de Inventarios INICTEL-UNI
#
# Dos etapas (RNF-44): Node compila la aplicacion Angular y nginx sirve el
# resultado. La imagen final no lleva Node, node_modules ni el codigo fuente:
# solo los archivos estaticos y la configuracion de nginx.
#
# nginx corre como usuario sin privilegios (imagen nginx-unprivileged, uid 101):
# escucha en 8080 y 8443, y docker-compose publica esos puertos como 80 y 443.
# =============================================================================

# ----------------------------------------------------------------- Compilacion
FROM node:22-alpine AS construccion

WORKDIR /origen

# Las dependencias primero: mientras el lockfile no cambie, Docker reutiliza
# esta capa y un cambio en una plantilla no vuelve a instalar el arbol entero.
# La cache de npm vive fuera de la imagen (BuildKit).
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# -------------------------------------------------------------------- Servicio
FROM nginxinc/nginx-unprivileged:1.27-alpine AS servicio

# La configuracion por defecto de la imagen escucha en 8080 con otro contenido.
USER root
RUN rm -f /etc/nginx/conf.d/default.conf
USER nginx

COPY nginx.conf                    /etc/nginx/conf.d/inventario.conf
COPY seguridad-cabeceras.conf      /etc/nginx/seguridad-cabeceras.conf

# El build de Angular deja la aplicacion en dist/frontend/browser.
COPY --from=construccion /origen/dist/frontend/browser /usr/share/nginx/html

EXPOSE 8080 8443

# Por HTTP y a /salud, que no redirige a HTTPS (ver nginx.conf).
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/salud >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
