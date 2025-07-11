
const { executeSP } = require("../../../config/db");
const model = require("../model/agentes")

const create = async (req, res) => {
  try {

    const response = await model.createAgente(req.body);

    res.status(201).json({ message: "Agente creado correctamente", data: response })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}

const read = async (req, res) => {

  try {
    const { id_agente } = req.query;
    const agentes = await model.getAgente(id_agente);

    res.status(200).json({ data: agentes })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}

const readAgentesCompanies = async (req, res) => {
  try {
    const { id_agente } = req.query;
    const agentes = await model.getAgenteEmpresa(id_agente);

    res.status(200).json({ data: agentes })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}

const readEmpresasDatosFiscales = async (req, res) => {
  try {
    const { id_agente } = req.query;
    const agentes = await model.getEmpresasDatosFiscales(id_agente);

    res.status(200).json({ data: agentes })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}

//ya no devuelve solo el id, devuelve mas datos
const getAgenteId = async (req, res) => {
  const { nombre, correo } = req.query;
  const nombre2 = nombre?.trim() || '';
  const correo2 = correo?.trim() || '';
  console.log("Nombre:", `"${nombre2}"`, "Correo:", `"${correo2}"`);
//terminar coso de las vistas
  try {
    const result = await executeSP("buscar_agente", [nombre2, correo2], true);
    console.log("Resultado completo: ", result);

    const agentes = result?.[0] ?? []; // seguridad adicional

    if (agentes.length === 0) {
      return res.status(404).json({ message: "No se encontró al agente" });
    }

    return res.status(200).json({
      success: true,
      message: "Agentes recuperados correctamente",
      data: agentes
    });

  } catch (error) {
    console.error("Error al recuperar agentes:", error);
    res.status(500).json({ message: "Problema en el servidor", error });
  }
}


const readAgentes = async (req, res) => {
  try {
    const agentes = await model.getAllAgentes();

    res.status(200).json({ data: agentes })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}

const get_agente_with_viajeros_details = async (req, res) => {
  const {id} = req.query;
  try {
    const result = await executeSP("sp_get_agente_with_viajeros_details", [id]);
    if(!result || result.length === 0) {
      return res.status(404).json({ message: "No se encontró el agente o los detalles de los viajeros" });
    }else{
      return res.status(200).json({
        message: "Agente y detalles de viajeros recuperados correctamente",
        data: result
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Error en el servidor", details: error });
  }
}
module.exports = {
  create,
  read,
  readAgentesCompanies,
  readEmpresasDatosFiscales,getAgenteId,
  readAgentes,
  get_agente_with_viajeros_details
}