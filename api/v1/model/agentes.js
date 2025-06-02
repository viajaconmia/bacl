const { executeTransaction, executeQuery } = require("../../../config/db");
const { supabase } = require("../../../config/auth");

const createAgente = async (data) => {
  try {
    console.log(data);
    let query = `INSERT INTO agentes (id_agente, nombre) VALUES (?,?)`;
    let nombre = [data.name, data.secondname, data.lastname1, data.lastname2]
      .filter((item) => !!item)
      .join(" ");
    console.log("hola");
    console.log(nombre);
    let params = [data.id, nombre];
    let response = await executeQuery(query, params);
    console.log(response);

    return response;
  } catch (error) {
    throw error;
  }
};

const getAgente = async (id_agente) => {
  try {
    const query =
      "SELECT * FROM viajeros_con_empresas_con_agentes WHERE id_agente = ?";
    const params = [id_agente];
    const response = await executeQuery(query, params);
    console.log(response);
    return response;
  } catch (error) {
    throw error;
  }
};

const getAgenteEmpresa = async (id_agente) => {
  try {
    const query = "SELECT * FROM empresas_con_agentes WHERE id_agente = ?";
    const params = [id_agente];
    const response = await executeQuery(query, params);
    console.log("hola");
    console.log(response);
    return response;
  } catch (error) {
    throw error;
  }
};

const getEmpresasDatosFiscales = async (id_agente) => {
  try {
    const query =
      "SELECT vw.*, e.active FROM vw_datos_fiscales_detalle as vw Left JOIN empresas as e ON e.id_empresa = vw.id_empresa WHERE vw.id_agente = ? and e.active = 1 group by vw.id_empresa order by vw.datos_fiscales_updated_at desc";
    const params = [id_agente];
    const response = await executeQuery(query, params);
    console.log("hola");
    console.log(response);
    return response;
  } catch (error) {
    throw error;
  }
};

const getAllAgentes = async () => {
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    return data;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createAgente,
  getAgente,
  getAgenteEmpresa,
  getEmpresasDatosFiscales,
  getAllAgentes,
};
