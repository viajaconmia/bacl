const { executeSP, executeTransactionSP } = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");
const model = require("../model/agentes");
const { API_STRIPE_TEST } = require("../../../config/auth");
const stripeTest = require("stripe")(API_STRIPE_TEST);

const create = async (req, res) => {
  try {
    const response = await model.createAgente(req.body);

    res
      .status(201)
      .json({ message: "Agente creado correctamente", data: response });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const read = async (req, res) => {
  try {
    const { id_agente } = req.query;
    const agentes = await model.getAgente(id_agente);

    res.status(200).json({ data: agentes });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const readAgentesCompanies = async (req, res) => {
  try {
    const { id_agente } = req.query;
    const agentes = await model.getAgenteEmpresa(id_agente);

    res.status(200).json({ data: agentes });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const readEmpresasDatosFiscales = async (req, res) => {
  try {
    const { id_agente } = req.query;
    const agentes = await model.getEmpresasDatosFiscales(id_agente);

    res.status(200).json({ data: agentes });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

//ya no devuelve solo el id, devuelve mas datos
const getAgenteId = async (req, res) => {
  const { nombre, correo } = req.query;
  const nombre2 = nombre?.trim() || "";
  const correo2 = correo?.trim() || "";
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
      data: agentes,
    });
  } catch (error) {
    console.error("Error al recuperar agentes:", error);
    res.status(500).json({ message: "Problema en el servidor", error });
  }
};

const readAgentes = async (req, res) => {
  try {
    const agentes = await model.getAllAgentes();

    res.status(200).json({ data: agentes });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const get_agente_with_viajeros_details = async (req, res) => {
  const { id } = req.query;
  try {
    const result = await executeSP("sp_get_agente_with_viajeros_details", [id]);
    if (!result || result.length === 0) {
      return res.status(404).json({
        message: "No se encontró el agente o los detalles de los viajeros",
      });
    } else {
      return res.status(200).json({
        message: "Agente y detalles de viajeros recuperados correctamente",
        data: result,
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Error en el servidor", details: error });
  }
};

const newCreateAgente = async (req, res) => {
  req.context.logStep("Iniciando creación de agente");
  const {
    id_agente,
    primer_nombre,
    segundo_nombre,
    apellido_paterno,
    apellido_materno,
    correo,
    telefono,
    genero,
    fecha_nacimiento,
    calle,
    colonia,
    estado,
    municipio,
    codigo_postal,
    nacionalidad,
    numero_pasaporte,
    numero_empleado,
  } = req.body;

  const id_empresa = `emp-${uuidv4()}`;
  const id_viajero = `${uuidv4()}`;
  const nombre = [
    primer_nombre,
    segundo_nombre,
    apellido_paterno,
    apellido_materno,
  ]
    .filter((item) => !!item)
    .join(" ")
    .toUpperCase();

  //ahora si iniciamos el flujo, lo primero es crear el usuario de stripe
  //Si usare un bloque try-catch separado para este primer paso
  let stripe_client;
  try {
    try {
      req.context.logStep("Creando usuario de Stripe");
      stripe_client = await stripeTest.customers.create({ email: correo });
      console.log(stripe_client);
    } catch (error) {
      console.log(error);
      req.context.logStep("Error al crear usuario de Stripe");
      return res.status(500).json({
        message: "Error al crear el usuario de Stripe",
        details: error,
      });
    }
    //Ahora si el try-catch para el resto del flujo
    req.context.logStep("Iniciando creación de agente en la base de datos");
    const newAgente = await executeSP("sp_crear_agente", [
      stripe_client.id,
      id_agente,
      id_empresa,
      id_viajero,
      nombre, //nombre
      primer_nombre,
      segundo_nombre || null,
      apellido_paterno || null,
      apellido_materno || null,
      correo || null,
      telefono || null,
      genero || null,
      fecha_nacimiento || null,
      nombre, //Razon social
      nombre, //nombre_comercial
      "fisica", //tipo persona
      calle || null,
      colonia || null,
      estado || null,
      municipio || null,
      codigo_postal || null,
      nacionalidad || null,
      numero_pasaporte || null,
      numero_empleado || null,
    ]);
    console.log(newAgente);
    // if (!newAgente || (Array.isArray(newAgente) && newAgente.length === 0)) {
    //   req.context.logStep("No se pudo crear el agente");
    //   return res
    //     .status(404)
    //     .json({ message: "No se pudo crear el agente 🤦‍♂️🤦‍♂️" });
    // } else {
    return res.status(201).json({
      message: "Agente creado correctamente",
      data: newAgente,
    });
    // }
  } catch (error) {
    console.error(error);
    req.context.logStep("Error al crear el agente en la base de datos😢😢 ");
    return res
      .status(500)
      .json({ message: "Error al crear el agente", details: error });
  }
};

module.exports = {
  create,
  read,
  readAgentesCompanies,
  readEmpresasDatosFiscales,
  getAgenteId,
  readAgentes,
  get_agente_with_viajeros_details,
  newCreateAgente,
};
