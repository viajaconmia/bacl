const mysql = require('mysql2/promise');
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
  multipleStatements: true,
  typeCast: function(field, next) {
    if (field.type === 'JSON') {
      return JSON.parse(field.string());
    }
    return next();
  }
});

async function executeQuery(query, params) {
  try {
    const [results] = await pool.execute(query, params);
    return results;
  } catch (error) {
    console.log(error);
    throw error;
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
    console.log("UPS HICIMOS ROLLBACK POR SI LAS DUDAS")
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function executeSP(procedure, params = [], raw = false) {
  const connection = await pool.getConnection();

  try {
    const placeholders = params.map(() => '?').join(', ');
    const query = `CALL ${procedure}(${placeholders})`;

    const [rows] = await connection.query(query, params);

    if (raw) {
      return rows; // Devuelve todos los resultsets
    }

    // Devuelve solo el primer resultset por compatibilidad con casos anteriores
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  } catch (error) {
    console.error(`Error ejecutando SP "${procedure}":`, error.message);
    throw error;
  } finally {
    connection.release();
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
    console.log("UPS HICIMOS ROLLBACK POR SI LAS DUDAS")
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { pool, executeQuery, executeTransaction,executeSP, runTransaction };

