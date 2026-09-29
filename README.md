# AutoGestor DMS — Etapa 2

Versión funcional del sistema de gestión para Concesionaria Automotriz del Valle, construida sobre la
planeación de la Etapa 1 (ISO/IEC 25010). Cubre los 41 requisitos funcionales del documento.

## Alcance implementado

| Módulo | Requisitos cubiertos |
| --- | --- |
| Usuarios y seguridad | RF-001 a RF-006 (UC-06) |
| Vehículos e inventario | RF-007 a RF-012 (UC-05) |
| Clientes y prospectos | RF-013 a RF-017 |
| Cotizaciones y apartados | RF-018 a RF-022 (UC-01, UC-02) |
| Pruebas de manejo | RF-023 a RF-025 (UC-04) |
| Ventas y documentación | RF-026 a RF-030 (UC-03) |
| Financiamiento y pagos | RF-031 a RF-034 |
| Postventa | RF-035, RF-036 |
| Reportes y auditoría | RF-037 a RF-041, RNF-012 |

No funcionales atendidos en el código: RNF-004 (bcrypt), RNF-005 (cierre de sesión por inactividad),
RNF-009 (interfaz web responsiva), RNF-010 (.xlsx compatible con Excel 2016+), RNF-012 (bitácora
inmutable).

## Stack

- **Backend:** Node.js + Express 5, Sequelize, MySQL, `express-session`, `bcryptjs`.
- **Frontend:** React 19 + Redux Toolkit + react-redux, Vite. La navegación se resuelve con un slice de
  Redux (`ui.vista`); no se usa enrutador externo.

## Puesta en marcha con Docker (recomendado)

