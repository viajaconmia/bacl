const { executeQuery, runTransaction } = require("../../../config/db");
const { calcularNoches } = require("../../../lib/utils/calculates");
const { CustomError } = require("../../../middleware/errorHandler");
const db = require("../../../v2/model/db.model");

/****************+ GET ********************* */
const getCartItemsById = async (req, res) => {
  try {
    const { id_agente, id_viajero, usuario_creador } = req.query;
    if (!id_agente && !id_viajero)
      throw new CustomError(
        "Faltan el id del usuario",
        400,
        "MISING_DATA",
        null
      );

    const cartItemsSolicitudes = await executeQuery(
      `select 
  c.*, 
  s.id_servicio, 
  s.id_viajero,
  s.data_gemini as data,
  CONCAT_WS(' ', v.primer_nombre, v.segundo_nombre, v.apellido_paterno, v.apellido_materno) AS viajero_principal,
  s.hotel, 
  s.check_in, 
  s.check_out, 
  s.room,
  s.id_hotel,
  s.id_acompanantes 
  from cart c 
left join solicitudes s on s.id_solicitud = c.id_solicitud
left join viajeros v on s.id_viajero = v.id_viajero
where (c.id_agente = ? OR c.usuario_generador = ?) AND c.active = 1 ${
        usuario_creador ? "AND s.usuario_creador = ?" : ""
      };`,
      usuario_creador
        ? [id_agente || "", id_viajero || "", usuario_creador || ""]
        : [id_agente || "", id_viajero || ""]
    );

    const carItems = cartItemsSolicitudes.map(
      ({ id, total, type, selected, ...item }) => ({
        id,
        total: Number(total),
        type,
        selected: Boolean(selected),
        details: {
          ...(item || {}),
          noches: item ? calcularNoches(item.check_in, item.check_out) : 0,
          usuario_creador: item ? item.usuario_generador : "",
        },
      })
    );

    res.status(200).json({
      message: "Obtenidos con exito",
      data: carItems,
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

/****************+ DELETE ********************* */
const deleteCartItem = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id)
      throw new CustomError(
        "Falta el id del item del carrito",
        400,
        "MISSING_ITEM_ID",
        null
      );
    await executeQuery(`update cart set active = 0 where id = ?;`, [id]);

    res.status(204).json({
      message: "Item eliminado con exito",
      data: null,
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

/****************+ POST ********************* */
const createCartItem = async (req, res) => {
  try {
    const {
      id_solicitud,
      id_agente,
      usuario_generador,
      total,
      type,
      selected,
    } = req.body;
    if (
      !id_solicitud ||
      !id_agente ||
      !usuario_generador ||
      !total ||
      !type ||
      selected === undefined
    )
      throw new CustomError(
        "Faltan datos necesarios para crear el item del carrito",
        400,
        "MISSING_DATA",
        null
      );

    const result = await executeQuery(
      `INSERT INTO cart (
    total,
    id_agente,
    type,
    selected,
    id_solicitud,
    usuario_generador
) VALUES ( ?, ?, ?, ?, ?, ?); `,
      [
        total,
        id_agente,
        type,
        /*selected*/ true,
        id_solicitud,
        usuario_generador,
      ]
    );

    res.status(201).json({
      message: "Item creado con exito",
      data: result,
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

/****************+ PATCH ********************* */
const setSelectedCartItem = async (req, res) => {
  try {
    const { id, selected } = req.body;
    if (!id || selected === undefined)
      throw new CustomError(
        "Falta el id del item del carrito",
        400,
        "MISSING_ITEM_ID",
        null
      );
    await executeQuery(`update cart set selected = ? where id = ?;`, [
      selected,
      id,
    ]);

    res.status(204).json({
      message: "Item actualizado con exito",
      data: null,
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

const procesarServicio = async (req, res) => {
  try {
    const { usuario_generador, id_agente } = req.body;
    if (!usuario_generador || !id_agente)
      throw new CustomError(
        "No encontrado el agente",
        400,
        "MISSING_ITEM_ID",
        null
      );

    const data = await executeQuery(
      `SELECT * FROM cart WHERE usuario_generador = ? and active = 1`,
      [usuario_generador]
    );

    const total = data.reduce((acc, curr) => acc + Number(curr.total), 0);

    await runTransaction(async (conn) => {
      try {
        const [servicio] = await db.SERVICIO.create(conn, {
          total,
          is_cotizacion: true,
          id_agente,
        });

        const ids_solicitudes = data.map((cart) => cart.id_solicitud);
        const solicitudes = await db.SOLICITUDES.get(...ids_solicitudes);

        Promise.all(
          solicitudes.map(
            async (solicitud) =>
              await db.SOLICITUDES.update(conn, {
                id_servicio: servicio.id_servicio,
                id_solicitud: solicitud.id_solicitud,
              })
          )
        );

        const query = `UPDATE cart SET active = ? WHERE id = ?`;
        Promise.all(
          data.map(async (cart) => await conn.execute(query, [false, cart.id]))
        );
      } catch (error) {
        console.error(error);
        throw error;
      }
    });

    res.status(200).json({
      message: "Item actualizado con exito",
      data,
    });
  } catch (error) {
    console.log(error.message);
    return res.status(error.statusCode || 500).json({
      error: error.details,
      message: error.message,
      data: null,
    });
  }
};

module.exports = {
  getCartItemsById,
  deleteCartItem,
  setSelectedCartItem,
  createCartItem,
  procesarServicio,
};
