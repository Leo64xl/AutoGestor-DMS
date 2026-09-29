const express = require("express");
const { Op, fn, col, literal } = require("sequelize");
const { Venta, Vehiculo, Cliente, Usuario } = require("../models");
const { PERMISOS, requierePermiso } = require("../middleware/auth");
const { registrar } = require("../middleware/bitacora");
const { aNumero } = require("../utils/folio");
const { enviarExcel } = require("../utils/excel");

const router = express.Router();
router.use(requierePermiso(PERMISOS.REPORTES_VER));

const ORIGENES = ["showroom", "redes_sociales", "referido", "sitio_web"];

/** Rango de fechas del periodo solicitado; por omision, el mes en curso. */
function periodo(query) {
  const hoy = new Date();
  const desde = query.desde || new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
  const hasta = query.hasta || hoy.toISOString().slice(0, 10);
  return {
    desde,
    hasta,
    where: { fechaVenta: { [Op.gte]: new Date(`${desde}T00:00:00`), [Op.lte]: new Date(`${hasta}T23:59:59`) } },
  };
}

/** RF-037 (HU-11): ventas del periodo, con corte por vendedor y por modelo. */
async function reporteVentas(query) {
  const { desde, hasta, where } = periodo(query);
  const filtro = { ...where, estatus: { [Op.ne]: "cancelada" } };
  if (query.usuarioId) filtro.usuarioId = Number(query.usuarioId);

  const ventas = await Venta.findAll({
    where: filtro,
    include: [
      { model: Usuario, attributes: ["id", "nombre", "username"] },
      { model: Vehiculo, attributes: ["id", "vin", "marca", "modelo", "anio"] },
      { model: Cliente, attributes: ["id", "nombre", "apellidos"] },
    ],
    order: [["fechaVenta", "ASC"]],
  });

  const agrupar = (clave) => {
    const mapa = new Map();
    ventas.forEach((v) => {
      const llave = clave(v);
      const actual = mapa.get(llave) || { concepto: llave, unidades: 0, importe: 0 };
      actual.unidades += 1;
      actual.importe += aNumero(v.total);
      mapa.set(llave, actual);
    });
    return [...mapa.values()].sort((a, b) => b.importe - a.importe);
  };

  const detalle = ventas.map((v) => ({
    folio: v.folio,
    fecha: v.fechaVenta,
    cliente: `${v.cliente?.nombre} ${v.cliente?.apellidos}`,
    vendedor: v.usuario?.nombre,
    marca: v.vehiculo?.marca,
    modelo: v.vehiculo?.modelo,
    anio: v.vehiculo?.anio,
    vin: v.vehiculo?.vin,
    formaPago: v.formaPago,
    total: aNumero(v.total),
  }));

  return {
    desde,
    hasta,
    totales: {
      unidades: ventas.length,
      importe: ventas.reduce((suma, v) => suma + aNumero(v.total), 0),
      ticketPromedio: ventas.length ? ventas.reduce((suma, v) => suma + aNumero(v.total), 0) / ventas.length : 0,
    },
    porVendedor: agrupar((v) => v.usuario?.nombre || "Sin asignar"),
    porModelo: agrupar((v) => `${v.vehiculo?.marca} ${v.vehiculo?.modelo}`),
    detalle,
  };
}

/** RF-038 (HU-24): inventario disponible, con los mismos filtros del catalogo. */
async function reporteInventario(query) {
  const where = { activo: true };
  if (query.marca) where.marca = { [Op.like]: `%${query.marca}%` };
  if (query.modelo) where.modelo = { [Op.like]: `%${query.modelo}%` };
  if (query.anio) where.anio = Number(query.anio);
  where.estatus = query.estatus || "disponible";

  const vehiculos = await Vehiculo.findAll({ where, order: [["marca", "ASC"], ["modelo", "ASC"], ["anio", "DESC"]] });

  const resumen = await Vehiculo.findAll({
    attributes: ["marca", "modelo", [fn("COUNT", col("id")), "unidades"], [fn("SUM", col("precio")), "valor"]],
    where,
    group: ["marca", "modelo"],
    order: [[literal("unidades"), "DESC"]],
    raw: true,
  });

  return {
    filtros: { ...query },
    totales: {
      unidades: vehiculos.length,
      valorInventario: vehiculos.reduce((suma, v) => suma + aNumero(v.precio), 0),
    },
    resumen: resumen.map((r) => ({ ...r, unidades: Number(r.unidades), valor: aNumero(r.valor) })),
    detalle: vehiculos.map((v) => ({
      vin: v.vin,
      marca: v.marca,
      modelo: v.modelo,
      anio: v.anio,
      color: v.color,
      estatus: v.estatus,
      precio: aNumero(v.precio),
    })),
  };
}

