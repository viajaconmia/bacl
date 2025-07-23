const { executeSP, executeQuery } = require("../../../config/db");
const { CustomError } = require("../../../middleware/errorHandler");
const { v4: uuidv4 } = require("uuid");
const { API_STRIPE_TEST } = require("../../../config/auth");
const stripeTest = require("stripe")(API_STRIPE_TEST);

const newCreateAgente = async (req, res) => {
  const { body } = req;

  const id_empresa = `emp-${uuidv4()}`;
  const id_viajero = `${uuidv4()}`;
  let stripe_client;

  try {
    try {
      stripe_client = await stripeTest.customers.create({ email: body.correo });
    } catch (error) {
      console.log("\n\n\n\n\n", error);
      throw new CustomError(
        "Ocurrio un error con stripe",
        500,
        "STRIPE_ERROR",
        { ...error, message: error.message }
      );
    }
    //Ahora si el try-catch para el resto del flujo
    const newAgente = await executeSP("sp_crear_agente", [
      stripe_client.id,
      body.id_agente,
      id_empresa,
      id_viajero,
      body.nombre_completo, //body.nombre_completo
      body.primer_nombre,
      body.segundo_nombre || null,
      body.apellido_paterno || null,
      body.apellido_materno || null,
      body.correo,
      body.telefono || null,
      body.genero || null,
      body.fecha_nacimiento || null,
      body.nombre_completo, //Razon social
      body.nombre_completo, //nombre_comercial
      "fisica", //tipo persona
      body.calle || null,
      body.colonia || null,
      body.estado || null,
      body.municipio || null,
      body.codigo_postal || null,
      body.nacionalidad || null,
      body.numero_pasaporte || null,
      body.numero_empleado || null,
    ]);
    await executeQuery(`UPDATE otp_storage SET verify = ? WHERE email = ?`, [
      true,
      body.correo,
    ]);
    return res.status(201).json({
      message: "Agente creado correctamente",
      data: newAgente,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error,
      message: error.message,
      data: null,
    });
  }
};

module.exports = { newCreateAgente };
