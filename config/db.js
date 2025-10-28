const mysql = require("mysql2/promise");
const { CustomError } = require("../middleware/errorHandler");
const ERROR = require("../v2/constant/messages");
const { Formato } = require("../lib/utils/formats");
const { Validacion } = require("../lib/utils/validates");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 15,
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
    throw new CustomError(
      error.sqlMessage ||
        error.message ||
        "Ha ocurrido un error al hacer la petición",
      error.statusCode || 500,
      error.errorCode || "DATABASE_ERROR",
      error
    );
  } finally {
    connection.release();
  }
}

async function insert(connection, schema, obj) {
  Validacion.requiredColumns(schema.required, obj);
  const propiedades = Formato.propiedades(schema.columnas, obj);

  const query = `INSERT INTO ${schema.table} (${propiedades
    .map((p) => p.key)
    .join(",")}) VALUES (${propiedades.map((_) => "?").join(",")});`;
  const response = await connection.execute(
    query,
    propiedades.map((p) => p.value)
  );
  return [obj, response];
}

async function update(connection, schema, obj) {
  try {
    if (!schema.id) {
      throw new Error(ERROR.ID.EMPTY);
    }
    const props = Formato.propiedades(schema.columnas, obj, schema.id);
    if (props.length == 0) throw new Error(ERROR.PROPS.EMPTY);
    const query = `UPDATE ${schema.table} SET ${props
      .map((p) => p.key)
      .join(" = ?,")} = ? WHERE ${schema.id} = ?`;
    const response = await connection.execute(query, [
      ...props.map((p) => p.value),
      obj[schema.id],
    ]);
    return [obj, response];
  } catch (error) {
    throw error;
  }
}

async function getByIds(schema, ...id) {
  try {
    return await executeQuery(
      `SELECT * FROM ${schema.table} WHERE ${schema.id} in (${id
        .map((_) => "?")
        .join(",")})`,
      [...id]
    );
  } catch (error) {
    throw error;
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
  insert,
  update,
  getByIds,
};
