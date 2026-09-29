require("dotenv").config();

const mysql = require("mysql2/promise");
const app = require("./src/app");
const { sequelize } = require("./src/models");
const { liberarApartadosVencidos } = require("./src/routes/ventas");

const PORT = Number(process.env.PORT || 3001);

/**
 * Crea la base de datos si aun no existe, para que el primer arranque no falle.
 * En Docker la crea la propia imagen de MySQL y el usuario de la aplicacion no
 * tiene privilegio para CREATE DATABASE: por eso un fallo aqui no detiene el
 * arranque, la conexion real se valida despues con authenticate().
 */
async function asegurarBaseDeDatos() {
  const nombre = process.env.DB_NAME || "autogestor_dms";
  try {
    const conexion = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
    });
    await conexion.query(`CREATE DATABASE IF NOT EXISTS \`${nombre}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conexion.end();
  } catch (err) {
    console.warn(`No se pudo crear la base "${nombre}" (${err.code || err.message}); se asume que ya existe.`);
  }
}

/**
 * Espera a que la base responda. En Docker el contenedor de la aplicacion puede
 * arrancar antes de que MySQL termine de inicializarse.
 */
async function esperarBaseDeDatos(intentos = 30, esperaMs = 2000) {
  for (let intento = 1; intento <= intentos; intento += 1) {
    try {
      await sequelize.authenticate();
      return;
    } catch (err) {
      if (intento === intentos) throw err;
      console.log(`Base de datos no disponible (intento ${intento}/${intentos}); reintentando...`);
      await new Promise((seguir) => setTimeout(seguir, esperaMs));
    }
  }
}

async function iniciar() {
  try {
    await asegurarBaseDeDatos();
    await esperarBaseDeDatos();
    // Crea las tablas que falten sin intentar alterar las existentes: "alter" reconstruye
    // las llaves foraneas en cada arranque y MySQL 5.7 rechaza recrear las que ya existen.
    // Los cambios de esquema se aplican con "npm run seed".
    await sequelize.sync();
    console.log("Base de datos sincronizada");

    // RF-021: barrido inicial de apartados vencidos; se repite cada hora.
    await liberarApartadosVencidos();
    setInterval(() => {
      liberarApartadosVencidos().catch((e) => console.error("Error liberando apartados:", e.message));
    }, 60 * 60 * 1000);

    app.listen(PORT, () => console.log(`Servidor backend en http://localhost:${PORT}`));
  } catch (err) {
    console.error("No se pudo iniciar el servidor:", err.message);
    process.exit(1);
  }
}

iniciar();
