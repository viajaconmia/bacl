const { executeQuery } = require("../../../config/db");
const { calcularNoches } = require("../../../lib/utils/calculates");
const { CustomError } = require("../../../middleware/errorHandler");

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
          ...item,
          noches: calcularNoches(item.check_in, item.check_out),
          usuario_creador: item.usuario_generador,
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

module.exports = {
  getCartItemsById,
  deleteCartItem,
  setSelectedCartItem,
  createCartItem,
};
