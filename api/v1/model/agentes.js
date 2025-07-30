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
    const query = `
with primer_viajero_por_agente as (
    select 
        ad.wallet,
        a.id_agente AS id_agente,
        a.monto_credito AS monto_credito,
        a.saldo AS saldo,
        a.tiene_credito_consolidado AS tiene_credito_consolidado,
        a.nombre AS nombre,
        a.notas AS notas,
        a.por_confirmar AS por_confirmar,
        a.vendedor AS vendedor,
        a.created_at AS created_agente,
        v.id_viajero AS id_viajero,
        v.primer_nombre AS primer_nombre,
        v.segundo_nombre AS segundo_nombre,
        v.apellido_paterno AS apellido_paterno,
        v.apellido_materno AS apellido_materno,
        v.correo AS correo,
        v.fecha_nacimiento AS fecha_nacimiento,
        v.genero AS genero,
        v.telefono AS telefono,
        v.created_at AS created_at,
        v.updated_at AS updated_at,
        v.nacionalidad AS nacionalidad,
        v.numero_pasaporte AS numero_pasaporte,
        v.numero_empleado AS numero_empleado,
        vea.empresas AS empresas,
        concat_ws(' ', v.primer_nombre, v.segundo_nombre, v.apellido_paterno, v.apellido_materno) AS nombre_agente_completo,
        row_number() OVER (PARTITION BY a.id_agente ORDER BY v_e.created_at) AS rn 
    from agentes a 
    left join empresas_agentes e_a on a.id_agente = e_a.id_agente
    left join viajero_empresa v_e on v_e.id_empresa = e_a.id_empresa
    join viajeros v on v_e.id_viajero = v.id_viajero
    left join viajeros_con_empresas_con_agentes vea on vea.id_viajero = v.id_viajero
    join agente_details ad on ad.id_agente = a.id_agente
)
select 
    primer_viajero_por_agente.id_agente,
    primer_viajero_por_agente.monto_credito,
    primer_viajero_por_agente.saldo,
    primer_viajero_por_agente.tiene_credito_consolidado,
    primer_viajero_por_agente.nombre,
    primer_viajero_por_agente.notas,
    primer_viajero_por_agente.por_confirmar,
    primer_viajero_por_agente.vendedor,
    primer_viajero_por_agente.created_agente,
    primer_viajero_por_agente.id_viajero,
    primer_viajero_por_agente.primer_nombre,
    primer_viajero_por_agente.segundo_nombre,
    primer_viajero_por_agente.apellido_paterno,
    primer_viajero_por_agente.apellido_materno,
    primer_viajero_por_agente.correo,
    primer_viajero_por_agente.fecha_nacimiento,
    primer_viajero_por_agente.genero,
    primer_viajero_por_agente.telefono,
    primer_viajero_por_agente.created_at,
    primer_viajero_por_agente.updated_at,
    primer_viajero_por_agente.nacionalidad,
    primer_viajero_por_agente.numero_pasaporte,
    primer_viajero_por_agente.numero_empleado,
    primer_viajero_por_agente.nombre_agente_completo,
    primer_viajero_por_agente.empresas,
    primer_viajero_por_agente.rn,
    primer_viajero_por_agente.wallet
    
    
from primer_viajero_por_agente
where primer_viajero_por_agente.id_agente = ?
Order by primer_viajero_por_agente.rn desc;
`;
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
