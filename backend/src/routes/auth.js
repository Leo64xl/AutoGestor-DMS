const express = require("express");
const bcrypt = require("bcryptjs");
const { Usuario, Rol } = require("../models");
const { requiereSesion } = require("../middleware/auth");
const { registrar } = require("../middleware/bitacora");

const router = express.Router();

const PASSWORD_MINIMO = 8;

function perfilPublico(usuario) {
  return {
    id: usuario.id,
    username: usuario.username,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol ? { id: usuario.rol.id, nombre: usuario.rol.nombre, permisos: usuario.rol.permisos } : null,
    activo: usuario.activo,
    requiereCambioPassword: usuario.requiereCambioPassword,
  };
}

/** RF-001: inicio de sesion con usuario y contrasena. */
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contrasena son obligatorios" });
  }

  const usuario = await Usuario.findOne({ where: { username }, include: Rol });
  // Mensaje generico: no revela si el usuario existe.
  const credencialesOk = usuario ? await bcrypt.compare(password, usuario.passwordHash) : false;

  if (!usuario || !credencialesOk) {
    await registrar(req, "LOGIN_FALLIDO", { entidad: "usuario", detalle: `Intento con usuario "${username}"` });
    return res.status(401).json({ error: "Credenciales invalidas" });
  }
  if (!usuario.activo) {
    await registrar(req, "LOGIN_RECHAZADO_INACTIVO", { entidad: "usuario", entidadId: usuario.id });
    return res.status(403).json({ error: "La cuenta esta desactivada" });
  }

  req.session.usuarioId = usuario.id;
  usuario.ultimoAcceso = new Date();
  await usuario.save();

  req.usuario = usuario;
  await registrar(req, "LOGIN", { entidad: "usuario", entidadId: usuario.id });

  // RF-002: el frontend debe enviar al cambio de contrasena si viene en true.
  res.json({ usuario: perfilPublico(usuario) });
});

/** Recupera la sesion vigente al recargar la aplicacion. */
router.get("/sesion", requiereSesion, (req, res) => {
  res.json({ usuario: perfilPublico(req.usuario) });
});

/** RF-002: cambio de contrasena (obligatorio en el primer acceso). */
router.post("/cambiar-password", requiereSesion, async (req, res) => {
  const { passwordActual, passwordNueva } = req.body || {};
  if (!passwordActual || !passwordNueva) {
    return res.status(400).json({ error: "Debes enviar la contrasena actual y la nueva" });
  }
  if (passwordNueva.length < PASSWORD_MINIMO) {
    return res.status(400).json({ error: `La nueva contrasena debe tener al menos ${PASSWORD_MINIMO} caracteres` });
  }
  if (passwordNueva === passwordActual) {
    return res.status(400).json({ error: "La nueva contrasena debe ser distinta de la actual" });
  }
  if (!(await bcrypt.compare(passwordActual, req.usuario.passwordHash))) {
    return res.status(400).json({ error: "La contrasena actual no es correcta" });
  }

  // RNF-004: se almacena unicamente el hash bcrypt.
  req.usuario.passwordHash = await bcrypt.hash(passwordNueva, 10);
  req.usuario.requiereCambioPassword = false;
  await req.usuario.save();

  await registrar(req, "CAMBIO_PASSWORD", { entidad: "usuario", entidadId: req.usuario.id });
  res.json({ usuario: perfilPublico(req.usuario) });
});

router.post("/logout", async (req, res) => {
  if (req.session?.usuarioId) {
    const usuario = await Usuario.findByPk(req.session.usuarioId);
    req.usuario = usuario;
    await registrar(req, "LOGOUT", { entidad: "usuario", entidadId: req.session.usuarioId });
  }
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = { router, perfilPublico, PASSWORD_MINIMO };
