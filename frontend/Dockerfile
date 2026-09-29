# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Interfaz de AutoGestor DMS
# "desarrollo" levanta Vite con recarga en caliente; "produccion" compila el
# sitio y lo sirve con nginx.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

# --------------------------------- desarrollo -------------------------------
FROM base AS desarrollo
RUN npm ci
COPY . .
EXPOSE 5173
# --host publica el servidor fuera del contenedor, no solo en su localhost.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --------------------------------- compilacion ------------------------------
FROM base AS compilacion
RUN npm ci
COPY . .
# La URL de la API se incrusta al compilar: Vite reemplaza import.meta.env
# en el bundle, de modo que no puede cambiarse despues sin volver a compilar.
ARG VITE_API_URL=http://localhost:3001/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --------------------------------- produccion -------------------------------
FROM nginx:1.27-alpine AS produccion
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=compilacion /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
