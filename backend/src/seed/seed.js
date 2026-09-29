require("dotenv").config();

const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const { sequelize, Rol, Usuario, Vehiculo, MinimoInventario, Cliente, Accesorio } = require("../models");
const { PERMISOS } = require("../middleware/auth");

/**
 * Matriz de permisos derivada del diagrama general de casos de uso (Figura 1)
 * y de la descripcion de actores de la Etapa 1. Cada perfil recibe unicamente
 * los modulos que corresponden a su funcion: lo que no le toca no aparece.
 */
const ROLES = [
  {
    nombre: "Administrador",
    descripcion: "Configuracion del sistema, usuarios, postventa, reportes y seguridad",
    // Perfil tecnico responsable del sistema completo (UC-06).
    permisos: ["*"],
  },
  {
    nombre: "Gerente de Ventas",
    descripcion: "Inventario, seguimiento comercial y reportes; supervisa la operacion de venta",
    permisos: [
      // UC-05: administra el inventario.
      PERMISOS.VEHICULOS_VER,
      PERMISOS.VEHICULOS_GESTIONAR,
      // Da seguimiento a clientes y prospectos.
      PERMISOS.CLIENTES_VER,
      PERMISOS.CLIENTES_GESTIONAR,
      // Supervisa el proceso comercial en modo consulta.
      PERMISOS.VENTAS_VER,
      PERMISOS.PRUEBAS_VER,
      PERMISOS.FINANCIAMIENTO_VER,
      PERMISOS.POSTVENTA_VER,
      // HU-11, HU-24: indicadores del negocio.
      PERMISOS.REPORTES_VER,
    ],
  },
  {
    nombre: "Vendedor",
    descripcion: "Atencion comercial: cotizaciones, apartados, pruebas de manejo, ventas y financiamiento",
    permisos: [
      // Consulta el catalogo (HU-02) pero no administra el inventario.
      PERMISOS.VEHICULOS_VER,
      PERMISOS.CLIENTES_VER,
      PERMISOS.CLIENTES_GESTIONAR,
      PERMISOS.VENTAS_VER,
      PERMISOS.VENTAS_GESTIONAR,
      PERMISOS.PRUEBAS_VER,
      PERMISOS.PRUEBAS_GESTIONAR,
      PERMISOS.FINANCIAMIENTO_VER,
      PERMISOS.FINANCIAMIENTO_GESTIONAR,
      // Sin postventa, reportes, bitacora ni administracion de usuarios.
    ],
  },
  {
    nombre: "Auditor",
    descripcion: "Perfil de solo consulta para control interno",
    permisos: [
      // HU-12: revision de reportes y bitacora, sin ninguna accion de escritura.
      PERMISOS.VEHICULOS_VER,
      PERMISOS.CLIENTES_VER,
      PERMISOS.VENTAS_VER,
      PERMISOS.PRUEBAS_VER,
      PERMISOS.FINANCIAMIENTO_VER,
      PERMISOS.POSTVENTA_VER,
      PERMISOS.REPORTES_VER,
      PERMISOS.BITACORA_VER,
    ],
  },
];

const USUARIOS = [
  { username: "admin", nombre: "Administrador del Sistema", rol: "Administrador", password: "Admin1234" },
  { username: "gerente", nombre: "Laura Mendoza", rol: "Gerente de Ventas", password: "Gerente1234" },
  { username: "vendedor", nombre: "Carlos Rivas", rol: "Vendedor", password: "Vendedor1234" },
  { username: "auditor", nombre: "Ana Castillo", rol: "Auditor", password: "Auditor1234" },
];

const VEHICULOS = [
  { vin: "3VW1K7AJ5EM000101", marca: "Volkswagen", modelo: "Jetta", anio: 2025, color: "Blanco", precio: 429900, fichaTecnica: "1.4 TSI, 150 hp, transmision automatica de 6 velocidades." },
  { vin: "3VW1K7AJ5EM000102", marca: "Volkswagen", modelo: "Jetta", anio: 2025, color: "Gris Platino", precio: 439900, fichaTecnica: "1.4 TSI, 150 hp, paquete Highline." },
  { vin: "1NXBR32E85Z000201", marca: "Toyota", modelo: "Corolla", anio: 2025, color: "Rojo", precio: 459900, fichaTecnica: "2.0 L Dynamic Force, 169 hp, CVT." },
  { vin: "1NXBR32E85Z000202", marca: "Toyota", modelo: "Corolla", anio: 2024, color: "Negro", precio: 419900, fichaTecnica: "1.8 L hibrido, 121 hp." },
  { vin: "1HGCV1F30LA000301", marca: "Honda", modelo: "CR-V", anio: 2025, color: "Azul", precio: 689900, fichaTecnica: "1.5 Turbo, 190 hp, traccion delantera." },
  { vin: "3N1AB7AP4JY000401", marca: "Nissan", modelo: "Versa", anio: 2025, color: "Plata", precio: 329900, fichaTecnica: "1.6 L, 118 hp, transmision manual." },
  { vin: "3N1AB7AP4JY000402", marca: "Nissan", modelo: "Versa", anio: 2025, color: "Blanco", precio: 349900, fichaTecnica: "1.6 L, 118 hp, CVT Advance." },
  { vin: "MAJ6S3KL0LC000501", marca: "Ford", modelo: "Escape", anio: 2024, color: "Gris Oxford", precio: 729900, fichaTecnica: "2.0 EcoBoost, 250 hp, AWD." },
];

