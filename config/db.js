const mysql = require("mysql2/promise");
const { CustomError } = require("../middleware/errorHandler");
require("dotenv").config();

const pool = mysql.createPool({
  // host: "localhost",
  // user: "root",
  // password: "admin",
  // database: "mia",
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 15,
  // timezone: "-06:00",
  multipleStatements: true,
  typeCast: function (field, next) {
    if (field.type === "JSON") {
      return JSON.parse(field.string());
    }
    return next();
  },
});

pool.on("connection", (conn) => {
  conn.query("SET time_zone = '-06:00'");
});

async function executeQuery(query, params = []) {
  try {
    const [results] = await pool.execute(query, params);
    return results;
  } catch (error) {
    console.log(error);
    throw new CustomError(
      error.sqlMessage || "Ha ocurrido un error al hacer la petición",
      500,
      "DATABASE_ERROR",
      error
    );
  }
}

async function executeSP(procedure, params = []) {
  const connection = await pool.getConnection();
  try {
    const placeholders = params.map(() => "?").join(", ");
    const query = `CALL ${procedure}(${placeholders});`;
    const result = await connection.query(query, params);
    const [rows] = result;
    return Array.isArray(rows[0]) ? rows[0] : rows;
  } catch (error) {
    throw new CustomError(
      error.sqlMessage,
      500,
      "ERROR_STORED_PROCEDURE",
      error
    );
  } finally {
    connection.release();
  }
}

async function executeTransaction(query, params, callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [results] = await connection.execute(query, params);
    const resultsCallback = await callback(results, connection);
    await connection.commit();
    return { results, resultsCallback };
  } catch (error) {
    console.log("UPS HICIMOS ROLLBACK POR SI LAS DUDAS");
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function executeSP2(procedure, params = [], { allSets = false } = {}) {
  const conn = await pool.getConnection();
  try {
    const placeholders = params.map(() => "?").join(", ");
    const sql = `CALL ${procedure}(${placeholders})`;

    const [rows] = await conn.query(sql, params);
    const sets = Array.isArray(rows) ? rows.filter(Array.isArray) : [rows];

    return allSets ? sets : sets[0]; // por defecto como antes; con allSets:true devuelve todos
  } catch (error) {
    throw new CustomError(
      error.sqlMessage || String(error),
      500,
      "ERROR_STORED_PROCEDURE",
      error
    );
  } finally {
    conn.release();
  }
}

async function runTransaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const resultsCallback = await callback(connection);
    await connection.commit();
    return resultsCallback;
  } catch (error) {
    await connection.rollback();
    if (error instanceof CustomError) {
      throw error;
    }
    console.log(error);
    throw new CustomError(
      error.message || "Error corriendo la transaction",
      error.statusCode || 500,
      error.errorCode || "ERROR_RUN TRANSACTION",
      error.details || error
    );
  } finally {
    connection.release();
  }
}

async function executeTransactionSP(procedure, params = []) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const placeholders = params.map(() => "?").join(", ");
    const query = `CALL ${procedure}(${placeholders})`;
    const result = await connection.query(query, params);
    const [rows] = result;

    await connection.commit();
    return Array.isArray(rows[0]) ? rows[0] : rows;
  } catch (error) {
    await connection.rollback();
    console.error(
      `Error ejecutando SP, ya manejamos el rollback "${procedure}":`,
      error.message
    );
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  executeQuery,
  executeTransaction,
  executeSP,
  runTransaction,
  executeTransactionSP,
  executeSP2,
};
