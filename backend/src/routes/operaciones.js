const express = require("express");
const {
  sequelize,
  Venta,
  DocumentoVenta,
  Cotizacion,
  Apartado,
  Vehiculo,
  Cliente,
  Usuario,
  Pago,
  SolicitudFinanciamiento,
} = require("../models");
const { PERMISOS, requierePermiso } = require("../middleware/auth");
const { registrar } = require("../middleware/bitacora");
const { folio, aNumero } = require("../utils/folio");
const { contratoHtml, facturaHtml } = require("../utils/documentos");
const facturama = require("../config/facturama");
const { construirComprobante, validarReceptor, validarEmisor, desglosarIva } = require("../utils/cfdi");

const router = express.Router();

/** UC-03, paso 3: sin estos documentos el sistema no permite cerrar la venta. */
const DOCUMENTOS_OBLIGATORIOS = ["identificacion", "comprobante_domicilio"];

const INCLUDE = [
  {
    model: Cliente,
    // Los datos fiscales viajan con la venta porque el CFDI se arma desde aqui (RF-028).
    attributes: [
      "id",
      "nombre",
      "apellidos",
      "email",
      "telefono",
      "estatus",
      "rfc",
      "razonSocial",
      "regimenFiscal",
      "codigoPostalFiscal",
      "usoCfdi",
    ],
  },
  { model: Vehiculo, attributes: ["id", "vin", "marca", "modelo", "anio", "color", "precio"] },
  { model: Usuario, attributes: ["id", "nombre", "username"] },
  { model: DocumentoVenta, as: "documentos" },
  { model: Pago, as: "pagos" },
  { model: SolicitudFinanciamiento, as: "financiamiento" },
  { model: Cotizacion, attributes: ["id", "folio", "total"] },
  { model: Apartado, attributes: ["id", "folio", "anticipo"] },
];

/** Suma de los pagos registrados contra el total de la venta (RF-034). */
function saldo(venta) {
  const pagado = (venta.pagos || []).reduce((suma, p) => suma + aNumero(p.monto), 0);
  return { pagado, pendiente: aNumero(venta.total) - pagado };
}

function conSaldo(venta) {
  const plano = venta.toJSON();
  return { ...plano, ...saldo(plano) };
}

router.get("/", requierePermiso(PERMISOS.VENTAS_VER), async (req, res) => {
  const where = {};
  if (req.query.clienteId) where.clienteId = Number(req.query.clienteId);
  if (req.query.estatus) where.estatus = req.query.estatus;

  const ventas = await Venta.findAll({ where, include: INCLUDE, order: [["id", "DESC"]] });
  res.json(ventas.map(conSaldo));
});

router.get("/:id", requierePermiso(PERMISOS.VENTAS_VER), async (req, res) => {
  const venta = await Venta.findByPk(req.params.id, { include: INCLUDE });
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });
  res.json(conSaldo(venta));
});

/**
 * RF-026 a RF-029 (UC-03): registra la venta a partir de una cotizacion o de un apartado vigente.
 * En una sola transaccion genera contrato y factura, asocia la documentacion del cliente,
 * marca el vehiculo como vendido y actualiza el estatus del cliente a "comprador".
 */
