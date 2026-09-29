const { CONCEPTO_VEHICULO, TASA_IVA, metodoPagoDeVenta, formaPagoDeVenta, RFC_VALIDO, CP_VALIDO } = require("../config/sat");
const { aNumero } = require("./folio");

/** Redondeo a dos decimales sin arrastrar el error binario de coma flotante. */
const centavos = (valor) => Math.round((Number(valor) + Number.EPSILON) * 100) / 100;

/**
 * Los precios del catalogo son precios de lista al publico, con IVA incluido.
 * El CFDI exige el desglose, asi que el impuesto se separa hacia atras:
 * el total facturado coincide exactamente con el precio que paga el cliente.
 */
function desglosarIva(totalConIva) {
  const total = centavos(totalConIva);
  const subtotal = centavos(total / (1 + TASA_IVA));
  // El IVA se calcula por diferencia para que subtotal + impuesto cuadre al centavo.
  return { subtotal, iva: centavos(total - subtotal), total };
}

/** Datos fiscales que el CFDI 4.0 exige del receptor. */
function validarReceptor(cliente) {
  const faltantes = [];
  if (!cliente?.rfc) faltantes.push("RFC");
  if (!cliente?.razonSocial) faltantes.push("nombre o razon social fiscal");
  if (!cliente?.regimenFiscal) faltantes.push("regimen fiscal");
  if (!cliente?.codigoPostalFiscal) faltantes.push("codigo postal fiscal");
  if (!cliente?.usoCfdi) faltantes.push("uso del CFDI");

  if (faltantes.length) {
    return `Falta capturar los datos fiscales del cliente: ${faltantes.join(", ")}.`;
  }
  if (!RFC_VALIDO.test(cliente.rfc)) return `El RFC "${cliente.rfc}" no tiene un formato valido.`;
  if (!CP_VALIDO.test(cliente.codigoPostalFiscal)) return "El codigo postal fiscal debe tener cinco digitos.";
  return null;
}

/** Datos del emisor que deben venir del entorno. */
function validarEmisor() {
  const faltantes = ["FACTURAMA_EMISOR_CP"].filter((clave) => !process.env[clave]);
  return faltantes.length ? `Falta configurar en el servidor: ${faltantes.join(", ")}.` : null;
}

/**
 * Construye el comprobante de ingreso (tipo I) a partir de una venta.
 * La estructura corresponde a POST /3/cfdis de la API Web de Facturama.
 */
function construirComprobante(venta) {
  const { subtotal, iva, total } = desglosarIva(aNumero(venta.total));
  const vehiculo = venta.vehiculo || {};

  const descripcion = [vehiculo.marca, vehiculo.modelo, vehiculo.anio, vehiculo.color && `color ${vehiculo.color}`]
    .filter(Boolean)
    .join(" ");

  return {
    // La serie solo se envia si esta dada de alta en la sucursal del perfil
    // fiscal; si se manda una que no existe, Facturama rechaza el comprobante.
    ...(process.env.FACTURAMA_SERIE ? { Serie: process.env.FACTURAMA_SERIE } : {}),
    // El folio debe ser unico por serie: el identificador de la venta lo garantiza.
    Folio: String(venta.id),
    CfdiType: "I",
    PaymentForm: formaPagoDeVenta(venta.formaPago),
    PaymentMethod: metodoPagoDeVenta(venta.formaPago),
    ExpeditionPlace: process.env.FACTURAMA_EMISOR_CP,
    Currency: "MXN",
    Date: new Date().toISOString().slice(0, 19),
    Observations: `Venta ${venta.folio} · contrato ${venta.folioContrato}`,

    Receiver: {
      // El SAT compara el nombre contra su padron: se envia en mayusculas y sin regimen societario.
      Rfc: venta.cliente.rfc.toUpperCase().trim(),
      Name: venta.cliente.razonSocial.toUpperCase().trim(),
      CfdiUse: venta.cliente.usoCfdi,
      FiscalRegime: String(venta.cliente.regimenFiscal),
      TaxZipCode: venta.cliente.codigoPostalFiscal,
    },

    Items: [
      {
        ProductCode: CONCEPTO_VEHICULO.claveProdServ,
        IdentificationNumber: vehiculo.vin || undefined,
        Description: `Vehiculo ${descripcion}`.trim(),
        Unit: CONCEPTO_VEHICULO.unidad,
        UnitCode: CONCEPTO_VEHICULO.claveUnidad,
        UnitPrice: subtotal,
        Quantity: 1,
        Subtotal: subtotal,
        TaxObject: CONCEPTO_VEHICULO.objetoImpuesto,
        Taxes: [
          {
            Name: "IVA",
            Rate: TASA_IVA,
            Total: iva,
            Base: subtotal,
            IsRetention: false,
                  IsFederalTax: true,
          },
        ],
        Total: total,
      },
    ],
  };
}

module.exports = { construirComprobante, desglosarIva, validarReceptor, validarEmisor, centavos };
