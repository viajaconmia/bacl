const { executeSP, executeQuery } = require("../../../config/db");
const { CustomError } = require("../../../middleware/errorHandler");
const { v4: uuidv4 } = require("uuid");
const { API_STRIPE_TEST } = require("../../../config/auth");
const stripeTest = require("stripe")(API_STRIPE_TEST);
const { createClient } = require("@supabase/supabase-js");
const { STORED_PROCEDURE } = require("../../../lib/constant/stored_procedures");

const supabase_url = process.env.SUPABASE_URL;
const supabase_service_role = process.env.SERVICE_ROLE_KEY_SPB;
const supabaseAdmin = createClient(supabase_url, supabase_service_role);

const verificarRegistroUsuario = async (req, res) => {
  try {
    const { email } = req.query;

    const response = await executeSP(
      STORED_PROCEDURE.GET.OBTENER_AGENTE_POR_CORREO,
      ["", email]
    );
    const usuario = response[0];
    if (!usuario) {
      return res
        .status(200)
        .json({ message: "usuario no encontrado", data: { registrar: false } });
    }

    const { data, error } = await supabaseAdmin
      .from("user_info")
      .select("id_viajero")
      .eq("id_viajero", usuario.id_viajero)
      .maybeSingle();

    if (error) {
      throw new CustomError(
        error.message || "Error en el mensaje",
        error.status || 500,
        "ERROR_SUPABASE",
        error
      );
    }
    if (!data) {
      return res.status(200).json({
        message: "usuario existe pero no en supabase",
        data: { registrar: true, usuario },
      });
    }
    return res
      .status(200)
      .json({ message: "usuario encontrado", data: { registrar: false } });
  } catch (error) {
    console.log(error);
    return res.status(error.status || 500).json({
      message:
        error.message || "Error desconocido en verificar registro del usuario",
      error,
      data: null,
    });
  }
};

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
      data: { id_viajero },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error,
      message: error.message,
      data: null,
    });
  }
};

const newViajeroWithRol = async (req, res) => {
  try {
    const { correo, password, id_viajero, id_agente, rol } = req.body;

    if (!correo || !password || !id_viajero)
      throw new CustomError(
        "Faltan parametros",
        400,
        "MISSING_PARAMETERS",
        Object.entries(req.body).filter(([, value]) => !!value)
      );
    // //Extraer el id del viajero y tambien el correo, debemos extraer por correos y si hay un numero mayor a 1 decimos que ya existe una cuenta con ese correo,
    // //Debemos verificar que el id del viajero tenga el correo que se nos mando
    const viajeros_registrados = await executeQuery(
      `select * from viajeros where LOWER(correo) = LOWER(?) AND is_user = true;`,
      [correo]
    );

    console.log(viajeros_registrados);

    if (viajeros_registrados.length > 0)
      throw new CustomError(
        "Ya existe un usuario con ese correo",
        403,
        "AUTH_ERROR",
        { correo }
      );

    const viajeros = await executeQuery(
      `select * from viajeros where id_viajero = ?;`,
      [id_viajero]
    );

    if (viajeros.length < 1)
      throw new CustomError("No encontramos el viajero", 400, "AUTH_ERROR", {
        id_viajero,
      });
    const viajero = viajeros[0];

    const nombreCompleto = [
      viajero.primer_nombre,
      viajero.segundo_nombre,
      viajero.apellido_paterno,
      viajero.apellido_materno,
    ]
      .filter(Boolean)
      .join(" ");

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: correo,
      password: password,
      email_confirm: true,
    });

    if (error) {
      throw new CustomError(
        error.message || "Error al registrar el usuario",
        error.status || 500,
        error.code,
        error
      );
    }

    // Actualizar metadata con nombre y teléfono
    await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
      user_metadata: {
        full_name: nombreCompleto,
        display_name: nombreCompleto, // <- Este es el que aparece en Supabase UI
        phone: viajero.telefono,
      },
    });

    //Agregar su info y su rol
    await supabaseAdmin.from("user_info").insert({
      id_user: data.user.id,
      id_viajero: viajero.id_viajero,
      id_agente,
      rol,
    });

    await executeQuery(
      `UPDATE viajeros SET is_user = true where id_viajero = ?;`,
      [id_viajero]
    );

    res.status(201).json({
      message: "Usuario creado con exito",
      data: { correo, viajeros_registrados, data, viajeros },
    });
  } catch (error) {
    console.log("Este es el error qiuien c", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.details,
      message: error.message,
      data: null,
    });
  }
};

module.exports = {
  newCreateAgente,
  verificarRegistroUsuario,
  newViajeroWithRol,
};