router.post("/", requierePermiso(PERMISOS.VENTAS_GESTIONAR), async (req, res) => {
  const { cotizacionId, apartadoId, formaPago, documentos = [] } = req.body || {};
  if (!cotizacionId && !apartadoId) {
    return res.status(400).json({ error: "Indica la cotizacion o el apartado que se va a formalizar" });
  }
  if (!["contado", "financiamiento"].includes(formaPago)) {
    return res.status(400).json({ error: "Forma de pago invalida" });
  }

  // UC-03 flujo alterno 3a: la documentacion incompleta detiene la operacion.
  const tipos = documentos.map((d) => d.tipo);
  const faltantes = DOCUMENTOS_OBLIGATORIOS.filter((t) => !tipos.includes(t));
  if (faltantes.length) {
    return res.status(400).json({ error: `Falta documentacion del cliente: ${faltantes.join(", ")}` });
  }
  if (documentos.some((d) => !d.referencia)) {
    return res.status(400).json({ error: "Cada documento requiere una referencia (numero o folio)" });
  }

  let apartado = null;
  let cotizacion = null;

  if (apartadoId) {
    apartado = await Apartado.findByPk(apartadoId);
    if (!apartado) return res.status(404).json({ error: "Apartado no encontrado" });
    if (apartado.estatus !== "vigente") {
      return res.status(409).json({ error: `El apartado no esta vigente (estatus actual: ${apartado.estatus})` });
    }
    if (apartado.cotizacionId) cotizacion = await Cotizacion.findByPk(apartado.cotizacionId);
  } else {
    cotizacion = await Cotizacion.findByPk(cotizacionId);
    if (!cotizacion) return res.status(404).json({ error: "Cotizacion no encontrada" });
    if (cotizacion.estatus !== "vigente") {
      return res.status(409).json({ error: `La cotizacion no esta vigente (estatus actual: ${cotizacion.estatus})` });
    }
  }

  const vehiculoId = apartado ? apartado.vehiculoId : cotizacion.vehiculoId;
  const clienteId = apartado ? apartado.clienteId : cotizacion.clienteId;

  try {
    const venta = await sequelize.transaction(async (t) => {
      const vehiculo = await Vehiculo.findByPk(vehiculoId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!vehiculo) throw Object.assign(new Error("Vehiculo no encontrado"), { status: 404 });
      if (vehiculo.estatus === "vendido") {
        throw Object.assign(new Error("El vehiculo ya fue vendido"), { status: 409 });
      }
      // Solo se acepta la unidad libre o reservada para este mismo cliente.
      if (vehiculo.estatus === "apartado" && !apartado) {
        throw Object.assign(new Error("El vehiculo esta apartado por otra operacion"), { status: 409 });
      }

      const total = cotizacion ? aNumero(cotizacion.total) : aNumero(vehiculo.precio);

      const creada = await Venta.create(
        {
          folio: "PENDIENTE",
          folioContrato: "PENDIENTE",
          folioFactura: "PENDIENTE",
          cotizacionId: cotizacion ? cotizacion.id : null,
          apartadoId: apartado ? apartado.id : null,
          vehiculoId: vehiculo.id,
          clienteId,
          usuarioId: req.usuario.id,
          formaPago,
          total,
        },
        { transaction: t }
      );

      // RF-027 / RF-028: el contrato y la factura se generan al confirmar la venta.
      creada.folio = folio("VTA", creada.id);
      creada.folioContrato = folio("CTR", creada.id);
      creada.folioFactura = folio("FAC", creada.id);
      await creada.save({ transaction: t });

      // RF-029
      await DocumentoVenta.bulkCreate(
        documentos.map((d) => ({
          ventaId: creada.id,
          tipo: d.tipo,
          referencia: d.referencia,
          archivoUrl: d.archivoUrl || null,
        })),
        { transaction: t }
      );

      vehiculo.estatus = "vendido";
      await vehiculo.save({ transaction: t });

      await Cliente.update({ estatus: "comprador" }, { where: { id: clienteId }, transaction: t });

      if (cotizacion) {
        cotizacion.estatus = "vendida";
        await cotizacion.save({ transaction: t });
      }
      if (apartado) {
        apartado.estatus = "vendido";
        await apartado.save({ transaction: t });
      }

      // El anticipo del apartado se reconoce como primer pago de la venta (RF-034).
      if (apartado && aNumero(apartado.anticipo) > 0) {
        const pago = await Pago.create(
          {
            folio: "PENDIENTE",
            ventaId: creada.id,
            usuarioId: req.usuario.id,
            tipo: formaPago === "financiamiento" ? "enganche" : "contado",
            metodo: "efectivo",
            monto: aNumero(apartado.anticipo),
            referencia: `Anticipo del apartado ${apartado.folio}`,
          },
          { transaction: t }
        );
        pago.folio = folio("PAG", pago.id);
        await pago.save({ transaction: t });
      }

      return creada;
    });

    await registrar(req, "REGISTRO_VENTA", {
      entidad: "venta",
      entidadId: venta.id,
      detalle: `folio=${venta.folio}, contrato=${venta.folioContrato}, factura=${venta.folioFactura}, total=${venta.total}`,
    });
    res.status(201).json(conSaldo(await Venta.findByPk(venta.id, { include: INCLUDE })));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

/** RF-029: documentacion adicional cargada despues de registrar la venta. */
router.post("/:id/documentos", requierePermiso(PERMISOS.VENTAS_GESTIONAR), async (req, res) => {
  const venta = await Venta.findByPk(req.params.id);
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });

  const { tipo, referencia, archivoUrl } = req.body || {};
  if (!["identificacion", "comprobante_domicilio", "comprobante_ingresos", "otro"].includes(tipo)) {
    return res.status(400).json({ error: "Tipo de documento invalido" });
  }
  if (!referencia) return res.status(400).json({ error: "La referencia del documento es obligatoria" });

  const documento = await DocumentoVenta.create({ ventaId: venta.id, tipo, referencia, archivoUrl: archivoUrl || null });

  await registrar(req, "ALTA_DOCUMENTO_VENTA", { entidad: "venta", entidadId: venta.id, detalle: `tipo=${tipo}` });
  res.status(201).json(documento);
});

/**
 * RF-030: registra el traspaso y la entrega del vehiculo.
 * La entrega exige que la operacion este liquidada: de contado, con los pagos que cubren el total;
 * a credito, con la solicitud de financiamiento aprobada (UC-03 flujo alterno 2a).
 */
router.patch("/:id/entrega", requierePermiso(PERMISOS.VENTAS_GESTIONAR), async (req, res) => {
  const venta = await Venta.findByPk(req.params.id, { include: INCLUDE });
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });
  if (venta.estatus !== "registrada") {
    return res.status(409).json({ error: `La venta ya esta ${venta.estatus}` });
  }

  const { pendiente } = saldo(venta.toJSON());
  if (venta.formaPago === "contado" && pendiente > 0.009) {
    return res.status(409).json({ error: `No puedes entregar la unidad con un saldo pendiente de ${pendiente.toFixed(2)}` });
  }
  if (venta.formaPago === "financiamiento" && venta.financiamiento?.estatus !== "aprobada") {
    return res.status(409).json({ error: "La solicitud de financiamiento debe estar aprobada antes de entregar la unidad" });
  }

  venta.entregaCompletada = true;
  venta.fechaEntrega = new Date();
  venta.observacionesEntrega = req.body?.observaciones || null;
  venta.estatus = "entregada";
  await venta.save();

  await registrar(req, "ENTREGA_VEHICULO", { entidad: "venta", entidadId: venta.id, detalle: `folio=${venta.folio}` });
  res.json(conSaldo(await Venta.findByPk(venta.id, { include: INCLUDE })));
});

