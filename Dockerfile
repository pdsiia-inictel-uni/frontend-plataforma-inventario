# =============================================================================
# Frontend - Sistema de Gestion de Inventarios INICTEL-UNI
#
# Dos etapas (RNF-44): Node compila la aplicacion Angular y nginx sirve el
# resultado. La imagen final no lleva Node, node_modules ni el codigo fuente:
# solo los archivos estaticos y la configuracion de nginx.
#
# nginx corre como usuario sin privilegios (imagen nginx-unprivileged, uid 101)
# y escucha en 80 y 443, que docker-compose publica tal cual. Docker permite a
# un usuario sin privilegios abrir puertos bajos dentro del contenedor
# (net.ipv4.ip_unprivileged_port_start=0 por defecto).
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
COPY seguridad-comunes.conf        /etc/nginx/seguridad-comunes.conf
COPY seguridad-cabeceras.conf      /etc/nginx/seguridad-cabeceras.conf
COPY seguridad-cabeceras-api.conf  /etc/nginx/seguridad-cabeceras-api.conf

# El build de Angular deja la aplicacion en dist/frontend/browser.
COPY --from=construccion /origen/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80 443

# Por HTTPS y a la raiz: el puerto 80 solo redirige. El certificado no se
# valida porque se consulta por 127.0.0.1, no por el nombre del sitio.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --no-check-certificate -O /dev/null https://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
