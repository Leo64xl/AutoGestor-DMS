const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

/* ------------------------------------------------------------------
 * Modelo de datos del MVP (Etapa 2)
 * Modulos: usuarios y seguridad, vehiculos e inventario,
 *          clientes y prospectos, cotizaciones y apartados, bitacora.
 * ------------------------------------------------------------------ */

const Rol = sequelize.define("rol", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(60), allowNull: false, unique: true },
  descripcion: { type: DataTypes.STRING(255) },
  // RF-004: permisos asignables por perfil
  permisos: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
});

const Usuario = sequelize.define("usuario", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(60), allowNull: false, unique: true },
  nombre: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(120) },
  // RNF-004: solo hash bcrypt, nunca texto plano
  passwordHash: { type: DataTypes.STRING(120), allowNull: false },
  // RF-002: obliga a definir contrasena en el primer acceso
  requiereCambioPassword: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  // RF-005: desactivacion / reactivacion sin perder trazabilidad
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  ultimoAcceso: { type: DataTypes.DATE },
});

const Vehiculo = sequelize.define("vehiculo", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  vin: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  marca: { type: DataTypes.STRING(60), allowNull: false },
  modelo: { type: DataTypes.STRING(60), allowNull: false },
  anio: { type: DataTypes.INTEGER, allowNull: false },
  color: { type: DataTypes.STRING(40), allowNull: false },
  precio: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  // RF-008
  estatus: {
    type: DataTypes.ENUM("disponible", "apartado", "vendido", "en_transito"),
    allowNull: false,
    defaultValue: "disponible",
  },
  // RF-011
  fichaTecnica: { type: DataTypes.TEXT },
  fotos: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  // RF-010: la baja conserva el historial
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  motivoBaja: { type: DataTypes.STRING(255) },
  fechaBaja: { type: DataTypes.DATE },
});

// RF-012: minimo configurable por modelo para generar la alerta de inventario
const MinimoInventario = sequelize.define("minimo_inventario", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  marca: { type: DataTypes.STRING(60), allowNull: false },
  modelo: { type: DataTypes.STRING(60), allowNull: false },
  minimo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
});

const Cliente = sequelize.define("cliente", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(120), allowNull: false },
  apellidos: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(120) },
  telefono: { type: DataTypes.STRING(30) },
  // RF-014
  origen: {
    type: DataTypes.ENUM("showroom", "redes_sociales", "referido", "sitio_web"),
    allowNull: false,
    defaultValue: "showroom",
  },
  // RF-017
  estatus: {
    type: DataTypes.ENUM("nuevo", "en_seguimiento", "cotizando", "cerrado", "perdido", "comprador"),
    allowNull: false,
    defaultValue: "nuevo",
  },

  // Datos fiscales para el CFDI 4.0 (RF-028). Son opcionales mientras el
  // interesado es un prospecto y se vuelven obligatorios al timbrar la factura.
  rfc: { type: DataTypes.STRING(13) },
  razonSocial: { type: DataTypes.STRING(200) },
  regimenFiscal: { type: DataTypes.STRING(3) },
  codigoPostalFiscal: { type: DataTypes.STRING(5) },
  usoCfdi: { type: DataTypes.STRING(4) },
});

// RF-015 / RF-016
const Seguimiento = sequelize.define("seguimiento", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipo: { type: DataTypes.ENUM("llamada", "visita", "mensaje", "correo"), allowNull: false },
  nota: { type: DataTypes.TEXT, allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
});

// RF-019
const Accesorio = sequelize.define("accesorio", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(120), allowNull: false },
  precio: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
});

// RF-018
const Cotizacion = sequelize.define("cotizacion", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  folio: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  precioVehiculo: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  totalAccesorios: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  formaPago: { type: DataTypes.ENUM("contado", "financiamiento"), allowNull: false, defaultValue: "contado" },
  estatus: { type: DataTypes.ENUM("vigente", "apartada", "vendida", "cancelada"), allowNull: false, defaultValue: "vigente" },
  vigenciaHasta: { type: DataTypes.DATEONLY },
});

const CotizacionAccesorio = sequelize.define("cotizacion_accesorio", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cantidad: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  precioUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
});