/* ----------------------- RF-028: CFDI 4.0 (Facturama) ---------------------- */

/** Configuracion vigente del timbrado, para que la interfaz sepa que ofrecer. */
router.get("/cfdi/estado", requierePermiso(PERMISOS.VENTAS_VER), (_req, res) => {
  res.json(facturama.estado());
});

/**
 * RF-028: timbra la factura de la venta ante el SAT.
 * El comprobante interno sigue existiendo como respaldo; el CFDI es el
 * documento con validez fiscal cuando el cliente entrega sus datos.
 */
router.post("/:id/timbrar", requierePermiso(PERMISOS.VENTAS_GESTIONAR), async (req, res) => {
  const venta = await Venta.findByPk(req.params.id, { include: INCLUDE });
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });
  if (venta.cfdiEstatus === "timbrada") {
    return res.status(409).json({ error: `La venta ya tiene el CFDI ${venta.cfdiUuid}` });
  }
  if (venta.estatus === "cancelada") {
    return res.status(409).json({ error: "La venta esta cancelada" });
  }

  const faltaEmisor = validarEmisor();
  if (faltaEmisor) return res.status(503).json({ error: faltaEmisor });

  const faltaReceptor = validarReceptor(venta.cliente);
  if (faltaReceptor) return res.status(400).json({ error: faltaReceptor });

  const comprobante = construirComprobante(venta.toJSON());

  try {
    const timbrado = await facturama.timbrar(comprobante);

    venta.cfdiEstatus = "timbrada";
    venta.cfdiUuid = timbrado.Uuid;
    venta.cfdiId = timbrado.Id;
    venta.cfdiFecha = new Date();
    venta.cfdiSimulado = Boolean(timbrado.simulado);
    venta.cfdiError = null;
    await venta.save();

    await registrar(req, "TIMBRADO_CFDI", {
      entidad: "venta",
      entidadId: venta.id,
      detalle: `uuid=${timbrado.Uuid}${timbrado.simulado ? " (simulado)" : ""}`,
    });
    res.status(201).json(conSaldo(await Venta.findByPk(venta.id, { include: INCLUDE })));
  } catch (err) {
    // El motivo del rechazo se conserva en la venta: es lo que el vendedor debe corregir.
    venta.cfdiEstatus = "error";
    venta.cfdiError = err.message;
    await venta.save();

    await registrar(req, "TIMBRADO_CFDI_FALLIDO", { entidad: "venta", entidadId: venta.id, detalle: err.message });
    res.status(err.status || 502).json({ error: err.message });
  }
});

