const ExcelJS = require("exceljs");

/**
 * RF-041 / RNF-010: genera un archivo .xlsx compatible con Excel 2016 en adelante.
 * Recibe las columnas y filas tal como se muestran en pantalla, de modo que el
 * archivo respeta los filtros y las columnas visibles del listado exportado.
 */
async function enviarExcel(res, { nombreArchivo, titulo, columnas, filas }) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "AutoGestor DMS";
  libro.created = new Date();

  // Excel limita el nombre de la hoja a 31 caracteres y prohibe : \ / ? * [ ]
  const nombreHoja = String(titulo || "Reporte")
    .replace(/[:\\/?*[\]]/g, " ")
    .slice(0, 31);
  const hoja = libro.addWorksheet(nombreHoja);

  hoja.columns = columnas.map((c) => ({
    header: c.titulo,
    key: c.clave,
    width: Math.max(12, Math.min(40, String(c.titulo).length + 6)),
    style: c.formato === "moneda" ? { numFmt: '"$"#,##0.00' } : undefined,
  }));

  hoja.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4B99" } };
  hoja.getRow(1).alignment = { vertical: "middle" };
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  filas.forEach((fila) => hoja.addRow(fila));
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };

  const archivo = `${nombreArchivo || "reporte"}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${archivo}"`);
  await libro.xlsx.write(res);
  res.end();
}

module.exports = { enviarExcel };
