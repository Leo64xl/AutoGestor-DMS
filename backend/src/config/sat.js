/**
 * Catalogos del SAT necesarios para el CFDI 4.0.
 * Se incluye el subconjunto que usa una concesionaria; el catalogo completo
 * vive en el portal del SAT y Facturama lo valida al timbrar.
 */

/** c_RegimenFiscal: regimenes aplicables a personas fisicas y morales. */
const REGIMENES_FISCALES = {
  601: "General de Ley Personas Morales",
  603: "Personas Morales con Fines no Lucrativos",
  605: "Sueldos y Salarios e Ingresos Asimilados a Salarios",
  606: "Arrendamiento",
  607: "Regimen de Enajenacion o Adquisicion de Bienes",
  608: "Demas ingresos",
  610: "Residentes en el Extranjero sin Establecimiento Permanente en Mexico",
  611: "Ingresos por Dividendos (socios y accionistas)",
  612: "Personas Fisicas con Actividades Empresariales y Profesionales",
  614: "Ingresos por intereses",
  615: "Regimen de los ingresos por obtencion de premios",
  616: "Sin obligaciones fiscales",
  620: "Sociedades Cooperativas de Produccion que optan por Diferir sus Ingresos",
  621: "Incorporacion Fiscal",
  622: "Actividades Agricolas, Ganaderas, Silvicolas y Pesqueras",
  623: "Opcional para Grupos de Sociedades",
  624: "Coordinados",
  625: "Regimen de las Actividades Empresariales con ingresos a traves de Plataformas Tecnologicas",
  626: "Regimen Simplificado de Confianza",
};

/** c_UsoCFDI: para la venta de un vehiculo lo habitual es G01, I04 o D10. */
const USOS_CFDI = {
  G01: "Adquisicion de mercancias",
  G02: "Devoluciones, descuentos o bonificaciones",
  G03: "Gastos en general",
  I01: "Construcciones",
  I02: "Mobiliario y equipo de oficina por inversiones",
  I03: "Equipo de transporte",
  I04: "Equipo de computo y accesorios",
  I08: "Otra maquinaria y equipo",
  D01: "Honorarios medicos, dentales y gastos hospitalarios",
  D10: "Pagos por servicios educativos (colegiaturas)",
  S01: "Sin efectos fiscales",
  CP01: "Pagos",
};

/** c_FormaPago */
const FORMAS_PAGO = {
  "01": "Efectivo",
  "02": "Cheque nominativo",
  "03": "Transferencia electronica de fondos",
  "04": "Tarjeta de credito",
  28: "Tarjeta de debito",
  99: "Por definir",
};

/** c_MetodoPago: una sola exhibicion o en parcialidades. */
const METODOS_PAGO = {
  PUE: "Pago en una sola exhibicion",
  PPD: "Pago en parcialidades o diferido",
};

/**
 * Valores por omision del concepto cuando se factura un vehiculo:
 * 25101500 corresponde a "Vehiculos de pasajeros" en c_ClaveProdServ y
 * H87 a "Pieza" en c_ClaveUnidad.
 */
const CONCEPTO_VEHICULO = {
  claveProdServ: "25101500",
  claveUnidad: "H87",
  unidad: "Pieza",
  // 02 = Si objeto de impuesto.
  objetoImpuesto: "02",
};

/** Tasa de IVA general vigente. */
const TASA_IVA = 0.16;

/** Metodo de pago que corresponde a la forma de pago de la venta. */
function metodoPagoDeVenta(formaPago) {
  // Una venta de contado se liquida en una exhibicion; a credito queda diferida.
  return formaPago === "contado" ? "PUE" : "PPD";
}

/** Forma de pago por omision segun como se liquida la venta. */
function formaPagoDeVenta(formaPago) {
  // En PPD el SAT exige "99 Por definir": el cobro se reporta despues con un REP.
  return formaPago === "contado" ? "03" : "99";
}

/** El RFC puede ser de persona moral (12) o fisica (13). */
const RFC_VALIDO = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i;

/** Los codigos postales del SAT son de cinco digitos. */
const CP_VALIDO = /^\d{5}$/;

module.exports = {
  REGIMENES_FISCALES,
  USOS_CFDI,
  FORMAS_PAGO,
  METODOS_PAGO,
  CONCEPTO_VEHICULO,
  TASA_IVA,
  metodoPagoDeVenta,
  formaPagoDeVenta,
  RFC_VALIDO,
  CP_VALIDO,
};
