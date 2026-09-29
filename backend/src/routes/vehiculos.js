const express = require("express");
const { Op, fn, col } = require("sequelize");
const { sequelize, Vehiculo, MinimoInventario } = require("../models");
const { PERMISOS, requierePermiso } = require("../middleware/auth");
const { registrar } = require("../middleware/bitacora");
const { subirFoto, rutaPublica, eliminarFoto, TAMANO_MAXIMO } = require("../config/almacenamiento");

const router = express.Router();

const ESTATUS = ["disponible", "apartado", "vendido", "en_transito"];

/** Criterios de ordenamiento admitidos por el catalogo (RF-009). */
const ORDENES = {
  relevancia: [["marca", "ASC"], ["modelo", "ASC"], ["anio", "DESC"]],
  precio_asc: [["precio", "ASC"]],
  precio_desc: [["precio", "DESC"]],
  anio_desc: [["anio", "DESC"], ["marca", "ASC"]],
  anio_asc: [["anio", "ASC"], ["marca", "ASC"]],
  marca: [["marca", "ASC"], ["modelo", "ASC"]],
};

/** Normaliza un parametro de texto: ignora los espacios que sobran. */
const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");

/**
 * Prepara un termino para LIKE escapando los comodines de SQL,
 * de modo que buscar "50%" no traiga el catalogo completo.
 */
const contiene = (valor) => ({ [Op.like]: `%${valor.replace(/[\\%_]/g, (c) => `\\${c}`)}%` });

/** Convierte a numero validando; acumula el nombre del campo si viene mal. */
function numero(valor, campo, errores) {
  const limpio = texto(valor);
  if (limpio === "") return null;
  const convertido = Number(limpio);
  if (!Number.isFinite(convertido)) {
    errores.push(campo);
    return null;
  }
  return convertido;
}

/**
 * RF-012: compara las existencias disponibles de cada modelo contra su minimo configurado.
 * Devuelve solo los modelos que estan por debajo del umbral.
 */
async function calcularAlertas() {
  const minimos = await MinimoInventario.findAll();
  if (minimos.length === 0) return [];

  const existencias = await Vehiculo.findAll({
    attributes: ["marca", "modelo", [fn("COUNT", col("id")), "disponibles"]],
    where: { activo: true, estatus: "disponible" },
    group: ["marca", "modelo"],
    raw: true,
  });

  const mapa = new Map(existencias.map((e) => [`${e.marca}|${e.modelo}`, Number(e.disponibles)]));
  return minimos
    .map((m) => ({
      marca: m.marca,
      modelo: m.modelo,
      minimo: m.minimo,
      disponibles: mapa.get(`${m.marca}|${m.modelo}`) || 0,
    }))
    .filter((a) => a.disponibles < a.minimo);
}

/**
 * RF-009: catalogo con filtros por marca, modelo, precio, anio y estatus,
 * mas una busqueda libre que abarca marca, modelo, VIN y color.
 * Todos los filtros se combinan entre si (AND) y los textos ignoran
 * mayusculas, acentos y espacios sobrantes.
 */
router.get("/", requierePermiso(PERMISOS.VEHICULOS_VER), async (req, res) => {
  const errores = [];
  const busqueda = texto(req.query.busqueda);
  const marca = texto(req.query.marca);
  const modelo = texto(req.query.modelo);
  const color = texto(req.query.color);
  const estatus = texto(req.query.estatus);
  const orden = texto(req.query.orden) || "relevancia";

  const anio = numero(req.query.anio, "anio", errores);
  const precioMin = numero(req.query.precioMin, "precio minimo", errores);
  const precioMax = numero(req.query.precioMax, "precio maximo", errores);

  if (errores.length) {
    return res.status(400).json({ error: `Valor numerico invalido en: ${errores.join(", ")}` });
  }
  if (precioMin != null && precioMax != null && precioMin > precioMax) {
    return res.status(400).json({ error: "El precio minimo no puede ser mayor al precio maximo" });
  }
  if (estatus && !ESTATUS.includes(estatus)) {
    return res.status(400).json({ error: `Estatus invalido. Valores permitidos: ${ESTATUS.join(", ")}` });
  }
  if (!ORDENES[orden]) {
    return res.status(400).json({ error: `Orden invalido. Valores permitidos: ${Object.keys(ORDENES).join(", ")}` });
  }

  const where = {};
  if (req.query.incluirBajas !== "true") where.activo = true;

  // La busqueda libre es el unico filtro que combina campos con OR.
  if (busqueda) {
    where[Op.or] = [
      { marca: contiene(busqueda) },
      { modelo: contiene(busqueda) },
      { vin: contiene(busqueda) },
      { color: contiene(busqueda) },
    ];
  }

  if (marca) where.marca = contiene(marca);
  if (modelo) where.modelo = contiene(modelo);
  if (color) where.color = contiene(color);
  if (anio != null) where.anio = anio;
  if (estatus) where.estatus = estatus;
  if (precioMin != null || precioMax != null) {
    where.precio = {};
    if (precioMin != null) where.precio[Op.gte] = precioMin;
    if (precioMax != null) where.precio[Op.lte] = precioMax;
  }

  const vehiculos = await Vehiculo.findAll({ where, order: ORDENES[orden] });
  res.json(vehiculos);
});

