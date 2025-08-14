const { executeQuery } = require("../../../config/db");
const { CustomError } = require("../../../middleware/errorHandler");

/****************+ GET ********************* */
const getCartItemsById = async (req, res) => {
  try {
    const { id_agente, id_viajero } = req.query;
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
  s.hotel, 
  s.check_in, 
  s.check_out, 
  s.room,
  s.id_hotel,
  s.id_acompanantes 
  from cart c 
left join solicitudes s on s.id_solicitud = c.id_solicitud
where (c.id_agente = ? OR c.usuario_generador = ?) AND c.active = 1;`,
      [id_agente || "", id_viajero || ""]
    );

    const carItems = cartItemsSolicitudes.map((item) => ({
      id: item.id,
      total: Number(item.total),
      type: item.type,
      selected: Boolean(item.selected),
      details: {
        hotel: item.hotel,
        id_hotel: item.id_hotel,
        id_agente: item.id_agente,
        check_in: item.check_in,
        check_out: item.check_out,
        room: item.room,
        viajero_principal: item.id_viajero,
        id_acompanantes: item.id_acompanantes,
        noches: 0,
        usuario_creador: item.usuario_generador,
        active: item.active,
        id_servicio: item.id_servicio,
        id_solicitud: item.id_solicitud,
        created_at: item.created_at,
        updated_at: item.updated_at,
      },
    }));

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
      [total, id_agente, type, selected, id_solicitud, usuario_generador]
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

module.exports = {
  getCartItemsById,
  deleteCartItem,
  setSelectedCartItem,
  createCartItem,
};
