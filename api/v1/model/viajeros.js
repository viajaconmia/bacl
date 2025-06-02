const { executeQuery, executeTransaction } = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");

const createViajero = async (viajero) => {
  try {
    const id_viajero = `via-${uuidv4()}`;

    // Insertar el viajero en la tabla "viajeros"
    const query =
      "INSERT INTO viajeros (id_viajero, primer_nombre, segundo_nombre, apellido_paterno, apellido_materno, correo, fecha_nacimiento, genero, telefono, nacionalidad, numero_pasaporte, numero_empleado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";
    const params = [
      id_viajero,
      viajero.primer_nombre,
      viajero.segundo_nombre,
      viajero.apellido_paterno,
      viajero.apellido_materno,
      viajero.correo,
      viajero.fecha_nacimiento,
      viajero.genero,
      viajero.telefono,
      viajero.nacionalidad,
      viajero.numero_pasaporte,
      viajero.numero_empleado,
    ];

    await executeTransaction(query, params, async (result, connection) => {
      console.log("Viajero creado correctamente");

      if (viajero.id_empresas && viajero.id_empresas.length > 0) {
        const query2 =
          "INSERT INTO viajero_empresa (id_viajero, id_empresa) VALUES (?, ?);";

        for (const id_empresa of viajero.id_empresas) {
          const params2 = [id_viajero, id_empresa];
          await connection.execute(query2, params2);
        }
        console.log("Relaciones viajero-empresa creadas");
      }
    });

    return {
      success: true,
      id_viajero: id_viajero,
    };
  } catch (error) {
    throw error;
  }
};

const updateViajero = async (viajero) => {
  try {
    if (!viajero.id_viajero) {
      throw new Error("Se requiere el ID del viajero para actualizar");
    }

    // Actualizar el viajero en la tabla "viajeros"
    const query = `
      UPDATE viajeros 
      SET 
        primer_nombre = ?, 
        segundo_nombre = ?, 
        apellido_paterno = ?, 
        apellido_materno = ?, 
        correo = ?, 
        fecha_nacimiento = ?, 
        genero = ?, 
        telefono = ?, 
        nacionalidad = ?, 
        numero_pasaporte = ?, 
        numero_empleado = ?
      WHERE id_viajero = ?;
    `;

    const params = [
      viajero.primer_nombre,
      viajero.segundo_nombre,
      viajero.apellido_paterno,
      viajero.apellido_materno,
      viajero.correo,
      viajero.fecha_nacimiento,
      viajero.genero,
      viajero.telefono,
      viajero.nacionalidad,
      viajero.numero_pasaporte,
      viajero.numero_empleado,
      viajero.id_viajero, // El ID va al final para el WHERE
    ];

    await executeTransaction(query, params, async (result, connection) => {
      console.log("Viajero actualizado correctamente");

      // Manejo de relaciones con empresas
      if (viajero.id_empresas && viajero.id_empresas.length > 0) {
        // Primero eliminamos todas las relaciones existentes
        const deleteQuery = "DELETE FROM viajero_empresa WHERE id_viajero = ?";
        await connection.execute(deleteQuery, [viajero.id_viajero]);
        console.log("Relaciones anteriores eliminadas");

        // Luego insertamos las nuevas relaciones
        const insertQuery =
          "INSERT INTO viajero_empresa (id_viajero, id_empresa) VALUES (?, ?);";

        for (const id_empresa of viajero.id_empresas) {
          await connection.execute(insertQuery, [
            viajero.id_viajero,
            id_empresa,
          ]);
        }
        console.log("Nuevas relaciones viajero-empresa creadas");
      }
    });

    return {
      success: true,
      id_viajero: viajero.id_viajero,
    };
  } catch (error) {
    throw error;
  }
};

const readViajero = async () => {
  try {
    const query = "SELECT * FROM viajeros";
    const response = executeQuery(query);
    return response;
  } catch (error) {
    throw error;
  }
};
const readViajeroById = async (id) => {
  try {
    const query = `select CONCAT_WS(' ', primer_nombre, segundo_nombre, apellido_paterno, apellido_materno) AS nombre_completo , id_viajero, correo, genero, fecha_nacimiento, telefono, nacionalidad, numero_pasaporte, numero_empleado
from viajeros_con_empresas_con_agentes where id_agente = ?;`;
    const response = executeQuery(query, [id]);
    return response;
  } catch (error) {
    throw error;
  }
};

const deleteViajero = async (id_viajero) => {
  try {
    const query = "DELETE FROM viajeros WHERE id_viajero = ?;";
    const response = executeQuery(query, [id_viajero]);
    return {
      success: true,
      id_viajero,
    };
  } catch (error) {
    throw error;
  }
};

const readAllViajeros = async () => {
  try {
    const query = "select vea.*, a.nombre as nombre_agente from viajeros_con_empresas_con_agentes as vea join agentes as a on vea.id_agente = a.id_agente;";
    const response = executeQuery(query);
    return response;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  readViajero,
  createViajero,
  readViajeroById,
  updateViajero,
  deleteViajero,
  readAllViajeros,
};
