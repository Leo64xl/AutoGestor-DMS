const express = require("express");
const bcrypt = require("bcryptjs");
const { Usuario, Rol } = require("../models");
const { PERMISOS, requierePermiso } = require("../middleware/auth");
const { registrar } = require("../middleware/bitacora");
const { perfilPublico, PASSWORD_MINIMO } = require("./auth");

const router = express.Router();
router.use(requierePermiso(PERMISOS.USUARIOS_GESTIONAR));

router.get("/roles", async (_req, res) => {
  res.json(await Rol.findAll({ order: [["nombre", "ASC"]] }));
});

router.get("/", async (_req, res) => {
  const usuarios = await Usuario.findAll({
    include: Rol,
    order: [["nombre", "ASC"]],
    attributes: { exclude: ["passwordHash"] },
  });
  res.json(usuarios);
});

/** RF-003 / RF-004: alta de usuario con rol y contrasena temporal. */
router.post("/", async (req, res) => {
  const { username, nombre, email, rolId, passwordTemporal } = req.body || {};
  if (!username || !nombre || !rolId || !passwordTemporal) {
    return res.status(400).json({ error: "username, nombre, rolId y passwordTemporal son obligatorios" });
  }
  if (passwordTemporal.length < PASSWORD_MINIMO) {
    return res.status(400).json({ error: `La contrasena temporal debe tener al menos ${PASSWORD_MINIMO} caracteres` });
  }
  if (await Usuario.findOne({ where: { username } })) {
    // UC-06, flujo alterno 2a
    return res.status(409).json({ error: "El nombre de usuario ya esta registrado" });
  }
  if (!(await Rol.findByPk(rolId))) {
    return res.status(400).json({ error: "El rol indicado no existe" });
  }

  const usuario = await Usuario.create({
    username,
    nombre,
    email: email || null,
    rolId,
    passwordHash: await bcrypt.hash(passwordTemporal, 10),
    requiereCambioPassword: true, // RF-002
  });

  await registrar(req, "ALTA_USUARIO", { entidad: "usuario", entidadId: usuario.id, detalle: `username=${username}, rolId=${rolId}` });
  res.status(201).json(perfilPublico(await usuario.reload({ include: Rol })));
});

/** RF-004: reasignacion de rol. */
router.put("/:id", async (req, res) => {
  const usuario = await Usuario.findByPk(req.params.id, { include: Rol });
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

  const { nombre, email, rolId } = req.body || {};
  if (rolId && !(await Rol.findByPk(rolId))) {
    return res.status(400).json({ error: "El rol indicado no existe" });
  }
  if (nombre) usuario.nombre = nombre;
  if (email !== undefined) usuario.email = email || null;
  if (rolId) usuario.rolId = rolId;
  await usuario.save();

  await registrar(req, "EDICION_USUARIO", { entidad: "usuario", entidadId: usuario.id });
  res.json(perfilPublico(await usuario.reload({ include: Rol })));
});

/** RF-005: desactivar / reactivar conservando el historial. */
router.patch("/:id/estado", async (req, res) => {
  const usuario = await Usuario.findByPk(req.params.id, { include: Rol });
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
  if (usuario.id === req.usuario.id) {
    return res.status(400).json({ error: "No puedes desactivar tu propia cuenta" });
  }

  usuario.activo = Boolean(req.body?.activo);
  await usuario.save();

  await registrar(req, usuario.activo ? "REACTIVACION_USUARIO" : "DESACTIVACION_USUARIO", {
    entidad: "usuario",
    entidadId: usuario.id,
  });
  res.json(perfilPublico(usuario));
});

/** Restablece la contrasena y vuelve a exigir el cambio en el siguiente acceso. */
router.post("/:id/reset-password", async (req, res) => {
  const usuario = await Usuario.findByPk(req.params.id, { include: Rol });
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

  const { passwordTemporal } = req.body || {};
  if (!passwordTemporal || passwordTemporal.length < PASSWORD_MINIMO) {
    return res.status(400).json({ error: `La contrasena temporal debe tener al menos ${PASSWORD_MINIMO} caracteres` });
  }

  usuario.passwordHash = await bcrypt.hash(passwordTemporal, 10);
  usuario.requiereCambioPassword = true;
  await usuario.save();

  await registrar(req, "RESET_PASSWORD", { entidad: "usuario", entidadId: usuario.id });
  res.json({ ok: true });
});

module.exports = router;
