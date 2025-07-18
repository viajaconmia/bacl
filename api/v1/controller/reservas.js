const model = require("../model/reservas");
const {executeQuery, executeSP} = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");

const create = async (req, res) => {
  //revisemos el body
  console.log(req.body);

  const { reserva } = req.body;
  const { estado_reserva, solicitud } = reserva;
  if (estado_reserva === "Cancelada")
    //SI AL PROCESAR LA SOLICITUD SE SETEA COMO CANCELADA, SE CANCELA LA SOLICITUD Y NO SE CREA LA RESERVA
    {
    try {
      await executeQuery(
        `UPDATE solicitudes 
           SET status = 'Canceled' 
         WHERE id_solicitud = ?`,
        [solicitud.id_solicitud]
      );
      return res
        .status(200)
        .json({ message: "Solicitud cancelada correctamente" });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ error: "Error interno al cancelar solicitud", details: error.message });
    }
  }
  try {
       let response = await model.insertarReserva(req.body);
    res
      .status(201)
      .json({ message: "Solicitud created successfully", data: response });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};


// const updateReserva = async (req, res) => {
//   try {
//     let response = await model.editarReserva(req.body, req.query.id);
//     res
//       .status(201)
//       .json({ message: "Solicitud created successfully", data: response });
//   } catch (error) {
//     console.error(error);
//     res
//       .status(500)
//       .json({ error: "Internal Server Error", details: error.message });
//   }
// };

const updateReserva2 = async (req, res) => {
  console.log("Llegando al endpoint de updateReserva2");
  const { id} = req.query;
  const {
    viajero,
    check_in,
    check_out,
    venta,
    estado_reserva,
    proveedor,
    hotel,
    codigo_reservacion_hotel,
    habitacion,
    noches,
    comments,
    items,
    impuestos
  } = req.body;
console.log(id)
  try {
    // 1) Generar id_item para cada ítem nuevo
    const itemsConIds = (items?.current || []).map(item => ({
      ...item,
      id_item: item.id_item || `ite-${uuidv4()}`
    }));

    // 2) Serializar JSON
    const itemsJson     = JSON.stringify(itemsConIds);
    const impuestosJson = JSON.stringify(impuestos?.current || []);

    // 3) Construir array de 19 parámetros para el SP
    const params = [
      id,                                   // 1) p_id_booking
      viajero?.current?.id_viajero    ?? null,      // 2) p_id_viajero
      check_in?.current               ?? null,      // 3) p_check_in
      check_out?.current              ?? null,      // 4) p_check_out
      venta?.current?.total           ?? null,      // 5) p_total
      venta?.current?.subtotal        ?? null,      // 6) p_subtotal
      venta?.current?.impuestos       ?? null,      // 7) p_impuestos
      estado_reserva?.current         ?? null,      // 8) p_estado_reserva
      proveedor?.current?.total       ?? null,      // 9) p_costo_total
      proveedor?.current?.subtotal    ?? null,      // 10) p_costo_subtotal
      proveedor?.current?.impuestos   ?? null,      // 11) p_costo_impuestos
      hotel?.current?.content?.nombre_hotel ?? null,// 12) p_nombre_hotel
      hotel?.current?.content?.id_hotel     ?? null,// 13) p_id_hotel
      codigo_reservacion_hotel?.current      ?? null,// 14) p_codigo_reservacion_hotel
      habitacion?.current                   ?? null,// 15) p_tipo_cuarto
      noches?.current                       ?? null,// 16) p_noches
      comments?.current                     ?? null,// 17) p_comments
      itemsJson,                                  // 18) p_items_json
      impuestosJson                              // 19) p_impuestos_json
    ];
console.log("por entrar al sp")
    // 4) Llamar al SP
    const result = await executeSP("sp_editar_reserva_procesada", params);

    // 5) Verificar resultado
    // dependiendo de tu helper, puede que sea result.affectedRows o result[0].affectedRows
    if (!result || result.length === 0) {
      return res.status(404).json({ message: "No se encontró la reserva" });
    }

    // 6) Responder con los nuevos IDs de items
    return res.status(200).json({
      message: "Reserva actualizada correctamente",
      data: {
        id_booking: id,
        items: itemsConIds,
        impuestos: impuestos?.current || [],
        rawResult: result
      }
    });
  } catch (error) {
    console.error("Error en updateReserva2:", error);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};





const createFromOperaciones = async (req, res) => {
  try {
    let response = await model.insertarReservaOperaciones(req.body);
    res
      .status(201)
      .json({ message: "Solicitud created successfully", data: response });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const read = async (req, res) => {
  try {
    let response = await model.getReserva();
    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};
const readById = async (req, res) => {
  try {
    let response = await model.getReservaById(req.query.id);
    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};
const readOnlyById = async (req, res) => {
  try {
    let response = await model.getOnlyReservaByID(req.query.id);
    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};
const readAll = async (req, res) => {
  try {
    let response = await model.getReservaAll();
    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

const readAllFacturacion = async (req, res) => {
  try {
    let response = await model.getReservaAllFacturacion();
    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

module.exports = {
  create,
  read,
  readById,
  readAll,
  createFromOperaciones,
  readOnlyById,
  //updateReserva,
  readAllFacturacion,
  updateReserva2
};