// RF-020 / RF-021 / RF-022
const Apartado = sequelize.define("apartado", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  folio: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  anticipo: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  fechaLimite: { type: DataTypes.DATEONLY, allowNull: false },
  estatus: { type: DataTypes.ENUM("vigente", "cancelado", "vencido", "vendido"), allowNull: false, defaultValue: "vigente" },
  motivoCancelacion: { type: DataTypes.STRING(255) },
});

// RF-023 a RF-025: pruebas de manejo (UC-04)
const PruebaManejo = sequelize.define("prueba_manejo", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  folio: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  fechaHora: { type: DataTypes.DATE, allowNull: false },
  estatus: {
    type: DataTypes.ENUM("agendada", "realizada", "cancelada"),
    allowNull: false,
    defaultValue: "agendada",
  },
  // RF-024: identificacion y licencia capturadas el dia de la cita
  identificacionTipo: { type: DataTypes.ENUM("ine", "pasaporte", "cedula", "otra") },
  identificacionNumero: { type: DataTypes.STRING(60) },
  licenciaNumero: { type: DataTypes.STRING(60) },
  licenciaVigencia: { type: DataTypes.DATEONLY },
  // RF-025: resultado y observaciones al finalizar
  resultado: { type: DataTypes.ENUM("interesado", "no_interesado", "requiere_otra_unidad") },
  observaciones: { type: DataTypes.TEXT },
  motivoCancelacion: { type: DataTypes.STRING(255) },
});

// RF-026 a RF-030: venta formalizada y su documentacion (UC-03)
const Venta = sequelize.define("venta", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  folio: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  // RF-027 / RF-028: documentos generados por el sistema
  folioContrato: { type: DataTypes.STRING(30), allowNull: false },
  folioFactura: { type: DataTypes.STRING(30), allowNull: false },
  formaPago: { type: DataTypes.ENUM("contado", "financiamiento"), allowNull: false },
  total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  fechaVenta: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  estatus: { type: DataTypes.ENUM("registrada", "entregada", "cancelada"), allowNull: false, defaultValue: "registrada" },
  // RF-030: traspaso y entrega
  entregaCompletada: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  fechaEntrega: { type: DataTypes.DATE },
  observacionesEntrega: { type: DataTypes.TEXT },

  // RF-028: timbrado del CFDI 4.0 ante el SAT a traves de Facturama.
  cfdiEstatus: {
    type: DataTypes.ENUM("sin_timbrar", "timbrada", "cancelada", "error"),
    allowNull: false,
    defaultValue: "sin_timbrar",
  },
  // Folio fiscal que asigna el SAT.
  cfdiUuid: { type: DataTypes.STRING(40) },
  // Identificador del comprobante dentro de Facturama, necesario para descargar y cancelar.
  cfdiId: { type: DataTypes.STRING(60) },
  cfdiFecha: { type: DataTypes.DATE },
  cfdiSimulado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  cfdiError: { type: DataTypes.TEXT },
});

// RF-029: documentacion del cliente requerida para la venta
const DocumentoVenta = sequelize.define("documento_venta", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipo: {
    type: DataTypes.ENUM("identificacion", "comprobante_domicilio", "comprobante_ingresos", "otro"),
    allowNull: false,
  },
  referencia: { type: DataTypes.STRING(120), allowNull: false },
  archivoUrl: { type: DataTypes.STRING(500) },
});

// RF-031 a RF-033: solicitud de financiamiento y condiciones del credito
const SolicitudFinanciamiento = sequelize.define("solicitud_financiamiento", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  folio: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  entidadFinanciera: { type: DataTypes.STRING(120), allowNull: false },
  montoSolicitado: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  estatus: {
    type: DataTypes.ENUM("capturada", "enviada", "aprobada", "rechazada"),
    allowNull: false,
    defaultValue: "capturada",
  },
  fechaEnvio: { type: DataTypes.DATE },
  fechaRespuesta: { type: DataTypes.DATE },
  // RF-033: condiciones del credito aprobado
  enganche: { type: DataTypes.DECIMAL(12, 2) },
  plazoMeses: { type: DataTypes.INTEGER },
  tasaAnual: { type: DataTypes.DECIMAL(5, 2) },
  observaciones: { type: DataTypes.TEXT },
});