/** Descarga el CFDI timbrado en PDF o XML tal como lo devuelve el SAT. */
router.get("/:id/cfdi/:formato", requierePermiso(PERMISOS.VENTAS_VER), async (req, res) => {
  const venta = await Venta.findByPk(req.params.id);
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });
  if (venta.cfdiEstatus !== "timbrada" || !venta.cfdiId) {
    return res.status(409).json({ error: "La venta no tiene un CFDI timbrado" });
  }

  const { formato } = req.params;
  try {
    const archivo = await facturama.descargar(formato, venta.cfdiId);
    const tipos = { pdf: "application/pdf", xml: "application/xml", html: "text/html" };

    await registrar(req, "DESCARGA_CFDI", { entidad: "venta", entidadId: venta.id, detalle: formato });
    res.setHeader("Content-Type", tipos[formato]);
    res.setHeader("Content-Disposition", `attachment; filename="${venta.folioFactura}.${formato}"`);
    res.send(archivo);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

/** Cancelacion del comprobante ante el SAT. */
router.patch("/:id/cfdi/cancelar", requierePermiso(PERMISOS.VENTAS_GESTIONAR), async (req, res) => {
  const venta = await Venta.findByPk(req.params.id);
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });
  if (venta.cfdiEstatus !== "timbrada") {
    return res.status(409).json({ error: "Solo se puede cancelar un CFDI timbrado" });
  }

  // c_MotivoCancelacion; 02 = comprobante emitido con errores sin relacion.
  const motivo = req.body?.motivo || "02";
  if (!["01", "02", "03", "04"].includes(motivo)) {
    return res.status(400).json({ error: "Motivo de cancelacion invalido" });
  }

  try {
    await facturama.cancelar(venta.cfdiId, motivo, req.body?.folioSustitucion);
    venta.cfdiEstatus = "cancelada";
    await venta.save();

    await registrar(req, "CANCELACION_CFDI", { entidad: "venta", entidadId: venta.id, detalle: `motivo=${motivo}` });
    res.json(conSaldo(await Venta.findByPk(venta.id, { include: INCLUDE })));
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

/** RF-027: contrato de compraventa en formato imprimible. */
router.get("/:id/contrato", requierePermiso(PERMISOS.VENTAS_VER), async (req, res) => {
  const venta = await Venta.findByPk(req.params.id, { include: INCLUDE });
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });

  await registrar(req, "CONSULTA_CONTRATO", { entidad: "venta", entidadId: venta.id });
  res.type("html").send(contratoHtml(venta.toJSON()));
});

/** RF-028: factura o comprobante de la venta (documento interno, sin timbrado SAT). */
router.get("/:id/factura", requierePermiso(PERMISOS.VENTAS_VER), async (req, res) => {
  const venta = await Venta.findByPk(req.params.id, { include: INCLUDE });
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });

  await registrar(req, "CONSULTA_FACTURA", { entidad: "venta", entidadId: venta.id });
  res.type("html").send(facturaHtml({ ...venta.toJSON(), ...saldo(venta.toJSON()) }));
});

module.exports = router;