/** RF-039 (HU-11): efectividad de prospectos, con la tasa de conversion a venta por origen. */
async function reporteProspectos(query) {
  const { desde, hasta } = periodo(query);

  const clientes = await Cliente.findAll({
    where: { createdAt: { [Op.gte]: new Date(`${desde}T00:00:00`), [Op.lte]: new Date(`${hasta}T23:59:59`) } },
  });

  const ventas = await Venta.findAll({
    where: { estatus: { [Op.ne]: "cancelada" } },
    attributes: ["clienteId"],
    raw: true,
  });
  const compradores = new Set(ventas.map((v) => v.clienteId));

  const porOrigen = ORIGENES.map((origen) => {
    const delOrigen = clientes.filter((c) => c.origen === origen);
    const convertidos = delOrigen.filter((c) => compradores.has(c.id)).length;
    return {
      origen,
      prospectos: delOrigen.length,
      convertidos,
      tasaConversion: delOrigen.length ? (convertidos / delOrigen.length) * 100 : 0,
    };
  });

  const convertidosTotal = clientes.filter((c) => compradores.has(c.id)).length;

  return {
    desde,
    hasta,
    totales: {
      prospectos: clientes.length,
      convertidos: convertidosTotal,
      tasaConversion: clientes.length ? (convertidosTotal / clientes.length) * 100 : 0,
      perdidos: clientes.filter((c) => c.estatus === "perdido").length,
    },
    porOrigen,
    porEstatus: ["nuevo", "en_seguimiento", "cotizando", "cerrado", "perdido", "comprador"].map((estatus) => ({
      estatus,
      cantidad: clientes.filter((c) => c.estatus === estatus).length,
    })),
  };
}

/* -------------------------------- Consulta -------------------------------- */

router.get("/ventas", async (req, res) => res.json(await reporteVentas(req.query)));
router.get("/inventario", async (req, res) => res.json(await reporteInventario(req.query)));
router.get("/prospectos", async (req, res) => res.json(await reporteProspectos(req.query)));

/* -------------------------------- Exportacion ------------------------------ */

const COLUMNAS = {
  ventas: [
    { clave: "folio", titulo: "Folio" },
    { clave: "fecha", titulo: "Fecha" },
    { clave: "cliente", titulo: "Cliente" },
    { clave: "vendedor", titulo: "Vendedor" },
    { clave: "marca", titulo: "Marca" },
    { clave: "modelo", titulo: "Modelo" },
    { clave: "anio", titulo: "Anio" },
    { clave: "vin", titulo: "VIN" },
    { clave: "formaPago", titulo: "Forma de pago" },
    { clave: "total", titulo: "Total", formato: "moneda" },
  ],
  inventario: [
    { clave: "vin", titulo: "VIN" },
    { clave: "marca", titulo: "Marca" },
    { clave: "modelo", titulo: "Modelo" },
    { clave: "anio", titulo: "Anio" },
    { clave: "color", titulo: "Color" },
    { clave: "estatus", titulo: "Estatus" },
    { clave: "precio", titulo: "Precio", formato: "moneda" },
  ],
  prospectos: [
    { clave: "origen", titulo: "Origen" },
    { clave: "prospectos", titulo: "Prospectos" },
    { clave: "convertidos", titulo: "Convertidos" },
    { clave: "tasaConversion", titulo: "Tasa de conversion (%)" },
  ],
};

/** RF-041: exportacion a Excel de los reportes, respetando los filtros aplicados. */
router.get("/:tipo/excel", async (req, res) => {
  const { tipo } = req.params;
  if (!COLUMNAS[tipo]) return res.status(404).json({ error: "Reporte no disponible" });

  const datos =
    tipo === "ventas"
      ? await reporteVentas(req.query)
      : tipo === "inventario"
        ? await reporteInventario(req.query)
        : await reporteProspectos(req.query);

  const filas =
    tipo === "prospectos"
      ? datos.porOrigen.map((f) => ({ ...f, tasaConversion: Number(f.tasaConversion.toFixed(2)) }))
      : datos.detalle;

  await registrar(req, "EXPORTACION_EXCEL", { entidad: "reporte", entidadId: tipo, detalle: `${filas.length} renglones` });
  await enviarExcel(res, {
    nombreArchivo: `reporte-${tipo}`,
    titulo: `Reporte de ${tipo}`,
    columnas: COLUMNAS[tipo],
    filas,
  });
});

/**
 * RF-041: exportacion generica de cualquier listado del sistema.
 * El cliente envia las columnas visibles y las filas ya filtradas que se ven en pantalla.
 */
router.post("/exportar", async (req, res) => {
  const { titulo, nombreArchivo, columnas, filas } = req.body || {};
  if (!Array.isArray(columnas) || columnas.length === 0 || !Array.isArray(filas)) {
    return res.status(400).json({ error: "Se requieren las columnas visibles y las filas a exportar" });
  }
  if (filas.length > 10000) {
    return res.status(413).json({ error: "El listado excede el maximo de 10,000 renglones por exportacion" });
  }

  await registrar(req, "EXPORTACION_EXCEL", { entidad: "listado", entidadId: nombreArchivo || titulo, detalle: `${filas.length} renglones` });
  await enviarExcel(res, { nombreArchivo: nombreArchivo || "listado", titulo: titulo || "Listado", columnas, filas });
});

module.exports = router;