const MINIMOS = [
  { marca: "Volkswagen", modelo: "Jetta", minimo: 3 },
  { marca: "Toyota", modelo: "Corolla", minimo: 2 },
  { marca: "Nissan", modelo: "Versa", minimo: 4 },
];

const ACCESORIOS = [
  { nombre: "Seguro de aro y llanta", precio: 3500 },
  { nombre: "Paquete de proteccion (polarizado + tapetes)", precio: 8900 },
  { nombre: "Sistema de alarma con GPS", precio: 12500 },
  { nombre: "Rack de techo", precio: 6800 },
  { nombre: "Extension de garantia 2 anios", precio: 18900 },
];

const CLIENTES = [
  { nombre: "Maria", apellidos: "Hernandez Lopez", email: "maria.hernandez@example.com", telefono: "7711234567", origen: "showroom" },
  { nombre: "Jorge", apellidos: "Ramirez Soto", email: "jorge.ramirez@example.com", telefono: "7719876543", origen: "redes_sociales" },
  { nombre: "Patricia", apellidos: "Gomez Ruiz", email: "patricia.gomez@example.com", telefono: "7715558899", origen: "referido" },
];

async function main() {
  const nombreBD = process.env.DB_NAME || "autogestor_dms";
  try {
    const conexion = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
    });
    await conexion.query(`CREATE DATABASE IF NOT EXISTS \`${nombreBD}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conexion.end();
  } catch (err) {
    // En Docker la base ya viene creada por la imagen de MySQL.
    console.warn(`No se pudo crear la base "${nombreBD}" (${err.code || err.message}); se asume que ya existe.`);
  }

  // Espera a que MySQL responda: el contenedor puede tardar en aceptar conexiones.
  for (let intento = 1; intento <= 30; intento += 1) {
    try {
      await sequelize.authenticate();
      break;
    } catch (err) {
      if (intento === 30) throw err;
      console.log(`Base de datos no disponible (intento ${intento}/30); reintentando...`);
      await new Promise((seguir) => setTimeout(seguir, 2000));
    }
  }

  // "alter" solo cuando se pide de forma explicita: reconstruye las llaves
  // foraneas y MySQL rechaza recrear las que ya existen.
  await sequelize.sync({ alter: process.env.DB_SYNC_ALTER === "true" });

  for (const rol of ROLES) {
    const [registro] = await Rol.findOrCreate({ where: { nombre: rol.nombre }, defaults: rol });
    registro.permisos = rol.permisos;
    registro.descripcion = rol.descripcion;
    await registro.save();
  }

  for (const u of USUARIOS) {
    const rol = await Rol.findOne({ where: { nombre: u.rol } });
    await Usuario.findOrCreate({
      where: { username: u.username },
      defaults: {
        nombre: u.nombre,
        rolId: rol.id,
        passwordHash: await bcrypt.hash(u.password, 10),
        requiereCambioPassword: true, // RF-002
      },
    });
  }

  for (const v of VEHICULOS) await Vehiculo.findOrCreate({ where: { vin: v.vin }, defaults: v });
  for (const m of MINIMOS) await MinimoInventario.findOrCreate({ where: { marca: m.marca, modelo: m.modelo }, defaults: m });
  for (const a of ACCESORIOS) await Accesorio.findOrCreate({ where: { nombre: a.nombre }, defaults: a });
  for (const c of CLIENTES) await Cliente.findOrCreate({ where: { email: c.email }, defaults: c });

  console.log("Datos iniciales cargados.\nUsuarios de prueba (todos piden cambio de contrasena en el primer acceso):");
  USUARIOS.forEach((u) => console.log(`  ${u.username.padEnd(10)} ${u.password.padEnd(14)} ${u.rol}`));
  await sequelize.close();
}

main().catch((err) => {
  console.error("Error al cargar los datos iniciales:", err.message);
  process.exit(1);
});
