const { executeQuery, executeTransaction } = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");

const createEmpresa = async (empresa) => {
  try {
    const id_empresa = `emp-${uuidv4()}`;

    const query = `
      INSERT INTO empresas (
        id_empresa, razon_social, nombre_comercial, tipo_persona, 
        calle, colonia, estado, municipio, codigo_postal
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    let params = [
      id_empresa,
      empresa.razon_social,
      empresa.nombre_comercial,
      empresa.tipo_persona,
      empresa.calle || null,
      empresa.colonia || null,
      empresa.estado || null,
      empresa.municipio || null,
      empresa.codigo_postal || null,
    ];

    // La principal corrección está aquí:
    // El segundo 'await' se hace dentro del callback de 'executeTransaction'.
    const response = await executeTransaction(
      query,
      params,
      async (result, connection) => {
        console.log("Se crea empresa");

        const query2 = "INSERT INTO empresas_agentes (id_empresa, id_agente) VALUES (?, ?);";
        const params2 = [id_empresa, empresa.agente_id];

        try {
          // Usamos 'await' en la conexión para asegurarnos de que se ejecute en la misma transacción.
          await connection.execute(query2, params2);
          console.log("Se crea agente empresa");
          // Devolvemos el resultado del primer 'execute' o simplemente confirmamos el éxito.
          return result;
        } catch (error) {
          // Si hay un error, lo relanzamos para que la transacción se revierta.
          console.error("Error en la segunda inserción:", error);
          throw error;
        }
      }
    );

    return {
      success: true,
      id_empresa: id_empresa,
    };
  } catch (error) {
    // Si la transacción falla en cualquier punto, el error se captura aquí.
    console.error("Error en la transacción principal:", error);
    throw error;
  }
};

const updateEmpresa = async (empresa) => {
  try {
    // Asumimos que empresa.id_empresa ya existe
    if (!empresa.id_empresa) {
      throw new Error("Se requiere el ID de la empresa para actualizar");
    }
    console.log(empresa);

    const query = `
      UPDATE empresas 
      SET 
        razon_social = ?, 
        nombre_comercial = ?, 
        tipo_persona = ?, 
        calle = ?, 
        colonia = ?, 
        estado = ?, 
        municipio = ?, 
        codigo_postal = ?
      WHERE id_empresa = ?;
    `;

    let params = [
      empresa.razon_social,
      empresa.nombre_comercial,
      empresa.tipo_persona,
      empresa.calle || null,
      empresa.colonia || null,
      empresa.estado || null,
      empresa.municipio || null,
      empresa.codigo_postal || null,
      empresa.id_empresa, // ID de la empresa a actualizar
    ];
    const response = await executeQuery(query, params);
    return {
      success: true,
      id_empresa: empresa.id_empresa, // Devolvemos el mismo ID
    };
  } catch (error) {
    throw error;
  }
};

const deleteEmpresa = async (id_empresa) => {
  try {
    const query1 = "DELETE FROM datos_fiscales WHERE id_empresa = ?;";
    await executeTransaction(query1, [id_empresa], async (result, connection) => {
      
      const deleteAgentes = "DELETE FROM empresas_agentes WHERE id_empresa = ?;";
      await connection.execute(deleteAgentes, [id_empresa]);
      // Eliminar la empresa
      const query2 = "DELETE FROM empresas WHERE id_empresa = ?;";
      await connection.execute(query2, [id_empresa]);
    });
    return {
      success: true,
      id_empresa,
    };
  } catch (error) {
    console.error("Error al eliminar empresa:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

const getEmpresas = async () => {
  try {
    const query = "SELECT * FROM empresas";
    const response = await executeQuery(query);
    return response;
  } catch (error) {
    throw error;
  }
}

const getAllEmpresas = async () => {
  try {
    const query = "SELECT * FROM vw_datos_fiscales_detalle"
    const response = await executeQuery(query)
    return response
  } catch (error) {
    throw error
  }
};

const getEmpresaById = async ({ id }) => {
  try {
    const query = "SELECT * FROM empresas WHERE id_empresa = ?";
    const response = await executeQuery(query, [id]);
    return response[0];
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createEmpresa,
  getEmpresas,
  getEmpresaById,
  updateEmpresa,
  deleteEmpresa,
  getAllEmpresas,
};