/** Valores presentes en el catalogo, para alimentar los desplegables de la busqueda. */
router.get("/opciones", requierePermiso(PERMISOS.VEHICULOS_VER), async (_req, res) => {
  const vehiculos = await Vehiculo.findAll({
    attributes: ["marca", "modelo", "color", "anio"],
    where: { activo: true },
    raw: true,
  });

  const unicos = (campo) => [...new Set(vehiculos.map((v) => v[campo]))].sort();
  res.json({
    marcas: unicos("marca"),
    modelos: unicos("modelo"),
    colores: unicos("color"),
    anios: [...new Set(vehiculos.map((v) => v.anio))].sort((a, b) => b - a),
    // Por modelo, para que al elegir una marca el desplegable se acote.
    modelosPorMarca: vehiculos.reduce((mapa, v) => {
      mapa[v.marca] = [...new Set([...(mapa[v.marca] || []), v.modelo])].sort();
      return mapa;
    }, {}),
  });
});

/**
 * RF-011: sube una fotografia y devuelve su ruta publica.
 * La subida es independiente del alta del vehiculo, de modo que el mismo
 * endpoint sirve al registrar una unidad nueva y al editar una existente.
 */
router.post("/fotos", requierePermiso(PERMISOS.VEHICULOS_GESTIONAR), (req, res) => {
  subirFoto(req, res, async (error) => {
    if (error) {
      const mensaje =
        error.code === "LIMIT_FILE_SIZE"
          ? `La imagen supera el maximo de ${Math.round(TAMANO_MAXIMO / 1024 / 1024)} MB`
          : error.message || "No se pudo subir la imagen";
      return res.status(error.status || 400).json({ error: mensaje });
    }
    if (!req.file) return res.status(400).json({ error: "No se recibio ninguna imagen" });

    const url = rutaPublica(req.file.filename);
    await registrar(req, "ALTA_FOTO_VEHICULO", { entidad: "vehiculo", detalle: url });
    res.status(201).json({ url, nombre: req.file.originalname, tamano: req.file.size });
  });
});

/** Elimina del disco una fotografia que ya no forma parte de ninguna ficha. */
router.delete("/fotos", requierePermiso(PERMISOS.VEHICULOS_GESTIONAR), async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "Indica la imagen a eliminar" });

  // Una imagen que sigue asociada a un vehiculo no se borra.
  const enUso = await Vehiculo.findOne({ where: sequelize.literal(`JSON_CONTAINS(fotos, ${sequelize.escape(JSON.stringify(url))})`) });
  if (enUso) {
    return res.status(409).json({ error: "La imagen sigue asociada a un vehiculo del catalogo" });
  }

  const eliminada = eliminarFoto(url);
  await registrar(req, "BAJA_FOTO_VEHICULO", { entidad: "vehiculo", detalle: url });
  res.json({ eliminada });
});

/** RF-012 / HU-13: alertas de inventario bajo el minimo. */
router.get("/alertas", requierePermiso(PERMISOS.VEHICULOS_VER), async (_req, res) => {
  res.json(await calcularAlertas());
});

router.get("/minimos", requierePermiso(PERMISOS.VEHICULOS_GESTIONAR), async (_req, res) => {
  res.json(await MinimoInventario.findAll({ order: [["marca", "ASC"], ["modelo", "ASC"]] }));
});

router.put("/minimos", requierePermiso(PERMISOS.VEHICULOS_GESTIONAR), async (req, res) => {
  const { marca, modelo, minimo } = req.body || {};
  if (!marca || !modelo || minimo == null) {
    return res.status(400).json({ error: "marca, modelo y minimo son obligatorios" });
  }
  const [registro] = await MinimoInventario.findOrCreate({
    where: { marca, modelo },
    defaults: { minimo: Number(minimo) },
  });
  registro.minimo = Number(minimo);
  await registro.save();

  await registrar(req, "CONFIG_MINIMO_INVENTARIO", { entidad: "minimo_inventario", entidadId: registro.id, detalle: `${marca} ${modelo} = ${minimo}` });
  res.json(registro);
});

router.get("/:id", requierePermiso(PERMISOS.VEHICULOS_VER), async (req, res) => {
  const vehiculo = await Vehiculo.findByPk(req.params.id);
  if (!vehiculo) return res.status(404).json({ error: "Vehiculo no encontrado" });
  res.json(vehiculo);
});

