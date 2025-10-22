const { runTransaction } = require("../../config/db");
const MODEL = require("../model/db.model");

const editarVuelo = async (req, res) => {
  try {
    // const { cambios, before, viaje_aereo } = req.body;

    // const formaters = formateoViajeAereo(
    //   req.body.faltante,
    //   req.body.current,
    //   req.body.saldos,
    //   req.body.current.vuelos,
    //   viaje_aereo
    // );

    // if (cambios.keys.length == 0) throw new Error(ERROR.CHANGES.EMPTY);

    // let diferencia;
    // if (cambios.keys.includes("precio")) {
    //   let cambio =
    //     cambios.logs.precio.current - Number(cambios.logs.precio.before);
    //   diferencia = cambio != 0 ? cambio : undefined;
    // }
    /**VALIDAR SALDOS */
    /**VALIDAR QUE TENGA CREDITO */
    /**HACER EL COBRO O RETORNO DE DINERO - tomar en cuenta que puede ser regresando un wallet no facurabe y ya, o tambien por credito*/
    /**UPDATEAR LAS COSAS DEL VIAJE Y LOS PRECIOS SI SE EDITARON */

    /*** Si se edita el precio ->
     * - Se actualiza el servicio (agregando solo el nuevo precio, ya sea negativo o positivo)*
     * - Se actualiza el booking (Este entra con el nuevo precio)                             *
     * - Se actualiza el item (Con el nuevo precio)                                           *
     * - Se actualiza el viaje aereo (Con el nuevo precio)                                    *
     * - Se manejan los pagos (credito, wallet, pago directo, pagos_credito, items_pagos)
     * - El que se revisa es lo de facturas y asi
     * */

    /*** Si se edita el costo ->
     * - Se edita el item                                                                         *
     * - Se edita el viaje aereo                                                                  *
     * */

    /*** Si se editan vuelos
     * - Se eliminan  todos los vuelos                                                            *
     * - Se agregan los nuevos vuelos                                                             *
     * - Se edita el viaje aereo                                                                  *
     * - Se edita tambien el booking por el checkin y eso                                         *
     * */

    /*** Si se edita el codigo
     * - Se edita el viaje aereo                                                                  *
     * */

    /*** Si se edita el status
     * - Se debe verificar y en caso de que este cancelada:
     * - Se debe regresar el credito que no esta pagado, y se debe regresar los saldos que fueron pagados,
     * - Se debe cancelar la reserva, cambiando el status en bookings (Verificar como esta escrito y el enum)         *
     * */
    // const [servicio] = await executeQuery(
    //   `SELECT * FROM servicios where id_servicio = ?`,
    //   [viaje_aereo.id_servicio]
    // );

    // const [viaje] = await executeQuery(
    //   `SELECT * FROM viajes_aereos WHERE id_viaje_aereo = ?`,
    //   [viaje_aereo.id_viaje_aereo]
    // );

    // const BEFORE = {
    //   servicio,
    //   viaje_aereo: viaje,
    // };

    await runTransaction(async (connection) => {
      try {
        const pago = { id_pago: "pag-071304cb-df06-41f8-8911-6cd476bc2281" };
        const response = await MODEL.SALDO.return_wallet(
          connection,
          pago.id_pago,
          1000
        );
        console.log(response);
        // const updateService = Calculo.cleanEmpty({
        //   total: diferencia
        //     ? Number(BEFORE.servicio.total) + diferencia
        //     : undefined,
        // });
        // await Servicio.update(connection, {
        //   ...updateService,
        //   id_servicio: BEFORE.viaje_aereo.id_servicio,
        // });

        // const updateViajeAereo = Calculo.cleanEmpty({
        //   total: diferencia
        //     ? Number(BEFORE.viaje_aereo.total) + diferencia
        //     : undefined,
        // });
        // await ViajeAereo.update(connection, {
        //   ...updateViajeAereo,
        //   id_viaje_aereo: BEFORE.viaje_aereo.id_viaje_aereo,
        // });

        // console.log(diferencia, updateService);
        // throw new Error("por si acaso");
      } catch (error) {
        throw error;
      }
    });

    res.status(200).json({
      message: "Reservación creada con exito",
      data: [],
    });
  } catch (error) {
    console.log("this is the message", error.message);
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};
module.exports = { editarVuelo };
