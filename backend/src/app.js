require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");

const { requiereSesion, bloqueaSiRequiereCambio } = require("./middleware/auth");
const { RAIZ: RAIZ_ARCHIVOS } = require("./config/almacenamiento");
const { router: authRouter } = require("./routes/auth");
const usuariosRouter = require("./routes/usuarios");
const { router: vehiculosRouter } = require("./routes/vehiculos");
const clientesRouter = require("./routes/clientes");
const { router: ventasRouter } = require("./routes/ventas");
const pruebasRouter = require("./routes/pruebas");
const operacionesRouter = require("./routes/operaciones");
const financiamientoRouter = require("./routes/financiamiento");
const postventaRouter = require("./routes/postventa");
const reportesRouter = require("./routes/reportes");
const bitacoraRouter = require("./routes/bitacora");

const app = express();

app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

const minutosInactividad = Number(process.env.SESSION_IDLE_MINUTES || 15);
app.use(
  session({
    name: "autogestor.sid",
    secret: process.env.SESSION_SECRET || "dev-secret-no-usar-en-produccion",
    resave: false,
    saveUninitialized: false,
    // RNF-005: la cookie se renueva en cada peticion, de modo que la sesion
    // caduca tras SESSION_IDLE_MINUTES minutos sin actividad.
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: minutosInactividad * 60 * 1000,
    },
  })
);

// RF-011: fotografias de los vehiculos. Se sirven como estaticos y son de solo
// lectura: la escritura pasa por /api/vehiculos/fotos, que exige sesion y permiso.
app.use(
  "/uploads",
  express.static(RAIZ_ARCHIVOS, {
    maxAge: "7d",
    // Una imagen inexistente debe caer en el 404 general, no en el manejador de errores.
    fallthrough: true,
    index: false,
    setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"),
  })
);

app.get("/api/salud", (_req, res) => res.json({ ok: true, servicio: "AutoGestor DMS API" }));

app.use("/api/auth", authRouter);

// Todo lo demas exige sesion activa y contrasena ya definida (RF-001, RF-002).
app.use("/api/usuarios", requiereSesion, bloqueaSiRequiereCambio, usuariosRouter);
app.use("/api/vehiculos", requiereSesion, bloqueaSiRequiereCambio, vehiculosRouter);
app.use("/api/clientes", requiereSesion, bloqueaSiRequiereCambio, clientesRouter);
app.use("/api/ventas", requiereSesion, bloqueaSiRequiereCambio, ventasRouter);
app.use("/api/pruebas", requiereSesion, bloqueaSiRequiereCambio, pruebasRouter);
app.use("/api/operaciones", requiereSesion, bloqueaSiRequiereCambio, operacionesRouter);
app.use("/api/financiamiento", requiereSesion, bloqueaSiRequiereCambio, financiamientoRouter);
app.use("/api/postventa", requiereSesion, bloqueaSiRequiereCambio, postventaRouter);
app.use("/api/reportes", requiereSesion, bloqueaSiRequiereCambio, reportesRouter);
app.use("/api/bitacora", requiereSesion, bloqueaSiRequiereCambio, bitacoraRouter);

app.use((_req, res) => res.status(404).json({ error: "Recurso no encontrado" }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({ error: "El registro ya existe (valor duplicado)" });
  }
  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({ error: err.errors.map((e) => e.message).join("; ") });
  }
  res.status(500).json({ error: "Error interno del servidor" });
});

module.exports = app;