// RF-034: pagos de contado o en abonos
const Pago = sequelize.define("pago", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  folio: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  tipo: { type: DataTypes.ENUM("contado", "enganche", "abono"), allowNull: false },
  metodo: { type: DataTypes.ENUM("efectivo", "transferencia", "tarjeta", "cheque"), allowNull: false },
  monto: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  referencia: { type: DataTypes.STRING(120) },
});

// RF-035 / RF-036: servicios de mantenimiento postventa
const ServicioPostventa = sequelize.define("servicio_postventa", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  folio: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  tipo: {
    type: DataTypes.ENUM("mantenimiento_menor", "mantenimiento_mayor", "garantia", "revision_general"),
    allowNull: false,
  },
  fechaCita: { type: DataTypes.DATE, allowNull: false },
  estatus: { type: DataTypes.ENUM("agendado", "realizado", "cancelado"), allowNull: false, defaultValue: "agendado" },
  kilometraje: { type: DataTypes.INTEGER },
  descripcion: { type: DataTypes.TEXT },
  observaciones: { type: DataTypes.TEXT },
  costo: { type: DataTypes.DECIMAL(12, 2) },
  motivoCancelacion: { type: DataTypes.STRING(255) },
});

// RF-006 / RF-040 / RNF-012: registro inmutable de eventos
const Bitacora = sequelize.define(
  "bitacora",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    usuarioId: { type: DataTypes.INTEGER },
    usuarioNombre: { type: DataTypes.STRING(120) },
    accion: { type: DataTypes.STRING(80), allowNull: false },
    entidad: { type: DataTypes.STRING(60) },
    entidadId: { type: DataTypes.STRING(60) },
    detalle: { type: DataTypes.TEXT },
    ip: { type: DataTypes.STRING(60) },
  },
  { updatedAt: false }
);

/* ---------------------------- Asociaciones ---------------------------- */

Rol.hasMany(Usuario, { foreignKey: { name: "rolId", allowNull: false } });
Usuario.belongsTo(Rol, { foreignKey: { name: "rolId", allowNull: false } });

Cliente.hasMany(Seguimiento, { as: "seguimientos", foreignKey: { name: "clienteId", allowNull: false }, onDelete: "CASCADE" });
Seguimiento.belongsTo(Cliente, { foreignKey: { name: "clienteId", allowNull: false } });
Usuario.hasMany(Seguimiento, { foreignKey: "usuarioId" });
Seguimiento.belongsTo(Usuario, { foreignKey: "usuarioId" });

Cliente.hasMany(Cotizacion, { as: "cotizaciones", foreignKey: { name: "clienteId", allowNull: false } });
Cotizacion.belongsTo(Cliente, { foreignKey: { name: "clienteId", allowNull: false } });
Vehiculo.hasMany(Cotizacion, { foreignKey: { name: "vehiculoId", allowNull: false } });
Cotizacion.belongsTo(Vehiculo, { foreignKey: { name: "vehiculoId", allowNull: false } });
Usuario.hasMany(Cotizacion, { foreignKey: { name: "usuarioId", allowNull: false } });
Cotizacion.belongsTo(Usuario, { foreignKey: { name: "usuarioId", allowNull: false } });

Cotizacion.hasMany(CotizacionAccesorio, { as: "detalleAccesorios", foreignKey: { name: "cotizacionId", allowNull: false }, onDelete: "CASCADE" });
CotizacionAccesorio.belongsTo(Cotizacion, { foreignKey: { name: "cotizacionId", allowNull: false } });
Accesorio.hasMany(CotizacionAccesorio, { foreignKey: { name: "accesorioId", allowNull: false } });
CotizacionAccesorio.belongsTo(Accesorio, { foreignKey: { name: "accesorioId", allowNull: false } });

Cliente.hasMany(Apartado, { as: "apartados", foreignKey: { name: "clienteId", allowNull: false } });
Apartado.belongsTo(Cliente, { foreignKey: { name: "clienteId", allowNull: false } });
Vehiculo.hasMany(Apartado, { foreignKey: { name: "vehiculoId", allowNull: false } });
Apartado.belongsTo(Vehiculo, { foreignKey: { name: "vehiculoId", allowNull: false } });
Usuario.hasMany(Apartado, { foreignKey: { name: "usuarioId", allowNull: false } });
Apartado.belongsTo(Usuario, { foreignKey: { name: "usuarioId", allowNull: false } });
Cotizacion.hasOne(Apartado, { foreignKey: "cotizacionId" });
Apartado.belongsTo(Cotizacion, { foreignKey: "cotizacionId" });

