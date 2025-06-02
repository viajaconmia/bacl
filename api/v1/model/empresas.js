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

    const response = await executeTransaction(
      query,
      params,
      async (result, connection) => {
        console.log("Se crea empresa");

        const query2 =
          "INSERT INTO empresas_agentes (id_empresa, id_agente) VALUES (?, ?);";
        const params2 = [id_empresa, empresa.agente_id];

        try {
          const result = await connection.execute(query2, params2);
          console.log("Se crea agente empresa");
          return result;
        } catch (error) {
          throw error;
        }
      }
    );

    return {
      success: true,
      id_empresa: id_empresa,
    };
  } catch (error) {
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
    const query1 = "Update empresas set estado = false where id_empresa = ?;";
    const response = await executeQuery(query1, [id_empresa]);
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