/** RF-007 / RF-011: alta de vehiculo con ficha tecnica y fotografias. */
router.post("/", requierePermiso(PERMISOS.VEHICULOS_GESTIONAR), async (req, res) => {
  const { vin, marca, modelo, anio, color, precio, fichaTecnica, fotos } = req.body || {};
  if (!vin || !marca || !modelo || !anio || !color || precio == null) {
    return res.status(400).json({ error: "vin, marca, modelo, anio, color y precio son obligatorios" });
  }
  // UC-05, flujo alterno 3a: el VIN es unico en el inventario.
  if (await Vehiculo.findOne({ where: { vin } })) {
    return res.status(409).json({ error: "Ya existe un vehiculo registrado con ese VIN" });
  }

  const vehiculo = await Vehiculo.create({
    vin,
    marca,
    modelo,
    anio: Number(anio),
    color,
    precio: Number(precio),
    fichaTecnica: fichaTecnica || null,
    fotos: Array.isArray(fotos) ? fotos : [],
    estatus: "disponible",
  });

  await registrar(req, "ALTA_VEHICULO", { entidad: "vehiculo", entidadId: vehiculo.id, detalle: `VIN ${vin}` });
  res.status(201).json({ vehiculo, alertas: await calcularAlertas() });
});

router.put("/:id", requierePermiso(PERMISOS.VEHICULOS_GESTIONAR), async (req, res) => {
  const vehiculo = await Vehiculo.findByPk(req.params.id);
  if (!vehiculo) return res.status(404).json({ error: "Vehiculo no encontrado" });

  const { marca, modelo, anio, color, precio, fichaTecnica, fotos } = req.body || {};
  if (marca) vehiculo.marca = marca;
  if (modelo) vehiculo.modelo = modelo;
  if (anio) vehiculo.anio = Number(anio);
  if (color) vehiculo.color = color;
  if (precio != null) vehiculo.precio = Number(precio);
  if (fichaTecnica !== undefined) vehiculo.fichaTecnica = fichaTecnica;
  if (Array.isArray(fotos)) vehiculo.fotos = fotos;
  await vehiculo.save();

  await registrar(req, "EDICION_VEHICULO", { entidad: "vehiculo", entidadId: vehiculo.id });
  res.json(vehiculo);
});

/** RF-008: cambio manual de estatus. Los estatus derivados de apartado/venta los fija el modulo de ventas. */
router.patch("/:id/estatus", requierePermiso(PERMISOS.VEHICULOS_GESTIONAR), async (req, res) => {
  const vehiculo = await Vehiculo.findByPk(req.params.id);
  if (!vehiculo) return res.status(404).json({ error: "Vehiculo no encontrado" });

  const { estatus } = req.body || {};
  if (!ESTATUS.includes(estatus)) {
    return res.status(400).json({ error: `Estatus invalido. Valores permitidos: ${ESTATUS.join(", ")}` });
  }
  if (vehiculo.estatus === "apartado" && estatus === "disponible") {
    return res.status(409).json({ error: "El vehiculo tiene un apartado vigente; cancelalo desde el modulo de ventas" });
  }

  const anterior = vehiculo.estatus;
  vehiculo.estatus = estatus;
  await vehiculo.save();

  await registrar(req, "CAMBIO_ESTATUS_VEHICULO", { entidad: "vehiculo", entidadId: vehiculo.id, detalle: `${anterior} -> ${estatus}` });
  res.json({ vehiculo, alertas: await calcularAlertas() });
});

/** RF-010: baja logica conservando el historial. */
router.post("/:id/baja", requierePermiso(PERMISOS.VEHICULOS_GESTIONAR), async (req, res) => {
  const vehiculo = await Vehiculo.findByPk(req.params.id);
  if (!vehiculo) return res.status(404).json({ error: "Vehiculo no encontrado" });
  if (!vehiculo.activo) return res.status(409).json({ error: "El vehiculo ya esta dado de baja" });

  const { motivo } = req.body || {};
  if (!motivo) return res.status(400).json({ error: "Debes capturar el motivo de la baja" });
  if (vehiculo.estatus === "apartado") {
    return res.status(409).json({ error: "No puedes dar de baja un vehiculo con apartado vigente" });
  }

  vehiculo.activo = false;
  vehiculo.motivoBaja = motivo;
  vehiculo.fechaBaja = new Date();
  await vehiculo.save();

  await registrar(req, "BAJA_VEHICULO", { entidad: "vehiculo", entidadId: vehiculo.id, detalle: motivo });
  res.json({ vehiculo, alertas: await calcularAlertas() });
});

module.exports = { router, calcularAlertas };
