const express = require("express");
const { Op } = require("sequelize");
const { Cliente, Seguimiento, Usuario, Cotizacion, Apartado, Vehiculo } = require("../models");
const { PERMISOS, requierePermiso } = require("../middleware/auth");
const { registrar } = require("../middleware/bitacora");

const router = express.Router();

const { REGIMENES_FISCALES, USOS_CFDI, RFC_VALIDO, CP_VALIDO } = require("../config/sat");

const ORIGENES = ["showroom", "redes_sociales", "referido", "sitio_web"];

/**
 * Datos fiscales del receptor del CFDI 4.0 (RF-028).
 * Son opcionales: un prospecto no tiene por que darlos, pero si se capturan
 * deben ser validos porque el SAT los coteja contra su padron al timbrar.
 */
function leerDatosFiscales(cuerpo, errores) {
  const datos = {};
  const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");

  if (cuerpo.rfc !== undefined) {
    const rfc = texto(cuerpo.rfc).toUpperCase();
    if (rfc && !RFC_VALIDO.test(rfc)) errores.push("el RFC no tiene un formato valido");
    datos.rfc = rfc || null;
  }
  if (cuerpo.razonSocial !== undefined) datos.razonSocial = texto(cuerpo.razonSocial).toUpperCase() || null;
  if (cuerpo.regimenFiscal !== undefined) {
    const regimen = texto(cuerpo.regimenFiscal);
    if (regimen && !REGIMENES_FISCALES[regimen]) errores.push("el regimen fiscal no existe en el catalogo del SAT");
    datos.regimenFiscal = regimen || null;
  }
  if (cuerpo.codigoPostalFiscal !== undefined) {
    const cp = texto(cuerpo.codigoPostalFiscal);
    if (cp && !CP_VALIDO.test(cp)) errores.push("el codigo postal fiscal debe tener cinco digitos");
    datos.codigoPostalFiscal = cp || null;
  }
  if (cuerpo.usoCfdi !== undefined) {
    const uso = texto(cuerpo.usoCfdi);
    if (uso && !USOS_CFDI[uso]) errores.push("el uso del CFDI no existe en el catalogo del SAT");
    datos.usoCfdi = uso || null;
  }
  return datos;
}

/** Catalogos del SAT para alimentar los desplegables del formulario. */
router.get("/catalogos-sat", requierePermiso(PERMISOS.CLIENTES_VER), (_req, res) => {
  res.json({
    regimenesFiscales: Object.entries(REGIMENES_FISCALES).map(([clave, descripcion]) => ({ clave, descripcion })),
    usosCfdi: Object.entries(USOS_CFDI).map(([clave, descripcion]) => ({ clave, descripcion })),
  });
});
const ESTATUS = ["nuevo", "en_seguimiento", "cotizando", "cerrado", "perdido", "comprador"];

router.get("/", requierePermiso(PERMISOS.CLIENTES_VER), async (req, res) => {
  const { busqueda, estatus, origen } = req.query;
  const where = {};

  if (estatus && ESTATUS.includes(estatus)) where.estatus = estatus;
  if (origen && ORIGENES.includes(origen)) where.origen = origen;
  if (busqueda) {
    where[Op.or] = [
      { nombre: { [Op.like]: `%${busqueda}%` } },
      { apellidos: { [Op.like]: `%${busqueda}%` } },
      { email: { [Op.like]: `%${busqueda}%` } },
      { telefono: { [Op.like]: `%${busqueda}%` } },
    ];
  }

  res.json(await Cliente.findAll({ where, order: [["apellidos", "ASC"], ["nombre", "ASC"]] }));
});

/** RF-016 / HU-18: historial completo de interacciones en orden cronologico. */
router.get("/:id", requierePermiso(PERMISOS.CLIENTES_VER), async (req, res) => {
  const cliente = await Cliente.findByPk(req.params.id, {
    include: [
      {
        model: Seguimiento,
        as: "seguimientos",
        include: [{ model: Usuario, attributes: ["id", "nombre", "username"] }],
      },
      { model: Cotizacion, as: "cotizaciones", include: [{ model: Vehiculo, attributes: ["id", "vin", "marca", "modelo", "anio"] }] },
      { model: Apartado, as: "apartados", include: [{ model: Vehiculo, attributes: ["id", "vin", "marca", "modelo", "anio"] }] },
    ],
    order: [[{ model: Seguimiento, as: "seguimientos" }, "fecha", "ASC"]],
  });
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
  res.json(cliente);
});

