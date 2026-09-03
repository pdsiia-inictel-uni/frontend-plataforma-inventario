# =============================================================================
# Dos etapas: Node compila la aplicacion Angular y nginx sirve el resultado. La
# imagen final no lleva Node ni node_modules, solo los archivos estaticos
# =============================================================================

# ----------------------------------------------------------------- Compilacion
FROM node:22-alpine AS construccion

WORKDIR /origen

# Las dependencias primero: mientras el lockfile no cambie, Docker reutiliza
# esta capa y un cambio en una plantilla no vuelve a instalar el arbol entero.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# -------------------------------------------------------------------- Servicio
FROM nginx:1.27-alpine AS servicio

RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx.conf                /etc/nginx/conf.d/inventario.conf
COPY seguridad-cabeceras.conf  /etc/nginx/seguridad-cabeceras.conf

# El build de Angular deja la aplicacion en dist/frontend/browser.
COPY --from=construccion /origen/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