// Pruebas de manejo
Cliente.hasMany(PruebaManejo, { as: "pruebas", foreignKey: { name: "clienteId", allowNull: false } });
PruebaManejo.belongsTo(Cliente, { foreignKey: { name: "clienteId", allowNull: false } });
Vehiculo.hasMany(PruebaManejo, { foreignKey: { name: "vehiculoId", allowNull: false } });
PruebaManejo.belongsTo(Vehiculo, { foreignKey: { name: "vehiculoId", allowNull: false } });
Usuario.hasMany(PruebaManejo, { foreignKey: { name: "usuarioId", allowNull: false } });
PruebaManejo.belongsTo(Usuario, { foreignKey: { name: "usuarioId", allowNull: false } });

// Ventas formalizadas
Cliente.hasMany(Venta, { as: "ventas", foreignKey: { name: "clienteId", allowNull: false } });
Venta.belongsTo(Cliente, { foreignKey: { name: "clienteId", allowNull: false } });
Vehiculo.hasMany(Venta, { foreignKey: { name: "vehiculoId", allowNull: false } });
Venta.belongsTo(Vehiculo, { foreignKey: { name: "vehiculoId", allowNull: false } });
Usuario.hasMany(Venta, { foreignKey: { name: "usuarioId", allowNull: false } });
Venta.belongsTo(Usuario, { foreignKey: { name: "usuarioId", allowNull: false } });
Cotizacion.hasOne(Venta, { foreignKey: "cotizacionId" });
Venta.belongsTo(Cotizacion, { foreignKey: "cotizacionId" });
Apartado.hasOne(Venta, { foreignKey: "apartadoId" });
Venta.belongsTo(Apartado, { foreignKey: "apartadoId" });

Venta.hasMany(DocumentoVenta, { as: "documentos", foreignKey: { name: "ventaId", allowNull: false }, onDelete: "CASCADE" });
DocumentoVenta.belongsTo(Venta, { foreignKey: { name: "ventaId", allowNull: false } });

// Financiamiento y pagos
Venta.hasOne(SolicitudFinanciamiento, { as: "financiamiento", foreignKey: { name: "ventaId", allowNull: false } });
SolicitudFinanciamiento.belongsTo(Venta, { foreignKey: { name: "ventaId", allowNull: false } });
Usuario.hasMany(SolicitudFinanciamiento, { foreignKey: "usuarioId" });
SolicitudFinanciamiento.belongsTo(Usuario, { foreignKey: "usuarioId" });

Venta.hasMany(Pago, { as: "pagos", foreignKey: { name: "ventaId", allowNull: false }, onDelete: "CASCADE" });
Pago.belongsTo(Venta, { foreignKey: { name: "ventaId", allowNull: false } });
Usuario.hasMany(Pago, { foreignKey: "usuarioId" });
Pago.belongsTo(Usuario, { foreignKey: "usuarioId" });

// Postventa
Vehiculo.hasMany(ServicioPostventa, { as: "servicios", foreignKey: { name: "vehiculoId", allowNull: false } });
ServicioPostventa.belongsTo(Vehiculo, { foreignKey: { name: "vehiculoId", allowNull: false } });
Cliente.hasMany(ServicioPostventa, { as: "servicios", foreignKey: { name: "clienteId", allowNull: false } });
ServicioPostventa.belongsTo(Cliente, { foreignKey: { name: "clienteId", allowNull: false } });
Venta.hasMany(ServicioPostventa, { foreignKey: "ventaId" });
ServicioPostventa.belongsTo(Venta, { foreignKey: "ventaId" });

module.exports = {
  sequelize,
  Rol,
  Usuario,
  Vehiculo,
  MinimoInventario,
  Cliente,
  Seguimiento,
  Accesorio,
  Cotizacion,
  CotizacionAccesorio,
  Apartado,
  PruebaManejo,
  Venta,
  DocumentoVenta,
  SolicitudFinanciamiento,
  Pago,
  ServicioPostventa,
  Bitacora,
};
