const { executeQuery, runTransaction } = require("../../../config/db");
const { CustomError } = require("../../../middleware/errorHandler");
const { v4: uuidv4 } = require("uuid");
const model = require("../model/credito");

const create = async (req, res) => {
  try {
    const response = await model.createAgenteCredito(req.body);
    res
      .status(201)
      .json({ message: "Credito credito para el agente", data: response });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const read = async (req, res) => {
  try {
    const { id_agente } = req.query;
    const datosCredito = await model.readAgenteCredito(id_agente);
    res.status(200).json(datosCredito);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};

const actualizarPrecioCredito = async (req, res) => {
  try {
    /*
     * Datos a recibir:
     * - diferencia : number, sirve para manejar los creditos y el valor de los items a la hora de actualizarlos
     * - monto actualizado : para meterlo de lleno al credito y la reserva
     * - id_credito: para extraer la información
     * - id_agente: para validaciones de credito
     */

    const {
      id_agente,
      diferencia,
      id_servicio,
      hotel,
      id_hospedaje,
      id_booking,
      precio_actualizado,
    } = req.body;
    if (
      !id_agente ||
      !diferencia ||
      !id_servicio ||
      !hotel ||
      !id_hospedaje ||
      !id_booking ||
      !precio_actualizado
    ) {
      throw new CustomError(
        "Parece que faltan datos o hay datos nulos",
        400,
        "ERROR_FRONT",
        Object.entries({
          id_agente,
          diferencia,
          id_servicio,
          hotel,
          id_hospedaje,
          id_booking,
          precio_actualizado,
        }).filter(([_, value]) => !value)
      );
    }

    /* 0.- Verificamos que el cliente tenga saldo:
     *  validaciones:
     *    - Que tenga saldo y que este activo
     */

    const agentes_encontrados = await executeQuery(
      "select * from agente_details where id_agente = ?;",
      [id_agente]
    );
    if (agentes_encontrados.length == 0)
      throw new CustomError(
        `Parece que no encontramos el agente con el id ${id_agente}`,
        404,
        "ERROR_CLIENT",
        id_agente
      );
    const agente = agentes_encontrados[0];

    /* 1.- Creamos el pago a credito
     *  validaciones:
     *    - Que tenga credito y creamos el pago a credito
     */
    // console.log(agente, diferencia, Number(agente.saldo) < diferencia, );
    if (!Boolean(agente.tiene_credito_consolidado)) {
      throw new CustomError(
        `El cliente tiene desactivado el credito`,
        402,
        "PAYMENT_REFUSED",
        null
      );
    }
    if (Number(agente.saldo) < diferencia) {
      throw new CustomError(
        `El cliente no cuenta con saldo suficiente`,
        402,
        "PAYMENT_REFUSED",
        null
      );
    }

    const query_agregar_pago_credito = `
      INSERT INTO pagos_credito (
        id_credito,
        id_servicio,
        monto_a_credito,
        responsable_pago_empresa,
        responsable_pago_agente,
        fecha_creacion,
        pago_por_credito,
        pendiente_por_cobrar,
        total,
        subtotal,
        impuestos,
        concepto,
        referencia,
        currency,
        tipo_de_pago
      ) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

    const id_credito = `cre-${uuidv4()}`;

    const parametros = [
      id_credito, //id_credito,
      id_servicio, //id_servicio,
      diferencia, //monto_a_credito,
      null, //responsable_pago_empresa,
      id_agente, //responsable_pago_agente,
      diferencia, //pago_por_credito,
      diferencia, //pendiente_por_cobrar,
      diferencia, //total,
      (diferencia / 1.16).toFixed(2), //subtotal,
      (diferencia - diferencia / 1.16).toFixed(2), //impuestos,
      `SE PROCESO UN AJUSTE DE PRECIO DE VENTA EN RESERVA DEL HOTEL: ${hotel}`, //concepto,
      null, //referencia,
      "mxn", //currency,
      "credito", //tipo_de_pago,
    ];
    await runTransaction(async (connection) => {
      try {
        await connection.execute(query_agregar_pago_credito, parametros);
        await connection.execute(
          `UPDATE agentes SET saldo = ? where id_agente = ?`,
          [Number(agente.saldo) - diferencia, agente.id_agente]
        );

        /* 3.- Editar los precios de la reserva y los items
         *  validaciones:
         *    - se deben manejar bien los precios de los items para que no queden con 0 de precio, igual se debera manejar el saldo de los items
         *  cambios:
         *    - Cambiaremos los precios de servicios, le restaremos lo del pago anterior y le agregaremos lo del nuevo monto y vamos a hacer el conteo de
         *      nuevo de los impuestos
         *    - Igual se haran los cambios en bookings, pero aqui si ya es directo el cambio, los impuestos igual se deben verificar
         *    - Manejaremos el precio de los items, validamos que existan items, y al primer item le vamos a agregar la diferencia y manejamos sus
         *      impuestos y los subimos
         *    -Igual debemos editar el credito del cliente*/

        /* ITEMS */
        const [items] = await connection.execute(
          `SELECT * FROM items WHERE id_hospedaje = ?`,
          [id_hospedaje]
        );

        if (items.length == 0)
          throw new Error(
            `No hay items, muestra a sistemas este mensaje y el id hospedaje siguiente: ${id_hospedaje}`
          );
        let update_precio = precio_actualizado;

        let nuevo_monto_item = Number(
          (update_precio / items.length).toFixed(2)
        );

        const newItems = items.map((item, index) => {
          if (index == items.length - 1) {
            return {
              ...item,
              saldo: Number(item.saldo) + diferencia,
              total: update_precio.toFixed(2),
              subtotal: (update_precio / 1.16).toFixed(2),
              impuestos: (update_precio - update_precio / 1.16).toFixed(2),
            };
          }
          update_precio -= nuevo_monto_item;
          const subtotal = (nuevo_monto_item / 1.16).toFixed(2);
          const impuestos = (
            nuevo_monto_item -
            nuevo_monto_item / 1.16
          ).toFixed(2);

          return {
            ...item,
            total: nuevo_monto_item.toFixed(2),
            subtotal,
            impuestos,
          };
        });

        const query_item_agregar_credito = `
          UPDATE items
            SET
            saldo = ?,
            total = ?,
            subtotal = ?,
            impuestos = ?
          WHERE id_item = ?`;

        await Promise.all(
          newItems.map((item) =>
            connection.execute(query_item_agregar_credito, [
              item.saldo,
              item.total,
              item.subtotal,
              item.impuestos,
              item.id_item,
            ])
          )
        );

        /* SERVICIO */

        const [[servicio]] = await connection.execute(
          `SELECT * FROM servicios WHERE id_servicio = ?`,
          [id_servicio]
        );
        if (!servicio)
          throw new Error(
            `No existe el servicio, muestra a sistemas el siguiente mensaje y ID: ${id_servicio}`
          );

        const query_servicio_to_update = `
          UPDATE servicios
            SET
              total = ?,
              subtotal = ?,
              impuestos = ?
          WHERE id_servicio = ?`;
        const nuevo_total_servicio = Number(servicio.total) + diferencia;
        const parametros_servicio = [
          nuevo_total_servicio,
          nuevo_total_servicio / 1.16,
          nuevo_total_servicio - nuevo_total_servicio / 1.16,
          id_servicio,
        ];

        await connection.execute(query_servicio_to_update, parametros_servicio);

        const [[booking]] = await connection.execute(
          `SELECT * FROM bookings WHERE id_booking = ?`,
          [id_booking]
        );
        if (!booking)
          throw new Error(
            `No existe el booking, muestra a sistemas el siguiente mensaje y ID: ${id_booking}`
          );

        const query_booking_to_update = `
          UPDATE bookings
            SET
              total = ?,
              subtotal = ?,
              impuestos = ?
          WHERE id_booking = ?`;
        const nuevo_total_booking = Number(servicio.total) + diferencia;
        const parametros_booking = [
          nuevo_total_booking,
          nuevo_total_booking / 1.16,
          nuevo_total_booking - nuevo_total_booking / 1.16,
          id_booking,
        ];

        await connection.execute(query_booking_to_update, parametros_booking);
      } catch (error) {
        throw error;
      }
    });

    res.status(200).json({
      message:
        "Se ha procesado con exito la actualización del credito del cliente",
      data: { resultados: agente },
    });
  } catch (error) {
    console.log(error);
    res.status(error.statusCode || 500).json({
      message:
        error.message || "Error desconocido al actualizar precio de credito",
      error: error || "ERROR_BACK",
      data: null,
    });
  }
};

const handlerPagoCreditoRegresarSaldo = async (req, res) => {
  try {
    let {
      id_agente,
      id_servicio,
      id_hospedaje,
      id_booking,
      diferencia,
      precio_actualizado,
    } = req.body;
    if (
      !id_agente ||
      !precio_actualizado ||
      !id_servicio ||
      !id_booking ||
      !id_hospedaje ||
      !diferencia
    ) {
      throw new CustomError(
        "Parece que faltan datos o hay datos nulos",
        400,
        "ERROR_FRONT",
        Object.entries({
          id_agente,
          id_servicio,
          precio_actualizado,
          diferencia,
          id_booking,
          id_hospedaje,
        }).filter(([_, value]) => !value)
      );
    }
    /* PASAMOS LA DIFERENCIA A POSITIVO*/
    diferencia = diferencia * -1;
    /* 0.- OBTENEMOS AL AGENTE
     *  validaciones:
     *    - Que exista */

    const agentes_encontrados = await executeQuery(
      "select * from agente_details where id_agente = ?;",
      [id_agente]
    );
    if (agentes_encontrados.length == 0)
      throw new CustomError(
        `Parece que no encontramos el agente con el id ${id_agente}`,
        404,
        "ERROR_CLIENT",
        id_agente
      );
    const agente = agentes_encontrados[0];

    /* 1.- OBTENEMOS SERVICIO Y EXTRAEMOS LOS PAGOS DE CREDITO
     *  validaciones:
     *    - Que exista servicio y pagos a credito
     */
    const servicios = await executeQuery(
      `SELECT * FROM servicios WHERE id_servicio = ?`,
      [id_servicio]
    );
    if (servicios.length == 0)
      throw new CustomError(
        `Parece que no encontramos algun servicio con el id ${id_servicio}`,
        404,
        "ERROR_NOT_FOUND",
        id_servicio
      );
    const servicio = servicios[0];
    const creditos = await executeQuery(
      `SELECT * FROM pagos_credito where id_servicio = ?;`,
      [id_servicio]
    );
    if (creditos.length == 0)
      throw new CustomError(
        `Parece que no encontramos algun credito con el id ${id_servicio}`,
        404,
        "ERROR_NOT_FOUND",
        id_servicio
      );

    /* OBTENEMOS LOS PAGOS DE CREDITO Y AGARRAMOS EL QUE TENGA LA DIFERENCIA Y SI NO CREAMOS UN ALGORITMO DE FORMA QUE SEPAMOS COMO SEPARAR LA DIFERENCIA, QUE SERIA COMO LOS ITEMS, VAMOS RESTANDO LO QUE LE DAMOS HASTA QUE QUEDE EN 0,
     * VERIFICAMOS SI EL VALOR DE LA DIFERENCIA ES MAYOR A LO PAGADO A CREDITO
     * SI ES MAYOR ENTONCES EL VALOR DE CREDITO LO DEJAMOS A 1 PESO Y ELIMINAMOS DE LA DIFERENCIA EL VALOR QUE RESTAMOS A CREDITO
     * SI EL VALOR DE LA DIFERENCIA ES MAYOR Y EL DEL CREDITO ES EL MENOR Y YA NO HAY CREDITOS ENTONCES LANZAMOS UNA VALIDACION DE QUE LA DIFERENCIA ES MAYOR AL SALDO PAGADO POR LA RESERVA
     * SI NO ES MAYOR ENTONCES SE RESTA EL VALOR DE LA DIFERENCIA AL CREDITO
     * GUARDAMOS ESE CREDITO ACTUALIZADO EN UN ARRAY
     *
     * EL ARRAY LO CORREMOS CON EL UPDATE
     *
     * ACTULIZAMOS EL SALDO DEL CLIENTE REGRESANDOLE EL SALDO */

    if (
      creditos.reduce(
        (prev, curr) => prev + Number(curr.pendiente_por_cobrar),
        0
      ) < diferencia
    )
      throw new CustomError(
        `Parece que se ha pagado mas de lo que se desea actualizar, el procedimiento no puede ser realizado, pedir a sistemas arreglar esto, no creo que se necesite para version 1 y asi tambien puedo sacar las cosas mas rapido, pero para cuando lleguemos se debera hacer este cambio`,
        400,
        "ERROR_NOT_FOUND",
        null
      );

    let update_precio = diferencia;
    let update_pagado = diferencia;
    const creditosUpdated = creditos.map((credito) => {
      if (Number(credito.total) <= 1 || update_precio == 0) return credito;
      if (update_precio > Number(credito.total)) {
        update_precio = update_precio - Number(credito.total) + 1;
        return {
          ...credito,
          total: 1,
          subtotal: (1 / 1.16).toFixed(2),
          impuestos: (1 - 1 / 1.16).toFixed(2),
          monto_a_credito: "1",
          pago_por_credito: "1",
        };
      }
      let newTotal = Number(credito.total) - update_precio;
      let creditoUpdated = {
        ...credito,
        total: (Number(credito.total) - update_precio).toFixed(2),
        subtotal: (newTotal / 1.16).toFixed(2),
        impuestos: (newTotal - newTotal / 1.16).toFixed(2),
        monto_a_credito: newTotal.toFixed(2),
        pago_por_credito: newTotal.toFixed(2),
      };
      update_precio = 0;
      return creditoUpdated;
    });
    const pagadoUpdated = creditosUpdated.map((credito) => {
      if (Number(credito.pendiente_por_cobrar) == 0 || update_pagado == 0)
        return credito;
      if (update_pagado > Number(credito.pendiente_por_cobrar)) {
        update_pagado = update_pagado - Number(credito.pendiente_por_cobrar);
        return {
          ...credito,
          pendiente_por_cobrar: 0,
        };
      }
      let creditoUpdated = {
        ...credito,
        pendiente_por_cobrar: (
          Number(credito.pendiente_por_cobrar) - update_pagado
        ).toFixed(2),
      };
      update_pagado = 0;
      return creditoUpdated;
    });
    let cambios = obtenerCambios(creditos, pagadoUpdated);
    let filterPagados = pagadoUpdated.filter((item) =>
      cambios.some((element) => element == item.id_credito)
    );

    await runTransaction(async (connection) => {
      try {
        //Regresar credito al agente
        await connection.execute(
          `UPDATE agentes SET saldo = ? where id_agente = ?`,
          [Number(agente.saldo) + diferencia, agente.id_agente]
        );

        //Actualizar precio servicio
        const query_servicio_to_update = `
              UPDATE servicios
                SET
                  total = ?,
                  subtotal = ?,
                  impuestos = ?
              WHERE id_servicio = ?`;
        const nuevo_total_servicio = Number(servicio.total) - diferencia;
        const parametros_servicio = [
          nuevo_total_servicio,
          nuevo_total_servicio / 1.16,
          nuevo_total_servicio - nuevo_total_servicio / 1.16,
          servicio.id_servicio,
        ];
        await connection.execute(query_servicio_to_update, parametros_servicio);

        //Actualizar precio booking
        const [[booking]] = await connection.execute(
          `SELECT * FROM bookings WHERE id_booking = ?`,
          [id_booking]
        );
        if (!booking)
          throw new Error(
            `No existe el booking, muestra a sistemas el siguiente mensaje y ID: ${id_booking}`
          );
        const query_booking_to_update = `
          UPDATE bookings
          SET
          total = ?,
          subtotal = ?,
          impuestos = ?
          WHERE id_booking = ?`;
        const nuevo_total_booking = Number(booking.total) - diferencia;
        console.log(booking);
        console.log(nuevo_total_booking);
        const parametros_booking = [
          nuevo_total_booking,
          nuevo_total_booking / 1.16,
          nuevo_total_booking - nuevo_total_booking / 1.16,
          id_booking,
        ];

        await connection.execute(query_booking_to_update, parametros_booking);
        //Actualizar precio items
        const [items] = await connection.execute(
          `SELECT * FROM items WHERE id_hospedaje = ?`,
          [id_hospedaje]
        );

        if (items.length == 0)
          throw new Error(
            `No hay items, muestra a sistemas este mensaje y el id hospedaje siguiente: ${id_hospedaje}`
          );
        let update_precio = precio_actualizado;

        let nuevo_monto_item = Number(
          (update_precio / items.length).toFixed(2)
        );

        const newItems = items.map((item, index) => {
          if (index == items.length - 1) {
            return {
              ...item,
              saldo: Number(item.saldo),
              total: update_precio.toFixed(2),
              subtotal: (update_precio / 1.16).toFixed(2),
              impuestos: (update_precio - update_precio / 1.16).toFixed(2),
            };
          }
          update_precio -= nuevo_monto_item;
          const subtotal = (nuevo_monto_item / 1.16).toFixed(2);
          const impuestos = (
            nuevo_monto_item -
            nuevo_monto_item / 1.16
          ).toFixed(2);
          return {
            ...item,
            total: nuevo_monto_item.toFixed(2),
            subtotal,
            impuestos,
          };
        });

        let newDiferencia = diferencia;
        const itemsPagados = newItems.map((item) => {
          if (Number(item.saldo) == 0 || newDiferencia == 0) return item;
          if (newDiferencia > Number(item.saldo)) {
            newDiferencia = newDiferencia - Number(item.saldo);
            return {
              ...item,
              saldo: 0,
            };
          }
          let creditoUpdated = {
            ...item,
            saldo: (Number(item.saldo) - newDiferencia).toFixed(2),
          };
          newDiferencia = 0;
          return creditoUpdated;
        });

        const query_item_agregar_credito = `
              UPDATE items
                SET
                saldo = ?,
                total = ?,
                subtotal = ?,
                impuestos = ?
              WHERE id_item = ?`;

        await Promise.all(
          itemsPagados.map((item) =>
            connection.execute(query_item_agregar_credito, [
              item.saldo,
              item.total,
              item.subtotal,
              item.impuestos,
              item.id_item,
            ])
          )
        );

        //Actualizar creditos

        await Promise.all(
          filterPagados.map((credito) =>
            connection.execute(
              `
            UPDATE pagos_credito
              SET
              pendiente_por_cobrar = ?,
              total = ?,
              subtotal = ?,
              impuestos = ? ,
              monto_a_credito = ?,
              pago_por_credito = ?
            WHERE id_credito = ?`,
              [
                credito.pendiente_por_cobrar,
                credito.total,
                credito.subtotal,
                credito.impuestos,
                credito.monto_a_credito,
                credito.pago_por_credito,
                credito.id_credito,
              ]
            )
          )
        );
      } catch (error) {
        throw error;
      }
    });

    res.status(200).json({
      message:
        "Se ha procesado con exito la actualización del credito del cliente",
      data: null,
    });
  } catch (error) {
    console.log(error);
    res.status(error.statusCode || 500).json({
      message:
        error.message || "Error desconocido al actualizar precio de credito",
      error: error || "ERROR_BACK",
      data: null,
    });
  }
};

module.exports = {
  create,
  read,
  actualizarPrecioCredito,
  handlerPagoCreditoRegresarSaldo,
};

function obtenerCambios(original, actualizado, key = "id_credito") {
  const cambios = [];

  const originalMap = new Map(original.map((obj) => [obj[key], obj]));

  for (const nuevoObj of actualizado) {
    const id = nuevoObj[key];
    const originalObj = originalMap.get(id);

    if (!originalObj) continue;

    const tieneCambios = Object.keys(nuevoObj).some((k) => {
      const originalVal = originalObj[k];
      const nuevoVal = nuevoObj[k];

      return originalVal !== nuevoVal;
    });

    if (tieneCambios) {
      cambios.push(id);
    }
  }

  return cambios;
}