Es la forma soportada para colaborar: no hace falta instalar Node ni MySQL, y todos trabajan sobre
las mismas versiones. Solo se necesita [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
cp .env.example .env      # en Windows: copy .env.example .env
docker compose up         # la primera vez tarda unos minutos construyendo las imágenes
```

Cuando la consola muestre `Servidor backend en http://localhost:3001`, carga los datos iniciales
**en otra terminal** (solo la primera vez):

```bash
docker compose run --rm seed
```

Listo:

| Servicio | Dirección | Notas |
| --- | --- | --- |
| Interfaz | http://localhost:5173 | Vite con recarga en caliente |
| API | http://localhost:3001/api | Express |
| MySQL | `localhost:3307` | puerto 3307 para no chocar con un MySQL ya instalado |

El código se monta desde tu carpeta, así que **al guardar un archivo el cambio se recarga solo**: no
hay que reconstruir nada. Reconstruye (`docker compose up --build`) únicamente cuando cambien las
dependencias de `package.json`.

### Comandos habituales

```bash
docker compose up -d                 # en segundo plano
docker compose logs -f backend       # seguir los registros de un servicio
docker compose exec backend sh       # abrir una terminal dentro del contenedor
docker compose down                  # detener (conserva la base de datos)
docker compose down -v               # detener y BORRAR la base y las fotografías
```

Tras un `down -v` hay que volver a ejecutar `docker compose run --rm seed`.

### Al cambiar el modelo de datos

El arranque crea las tablas que falten pero no altera las existentes. Si modificas una entidad en
`backend/src/models/index.js`, la forma limpia de aplicarlo es recrear la base:

```bash
docker compose down -v && docker compose up -d && docker compose run --rm seed
```

### Despliegue

`docker-compose.prod.yml` construye las imágenes finales: el frontend compilado se sirve con nginx y
la base de datos no publica ningún puerto hacia afuera. Exige definir `SESSION_SECRET`,
`DB_PASSWORD` y `MYSQL_ROOT_PASSWORD` en el `.env`; si falta alguno, Compose se detiene con un aviso.

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

## Puesta en marcha sin Docker

Requiere Node.js 22+ y un MySQL propio.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env     # captura DB_USER y DB_PASSWORD de tu MySQL
npm run seed             # crea la base de datos, las tablas y los datos iniciales
npm run dev              # http://localhost:3001
```

`npm run seed` crea la base `autogestor_dms` si no existe, los cuatro perfiles del documento
(Administrador, Gerente de Ventas, Vendedor, Auditor), usuarios de prueba, un catálogo de 8 vehículos,
5 accesorios, 3 prospectos y los mínimos de inventario por modelo.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

## Matriz de roles y permisos

Derivada del diagrama general de casos de uso (Figura 1) y de la descripción de actores de la Etapa 1.
Cada perfil ve en el menú únicamente los módulos de su columna: lo que no le corresponde no aparece, y
la vista tampoco se dibuja si se navega a ella por otro camino.

| Módulo | Administrador | Gerente de Ventas | Vendedor | Auditor |
| --- | :---: | :---: | :---: | :---: |
| Vehículos e inventario | gestiona | gestiona | consulta | consulta |
| Clientes y prospectos | gestiona | gestiona | gestiona | consulta |
| Cotizaciones y apartados | gestiona | consulta | gestiona | consulta |
| Pruebas de manejo | gestiona | consulta | gestiona | consulta |
| Ventas y documentación | gestiona | consulta | gestiona | consulta |
| Financiamiento y pagos | gestiona | consulta | gestiona | consulta |
| Servicios postventa | gestiona | consulta | — | consulta |
| Reportes | consulta | consulta | — | consulta |
| Usuarios y permisos | gestiona | — | — | — |
| Bitácora de eventos | consulta | — | — | consulta |

«—» significa que el módulo no existe para ese perfil: no aparece en el menú y la API responde 403.
El Administrador conserva el permiso `*` por ser el perfil técnico responsable del sistema.

Dentro de cada página, las acciones de escritura (altas, ediciones, cancelaciones) y las secciones que
no corresponden al perfil también se ocultan: por ejemplo, la alerta de inventario bajo el mínimo
(HU-13) solo la ve quien puede reordenar unidades, no el vendedor que consulta el catálogo.

## Usuarios de prueba

Los cuatro exigen definir una contraseña propia en el primer acceso (RF-002).

| Usuario | Contraseña temporal | Perfil |
| --- | --- | --- |
| `admin` | `Admin1234` | Administrador |
| `gerente` | `Gerente1234` | Gerente de Ventas |
| `vendedor` | `Vendedor1234` | Vendedor |
| `auditor` | `Auditor1234` | Auditor |

## Estructura

```
docker-compose.yml       entorno de desarrollo: base de datos, API e interfaz
docker-compose.prod.yml  imágenes compiladas para desplegar
.env.example             variables de Compose (cópialo como .env)
backend/
  index.js                 arranque del servidor y barrido de apartados vencidos
  src/config/database.js   conexión Sequelize
  src/models/index.js      modelo de datos y asociaciones
  src/middleware/          sesión, permisos y escritura de bitácora
  src/routes/              auth, usuarios, vehiculos, clientes, ventas, pruebas,
                           operaciones, financiamiento, postventa, reportes, bitacora
  src/utils/               folios, documentos imprimibles y generación de .xlsx
  src/seed/seed.js         datos iniciales
frontend/
  src/api/client.js        cliente HTTP con cookie de sesión
  src/store/               slices de Redux por módulo
  src/components/          layout y componentes de presentación
  src/pages/               una página por vista
```

## Decisiones de diseño relevantes para la calidad

- **Doble apartado imposible (CP-014).** `POST /api/ventas/apartados` abre una transacción y bloquea el
  renglón del vehículo (`SELECT ... FOR UPDATE`) antes de validar su disponibilidad, de modo que dos
  vendedores simultáneos no puedan reservar la misma unidad.
- **Liberación automática (RF-021).** Los apartados vencidos se liberan al arrancar el servidor, cada
  hora y al consultar el módulo de ventas.
- **Bitácora inmutable (RNF-012).** El router de bitácora solo expone `GET`; cualquier otro método
  responde 405. No existe ruta de edición ni de borrado en toda la API.
- **Permisos por perfil (RF-004).** El backend valida cada permiso en el middleware y el frontend usa la
  misma lista para dibujar el menú, de modo que la interfaz nunca ofrece acciones que la API rechazaría.
- **Baja lógica (RF-010).** Dar de baja un vehículo conserva el registro y su historial; solo se retira
  del catálogo activo.
- **Documentación obligatoria (RF-029, UC-03 flujo alterno 3a).** La venta no se registra sin
  identificación y comprobante de domicilio: la validación ocurre antes de abrir la transacción.
- **Venta atómica (RF-026 a RF-028).** Registrar la venta genera contrato y factura, marca el vehículo
  como vendido, pasa el cliente a «comprador» y cierra la cotización/apartado en una sola transacción.
  El anticipo del apartado se reconoce automáticamente como primer pago.
- **Entrega condicionada (RF-030).** El traspaso exige la venta liquidada (contado) o el financiamiento
  aprobado, que es donde se materializa el flujo alterno 2a del UC-03.
- **Contrato y factura** se sirven como HTML imprimible en `/api/operaciones/:id/contrato` y
  `/factura`. Conforme a la limitación declarada en la Etapa 1, la factura es un comprobante interno
  sin timbrado ante el SAT.
- **Exportación a Excel (RF-041, RNF-010).** `exceljs` genera `.xlsx` nativo. Además del export de cada
  reporte, `POST /api/reportes/exportar` recibe las columnas visibles y las filas ya filtradas de
  cualquier listado, de modo que el archivo refleja exactamente lo que el usuario ve en pantalla.
- **Pruebas de manejo (RF-023).** Se valida que no exista otra prueba de la misma unidad en una ventana
  de ±60 minutos, y `/api/pruebas/disponibilidad` sugiere horarios libres dentro del horario comercial.
