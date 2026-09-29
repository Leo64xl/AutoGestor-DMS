# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# API de AutoGestor DMS
# Una sola imagen con dos destinos: "desarrollo" (recarga en caliente) y
# "produccion" (solo dependencias de ejecucion).
# ---------------------------------------------------------------------------

FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=development
# Copiar primero los manifiestos aprovecha la cache: las dependencias solo se
# reinstalan cuando cambia package.json, no con cada cambio de codigo.
COPY package*.json ./

# --------------------------------- desarrollo -------------------------------
FROM base AS desarrollo
RUN npm ci
COPY . .
EXPOSE 3001
# Carga los datos iniciales y luego levanta la API. El seed usa findOrCreate, asi
# que repetirlo en cada arranque no duplica registros ni pisa los cambios.
CMD ["npm", "run", "arranque:docker"]

# --------------------------------- produccion -------------------------------
FROM base AS produccion
ENV NODE_ENV=production
RUN npm ci --omit=dev
COPY . .

# Las fotografias de los vehiculos viven fuera de la imagen, en un volumen.
RUN mkdir -p uploads/vehiculos && chown -R node:node /app
USER node

EXPOSE 3001
# Healthcheck del propio contenedor: responde el endpoint /api/salud.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "arranque:prod"]