/** RF-013 / RF-014: alta de cliente o prospecto con su origen de contacto. */
router.post("/", requierePermiso(PERMISOS.CLIENTES_GESTIONAR), async (req, res) => {
  const { nombre, apellidos, email, telefono, origen } = req.body || {};
  if (!nombre || !apellidos) {
    return res.status(400).json({ error: "nombre y apellidos son obligatorios" });
  }
  if (!email && !telefono) {
    return res.status(400).json({ error: "Captura al menos un dato de contacto (email o telefono)" });
  }
  if (origen && !ORIGENES.includes(origen)) {
    return res.status(400).json({ error: `Origen invalido. Valores permitidos: ${ORIGENES.join(", ")}` });
  }

  const errores = [];
  const fiscales = leerDatosFiscales(req.body || {}, errores);
  if (errores.length) return res.status(400).json({ error: `Datos fiscales invalidos: ${errores.join("; ")}` });

  const cliente = await Cliente.create({
    nombre,
    apellidos,
    email: email || null,
    telefono: telefono || null,
    origen: origen || "showroom",
    estatus: "nuevo", // HU-17
    ...fiscales,
  });

  await registrar(req, "ALTA_CLIENTE", { entidad: "cliente", entidadId: cliente.id, detalle: `origen=${cliente.origen}` });
  res.status(201).json(cliente);
});

router.put("/:id", requierePermiso(PERMISOS.CLIENTES_GESTIONAR), async (req, res) => {
  const cliente = await Cliente.findByPk(req.params.id);
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

  const { nombre, apellidos, email, telefono, origen } = req.body || {};
  if (origen && !ORIGENES.includes(origen)) {
    return res.status(400).json({ error: `Origen invalido. Valores permitidos: ${ORIGENES.join(", ")}` });
  }
  const errores = [];
  const fiscales = leerDatosFiscales(req.body || {}, errores);
  if (errores.length) return res.status(400).json({ error: `Datos fiscales invalidos: ${errores.join("; ")}` });

  if (nombre) cliente.nombre = nombre;
  if (apellidos) cliente.apellidos = apellidos;
  if (email !== undefined) cliente.email = email || null;
  if (telefono !== undefined) cliente.telefono = telefono || null;
  if (origen) cliente.origen = origen;
  Object.assign(cliente, fiscales);
  await cliente.save();

  await registrar(req, "EDICION_CLIENTE", { entidad: "cliente", entidadId: cliente.id });
  res.json(cliente);
});

/** RF-017: clasificacion manual del estatus del prospecto. */
router.patch("/:id/estatus", requierePermiso(PERMISOS.CLIENTES_GESTIONAR), async (req, res) => {
  const cliente = await Cliente.findByPk(req.params.id);
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

  const { estatus } = req.body || {};
  if (!ESTATUS.includes(estatus)) {
    return res.status(400).json({ error: `Estatus invalido. Valores permitidos: ${ESTATUS.join(", ")}` });
  }

  const anterior = cliente.estatus;
  cliente.estatus = estatus;
  await cliente.save();

  await registrar(req, "CAMBIO_ESTATUS_CLIENTE", { entidad: "cliente", entidadId: cliente.id, detalle: `${anterior} -> ${estatus}` });
  res.json(cliente);
});

/**
 * RF-015 / HU-09: registra una actividad de seguimiento.
 * Si el prospecto sigue en "nuevo", la primera actividad lo mueve a "en_seguimiento".
 */
router.post("/:id/seguimientos", requierePermiso(PERMISOS.CLIENTES_GESTIONAR), async (req, res) => {
  const cliente = await Cliente.findByPk(req.params.id);
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

  const { tipo, nota, fecha } = req.body || {};
  if (!["llamada", "visita", "mensaje", "correo"].includes(tipo)) {
    return res.status(400).json({ error: "Tipo de seguimiento invalido" });
  }
  if (!nota) return res.status(400).json({ error: "La nota del seguimiento es obligatoria" });

  const seguimiento = await Seguimiento.create({
    clienteId: cliente.id,
    usuarioId: req.usuario.id,
    tipo,
    nota,
    fecha: fecha ? new Date(fecha) : new Date(),
  });

  if (cliente.estatus === "nuevo") {
    cliente.estatus = "en_seguimiento";
    await cliente.save();
  }

  await registrar(req, "ALTA_SEGUIMIENTO", { entidad: "cliente", entidadId: cliente.id, detalle: `tipo=${tipo}` });
  res.status(201).json({ seguimiento, cliente });
});

module.exports = router;
