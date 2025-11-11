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
    const query = `select va.id_agente,va.id_viajero, v.*,vca.empresas, vca.rol, (CASE WHEN ad.id_agente is not null then 1 else 0 END) as rn
from agentes_viajeros va
inner join viajeros v on v.id_viajero = va.id_viajero
inner join viajeros_con_empresas_con_agentes vca on vca.id_viajero = v.id_viajero
left join agente_details ad on ad.id_viajero = v.id_viajero
where va.id_agente = ?;`;

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
  console.log("ENTRANDO AL MODELO");
  try {
    const query = `SELECT 
vw.*, 
e.*,
row_number() OVER (PARTITION BY vw.id_agente ORDER BY e.created_at) AS rn 
FROM vw_datos_fiscales_detalle as vw 
Left JOIN empresas as e ON e.id_empresa = vw.id_empresa 
WHERE vw.id_agente = ? and e.active = 1 
group by vw.id_empresa 
order by e.created_at desc`;
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
