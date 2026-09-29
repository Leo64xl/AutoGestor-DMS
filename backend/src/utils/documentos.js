/**
 * Documentos imprimibles de la venta (RF-027 y RF-028).
 * Conforme a la limitacion declarada en la Etapa 1, la factura es un comprobante
 * interno del proceso de venta: no se timbra ante el SAT.
 */

const EMPRESA = {
  nombre: "Concesionaria Automotriz del Valle, S.A. de C.V.",
  domicilio: "Av. Principal 100, Tlahuelilpan, Hidalgo",
  rfc: "CAV010101XX0",
};

const moneda = (valor) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(valor) || 0);

const fecha = (valor) =>
  new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(valor ? new Date(valor) : new Date());

/** Evita que un dato capturado por el usuario rompa o inyecte marcado en el documento. */
function escapar(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plantilla(titulo, cuerpo) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(titulo)}</title>
<style>
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #1c2434; max-width: 780px; margin: 0 auto; padding: 32px 24px; line-height: 1.55; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .6px; color: #5b6679; margin: 24px 0 8px; }
  .encabezado { border-bottom: 2px solid #1f4b99; padding-bottom: 12px; margin-bottom: 20px; }
  .empresa { color: #5b6679; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #dfe4ed; vertical-align: top; }
  th { color: #5b6679; font-weight: 600; width: 34%; }
  .total { display: flex; justify-content: space-between; padding: 12px 8px; background: #e8eefa; color: #1f4b99; font-weight: 700; border-radius: 8px; margin-top: 12px; }
  .firmas { display: flex; gap: 40px; margin-top: 56px; }
  .firma { flex: 1; border-top: 1px solid #1c2434; padding-top: 6px; font-size: 12px; text-align: center; }
  .nota { font-size: 11px; color: #5b6679; margin-top: 28px; }
  .clausula { font-size: 12px; }
  @media print { body { padding: 0; } .no-imprimir { display: none; } }
</style>
</head>
<body>
${cuerpo}
<p class="nota">Documento generado por AutoGestor DMS el ${fecha()}.</p>
<button class="no-imprimir" onclick="window.print()">Imprimir</button>
</body>
</html>`;
}

function encabezado(titulo, folio) {
  return `<div class="encabezado">
  <h1>${escapar(titulo)}</h1>
  <div class="empresa">${escapar(EMPRESA.nombre)} · RFC ${escapar(EMPRESA.rfc)}<br>${escapar(EMPRESA.domicilio)}</div>
  <div class="empresa">Folio: <strong>${escapar(folio)}</strong> · Fecha: ${fecha()}</div>
</div>`;
}

function bloqueVehiculo(vehiculo) {
  return `<h2>Del vehiculo</h2>
<table>
  <tr><th>Marca y modelo</th><td>${escapar(vehiculo?.marca)} ${escapar(vehiculo?.modelo)}</td></tr>
  <tr><th>Anio</th><td>${escapar(vehiculo?.anio)}</td></tr>
  <tr><th>Color</th><td>${escapar(vehiculo?.color)}</td></tr>
  <tr><th>Numero de serie (VIN)</th><td>${escapar(vehiculo?.vin)}</td></tr>
</table>`;
}

function bloqueCliente(cliente, titulo) {
  return `<h2>${escapar(titulo)}</h2>
<table>
  <tr><th>Nombre</th><td>${escapar(cliente?.nombre)} ${escapar(cliente?.apellidos)}</td></tr>
  <tr><th>Correo electronico</th><td>${escapar(cliente?.email || "—")}</td></tr>
  <tr><th>Telefono</th><td>${escapar(cliente?.telefono || "—")}</td></tr>
</table>`;
}

/** RF-027: contrato de compraventa. */
function contratoHtml(venta) {
  const documentos = (venta.documentos || [])
    .map((d) => `<tr><th>${escapar(d.tipo.replace(/_/g, " "))}</th><td>${escapar(d.referencia)}</td></tr>`)
    .join("");

  return plantilla(
    `Contrato ${venta.folioContrato}`,
    `${encabezado("Contrato de compraventa de vehiculo", venta.folioContrato)}
<p class="clausula">
  Contrato de compraventa que celebran, por una parte, ${escapar(EMPRESA.nombre)}, en su caracter de <strong>LA VENDEDORA</strong>,
  y por la otra ${escapar(venta.cliente?.nombre)} ${escapar(venta.cliente?.apellidos)}, en su caracter de <strong>EL COMPRADOR</strong>,
  al tenor de las declaraciones y clausulas siguientes.
</p>
${bloqueCliente(venta.cliente, "Del comprador")}
${bloqueVehiculo(venta.vehiculo)}
<h2>De la operacion</h2>
<table>
  <tr><th>Venta</th><td>${escapar(venta.folio)}</td></tr>
  <tr><th>Forma de pago</th><td>${venta.formaPago === "contado" ? "Pago de contado" : "Credito / financiamiento"}</td></tr>
  <tr><th>Vendedor responsable</th><td>${escapar(venta.usuario?.nombre)}</td></tr>
</table>
${documentos ? `<h2>Documentacion recibida</h2><table>${documentos}</table>` : ""}
<div class="total"><span>Precio total de la operacion</span><span>${moneda(venta.total)}</span></div>
<p class="clausula" style="margin-top:20px">
  <strong>PRIMERA.</strong> LA VENDEDORA transmite a EL COMPRADOR la propiedad del vehiculo descrito, libre de todo gravamen.
  <strong>SEGUNDA.</strong> EL COMPRADOR se obliga a cubrir el precio pactado en la forma de pago señalada.
  <strong>TERCERA.</strong> La entrega fisica de la unidad se documenta en el acta de entrega correspondiente.
</p>
<div class="firmas">
  <div class="firma">LA VENDEDORA</div>
  <div class="firma">EL COMPRADOR</div>
</div>`
  );
}

/** RF-028: factura o comprobante de la venta. */
function facturaHtml(venta) {
  const pagos = (venta.pagos || [])
    .map(
      (p) =>
        `<tr><td>${escapar(p.folio)}</td><td>${escapar(p.tipo)}</td><td>${escapar(p.metodo)}</td><td>${fecha(p.fecha)}</td><td>${moneda(p.monto)}</td></tr>`
    )
    .join("");

  return plantilla(
    `Factura ${venta.folioFactura}`,
    `${encabezado("Comprobante de venta", venta.folioFactura)}
${bloqueCliente(venta.cliente, "Datos del cliente")}
<h2>Concepto</h2>
<table>
  <tr><th>Descripcion</th><td>Venta de vehiculo ${escapar(venta.vehiculo?.marca)} ${escapar(venta.vehiculo?.modelo)} ${escapar(venta.vehiculo?.anio)}</td></tr>
  <tr><th>Numero de serie (VIN)</th><td>${escapar(venta.vehiculo?.vin)}</td></tr>
  <tr><th>Venta</th><td>${escapar(venta.folio)}</td></tr>
  <tr><th>Contrato</th><td>${escapar(venta.folioContrato)}</td></tr>
</table>
<div class="total"><span>Importe total</span><span>${moneda(venta.total)}</span></div>
${
  pagos
    ? `<h2>Pagos registrados</h2>
<table>
  <thead><tr><th>Folio</th><th>Tipo</th><th>Metodo</th><th>Fecha</th><th>Monto</th></tr></thead>
  <tbody>${pagos}</tbody>
</table>
<div class="total"><span>Saldo pendiente</span><span>${moneda(venta.pendiente ?? 0)}</span></div>`
    : ""
}
<p class="nota">
  Comprobante interno del proceso de venta. Conforme al alcance del proyecto, no constituye un
  Comprobante Fiscal Digital por Internet timbrado ante el SAT.
</p>`
  );
}

module.exports = { contratoHtml, facturaHtml };
