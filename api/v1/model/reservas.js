const { executeQuery, executeTransaction } = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");

const editarReserva = async (edicionData, id_booking_a_editar) => {
  try {
    const query_select_ids = `
        SELECT 
          b.id_solicitud, 
          b.id_servicio, 
          h.id_hospedaje 
        FROM bookings b
        LEFT JOIN hospedajes h ON b.id_booking = h.id_booking
        WHERE b.id_booking = ?;
      `;
    const params_select_ids = [id_booking_a_editar];

    const response = await executeTransaction(
      query_select_ids,
      params_select_ids,
      async (selectResults, connection) => {
        if (!selectResults || selectResults.length === 0) {
          throw new Error(
            `Reserva con ID ${id_booking_a_editar} no encontrada.`
          );
        }
        const {
          id_solicitud: id_solicitud_actual,
          id_servicio: id_servicio_actual,
          id_hospedaje: id_hospedaje_actual,
        } = selectResults[0];

        if (edicionData.viajero) {
          connection.execute(
            "UPDATE viajeros_hospedajes SET id_viajero = ? WHERE id_hospedaje = ? and is_principal = 1;",
            [edicionData.viajero.current.id_viajero, id_hospedaje_actual]
          );
        }

        if (
          edicionData.items &&
          !id_hospedaje_actual &&
          edicionData.items.current?.length > 0
        ) {
          console.error(
            `No se encontró un hospedaje asociado a la reserva ${id_booking_a_editar}. No se pueden procesar los items.`
          );
          throw new Error(
            `No se encontró un hospedaje para la reserva ${id_booking_a_editar} para procesar items.`
          );
        }
        // --- 0. Verificar si es la primera vez que se procesa la solicitud
        // if (id_hospedaje_actual && edicionData.viajero?.current?.id_viajero) {
        //   const query_check_relacion = `
        //     SELECT 1 FROM viajeros_hospedajes
        //     WHERE id_hospedaje = ? LIMIT 1;
        //   `;
        //   const [existeRelacion] = await connection.execute(query_check_relacion, [id_hospedaje_actual]);

        //   if (!existeRelacion || existeRelacion.length === 0) {
        //     //Se inserta en la tabla si no existen registros
        //     const query_insert_relacion = `
        //       INSERT INTO viajeros_hospedajes (id_viajero, id_hospedaje, is_principal)
        //       VALUES (?, ?, ?);
        //     `;
        //     await connection.execute(query_insert_relacion, [
        //       edicionData.viajero.current.id_viajero,
        //       id_hospedaje_actual,
        //       1
        //     ]);
        //     console.log(`Nueva relación viajero-hospedaje creada para viajero ${edicionData.viajero.current.id_viajero} y hospedaje ${id_hospedaje_actual}`);
        //   }
        // }
        // --- 1. Actualizar tabla 'bookings' ---
        const updates_bookings_clauses = [];
        const params_update_bookings_values = [];

        if (edicionData.check_in?.current !== undefined) {
          updates_bookings_clauses.push("check_in = ?");
          params_update_bookings_values.push(edicionData.check_in.current);
        }
        if (edicionData.check_out?.current !== undefined) {
          updates_bookings_clauses.push("check_out = ?");
          params_update_bookings_values.push(edicionData.check_out.current);
        }
        if (edicionData.venta?.current) {
          if (edicionData.metadata?.id_credito) {
            if (edicionData.venta.current.total !== undefined) {
              updates_bookings_clauses.push("total = ?");
              params_update_bookings_values.push(
                edicionData.venta.current.total
              );
            }
            if (edicionData.venta.current.subtotal !== undefined) {
              updates_bookings_clauses.push("subtotal = ?");
              params_update_bookings_values.push(
                edicionData.venta.current.subtotal
              );
            }
            if (edicionData.venta.current.impuestos !== undefined) {
              updates_bookings_clauses.push("impuestos = ?");
              params_update_bookings_values.push(
                edicionData.venta.current.impuestos
              );
            }
          }
        }
        if (edicionData.estado_reserva?.current !== undefined) {
          updates_bookings_clauses.push("estado = ?");
          params_update_bookings_values.push(
            edicionData.estado_reserva.current
          );
        }
        if (edicionData.proveedor?.current) {
          if (edicionData.proveedor.current.total !== undefined) {
            updates_bookings_clauses.push("costo_total = ?");
            params_update_bookings_values.push(
              edicionData.proveedor.current.total
            );
          }
          if (edicionData.proveedor.current.subtotal !== undefined) {
            updates_bookings_clauses.push("costo_subtotal = ?");
            params_update_bookings_values.push(
              edicionData.proveedor.current.subtotal
            );
          }
          if (edicionData.proveedor.current.impuestos !== undefined) {
            updates_bookings_clauses.push("costo_impuestos = ?");
            params_update_bookings_values.push(
              edicionData.proveedor.current.impuestos
            );
          }
        }

        if (updates_bookings_clauses.length > 0) {
          const query_update_bookings = `UPDATE bookings SET ${updates_bookings_clauses.join(
            ", "
          )} WHERE id_booking = ?;`;
          await connection.execute(query_update_bookings, [
            ...params_update_bookings_values,
            id_booking_a_editar,
          ]);
        }

        // --- 2. Actualizar tabla 'hospedajes' ---
        if (id_hospedaje_actual) {
          const updates_hospedaje_clauses = [];
          const params_update_hospedaje_values = [];

          if (edicionData.hotel?.current?.content?.nombre_hotel !== undefined) {
            updates_hospedaje_clauses.push("nombre_hotel = ?");
            params_update_hospedaje_values.push(
              edicionData.hotel.current.content.nombre_hotel
            );
          }
          if (edicionData.hotel?.current?.content?.id_hotel !== undefined) {
            updates_hospedaje_clauses.push("id_hotel = ?");
            params_update_hospedaje_values.push(
              edicionData.hotel.current.content.id_hotel
            );
          }
          if (edicionData.codigo_reservacion_hotel?.current !== undefined) {
            updates_hospedaje_clauses.push("codigo_reservacion_hotel = ?");
            params_update_hospedaje_values.push(
              edicionData.codigo_reservacion_hotel.current
            );
          }
          if (edicionData.habitacion?.current !== undefined) {
            updates_hospedaje_clauses.push("tipo_cuarto = ?");
            params_update_hospedaje_values.push(edicionData.habitacion.current);
          }
          if (edicionData.noches?.current !== undefined) {
            updates_hospedaje_clauses.push("noches = ?");
            params_update_hospedaje_values.push(edicionData.noches.current);
          }
          if (edicionData.comments?.current !== undefined) {
            updates_hospedaje_clauses.push("comments = ?");
            params_update_hospedaje_values.push(edicionData.comments.current);
          }

          if (updates_hospedaje_clauses.length > 0) {
            const query_update_hospedaje = `UPDATE hospedajes SET ${updates_hospedaje_clauses.join(
              ", "
            )} WHERE id_hospedaje = ?;`;
            await connection.execute(query_update_hospedaje, [
              ...params_update_hospedaje_values,
              id_hospedaje_actual,
            ]);
          }
        }

        // --- 3. Manejar Items (Borrar y Recrear) ---
        if (edicionData.metadata?.id_credito) {
          if (edicionData.items && id_hospedaje_actual) {
            const query_delete_items_pagos = `DELETE FROM items_pagos WHERE id_item IN (SELECT id_item FROM items WHERE id_hospedaje = ?);`;
            await connection.execute(query_delete_items_pagos, [
              id_hospedaje_actual,
            ]);

            const query_delete_impuestos_items = `DELETE FROM impuestos_items WHERE id_item IN (SELECT id_item FROM items WHERE id_hospedaje = ?);`;
            await connection.execute(query_delete_impuestos_items, [
              id_hospedaje_actual,
            ]);

            const query_delete_items =
              "DELETE FROM items WHERE id_hospedaje = ?;";
            await connection.execute(query_delete_items, [id_hospedaje_actual]);

            const nuevosItemsParaInsertar = edicionData.items.current;
            if (nuevosItemsParaInsertar && nuevosItemsParaInsertar.length > 0) {
              const itemsConIdAnadido = nuevosItemsParaInsertar.map((item) => ({
                ...item,
                id_item: `ite-${uuidv4()}`,
              }));

              const query_items_insert = `
                INSERT INTO items (
                  id_item, id_catalogo_item, id_factura, total, subtotal, impuestos, 
                  is_facturado, fecha_uso, id_hospedaje, costo_total, costo_subtotal, 
                  costo_impuestos, costo_iva, saldo
                ) VALUES ${itemsConIdAnadido
                  .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                  .join(",")};`;
              const params_items_insert = itemsConIdAnadido.flatMap(
                (itemConId) => [
                  itemConId.id_item,
                  null,
                  null,
                  (
                    edicionData.venta.before.total / edicionData.noches.before
                  ).toFixed(2),
                  (
                    edicionData.venta.before.subtotal /
                    edicionData.noches.before
                  ).toFixed(2),
                  (
                    edicionData.venta.before.impuestos /
                    edicionData.noches.before
                  ).toFixed(2),
                  null,
                  new Date().toISOString().split("T")[0],
                  id_hospedaje_actual,
                  itemConId.costo.total.toFixed(2),
                  itemConId.costo.subtotal.toFixed(2),
                  itemConId.costo.impuestos.toFixed(2),
                  (itemConId.costo.total * 0.16).toFixed(2),
                  0,
                ]
              );
              await connection.execute(query_items_insert, params_items_insert);

              const taxesDataParaDb = [];
              itemsConIdAnadido.forEach((itemConId) => {
                if (itemConId.impuestos && itemConId.impuestos.length > 0) {
                  itemConId.impuestos.forEach((tax) => {
                    taxesDataParaDb.push({
                      id_item: itemConId.id_item,
                      base: tax.base,
                      total: tax.total,
                      porcentaje: tax.rate ?? 0,
                      monto: tax.monto ?? 0,
                      name: tax.name,
                      tipo_impuestos: tax.tipo_impuesto,
                    });
                  });
                }
              });

              if (taxesDataParaDb.length > 0) {
                const query_impuestos_items = `
                  INSERT INTO impuestos_items (id_item, base, total, porcentaje, monto, nombre_impuesto, tipo_impuesto)
                  VALUES ${taxesDataParaDb
                    .map(() => "(?, ?, ?, ?, ?, ?, ?)")
                    .join(", ")};`;
                const params_impuestos_items = taxesDataParaDb.flatMap((t) => [
                  t.id_item,
                  t.base,
                  t.total,
                  t.porcentaje,
                  t.monto,
                  t.name,
                  t.tipo_impuestos,
                ]);
                await connection.execute(
                  query_impuestos_items,
                  params_impuestos_items
                );
              }

              const query_pago_contado = `SELECT id_pago FROM pagos WHERE id_servicio = ? LIMIT 1;`;
              const [rowsContado] = await connection.execute(
                query_pago_contado,
                [id_servicio_actual]
              );

              if (rowsContado.length > 0) {
                const id_pago = rowsContado[0].id_pago;
                if (itemsConIdAnadido.length > 0) {
                  const query_items_pagos_insert = `
                    INSERT INTO items_pagos (id_item, id_pago, monto)
                    VALUES ${itemsConIdAnadido
                      .map(() => "(?, ?, ?)")
                      .join(",")};`;
                  const params_items_pagos_insert = itemsConIdAnadido.flatMap(
                    (itemConId) => [
                      itemConId.id_item,
                      id_pago,
                      (
                        edicionData.venta.before.total /
                        edicionData.noches.before
                      ).toFixed(2),
                    ]
                  );
                  await connection.execute(
                    query_items_pagos_insert,
                    params_items_pagos_insert
                  );
                }
              } else {
                const query_pago_credito = `SELECT id_credito FROM pagos_credito WHERE id_servicio = ? LIMIT 1;`;
                const [rowsCredito] = await connection.execute(
                  query_pago_credito,
                  [id_servicio_actual]
                );
                if (rowsCredito.length === 0) {
                  console.warn(
                    "Advertencia: No se encontró un pago (contado o crédito) para el servicio al re-crear items_pagos:",
                    id_servicio_actual
                  );
                }
              }
            }
          } else if (
            edicionData.items &&
            edicionData.items.current?.length === 0 &&
            id_hospedaje_actual
          ) {
            console.log(
              `Todos los items asociados al hospedaje ${id_hospedaje_actual} han sido eliminados según la solicitud.`
            );
          }
        }

        // --- 5. Actualizar Tabla 'solicitudes' ---
        if (id_solicitud_actual) {
          const updates_solicitud_clauses = [];
          const params_update_solicitud_values = [];

          // Datos del viajero
          /*
          if (edicionData.viajero?.current) {
            const viajeroActual = edicionData.viajero.current;
            
            if (viajeroActual.id_viajero !== undefined) {
              updates_solicitud_clauses.push("id_viajero = ?");
              params_update_solicitud_values.push(viajeroActual.id_viajero);
            }

            // Construir nombre_viajero a partir de los componentes
            // Asumiendo que Viajero tiene primer_nombre, segundo_nombre, apellido_paterno, apellido_materno
            let nombreCompletoArray = [];
            if (viajeroActual.primer_nombre)
              nombreCompletoArray.push(viajeroActual.primer_nombre);
            if (viajeroActual.segundo_nombre)
              nombreCompletoArray.push(viajeroActual.segundo_nombre); // Asegúrate que este campo exista en tu tipo Viajero si lo usas
            if (viajeroActual.apellido_paterno)
              nombreCompletoArray.push(viajeroActual.apellido_paterno);
            if (viajeroActual.apellido_materno)
              nombreCompletoArray.push(viajeroActual.apellido_materno); // Asegúrate que este campo exista
            
                        if (nombreCompletoArray.length > 0) {
                          updates_solicitud_clauses.push("nombre_viajero = ?");
                          params_update_solicitud_values.push(
                            nombreCompletoArray.join(" ").trim()
                          );
                        }
                      }
            
                      // Datos del hotel y reserva
                      
                      if (edicionData.hotel?.current?.content?.nombre_hotel !== undefined) {
                        updates_solicitud_clauses.push("hotel = ?"); // Columna 'hotel' en tabla 'solicitudes'
                        params_update_solicitud_values.push(
                          edicionData.hotel.current.content.nombre_hotel
                        );
                      }
                      
                      if (edicionData.check_in?.current !== undefined) {
                        updates_solicitud_clauses.push("check_in = ?");
                        params_update_solicitud_values.push(edicionData.check_in.current);
                      }
                      if (edicionData.check_out?.current !== undefined) {
                        updates_solicitud_clauses.push("check_out = ?");
                        params_update_solicitud_values.push(edicionData.check_out.current);
                      }
                      if (edicionData.habitacion?.current !== undefined) {
                        updates_solicitud_clauses.push("room = ?"); // Columna 'room' en tabla 'solicitudes'
                        params_update_solicitud_values.push(edicionData.habitacion.current);
                      }
                      if (edicionData.metadata?.id_credito) {
                        if (edicionData.venta?.current?.total !== undefined) {
                          updates_solicitud_clauses.push("total = ?"); //Columna 'total' en tabla 'solicitudes'
                          params_update_solicitud_values.push(
                            edicionData.venta.current.total
                          );
                        }
                      }
                      if (edicionData.codigo_reservacion_hotel?.current !== undefined) {
                        updates_solicitud_clauses.push("confirmation_code = ?"); // Columna 'confirmation_code' en 'solicitudes'
                        params_update_solicitud_values.push(
                          edicionData.codigo_reservacion_hotel.current
                        );
                      }
                      */

          // Estado de la solicitud
          let nuevoEstadoSolicitud = null;
          if (edicionData.estado_reserva?.current) {
            switch (edicionData.estado_reserva.current) {
              case "Confirmada":
                nuevoEstadoSolicitud = "complete";
                break;
              case "Cancelada":
                nuevoEstadoSolicitud = "canceled";
                break;
              case "En proceso":
                nuevoEstadoSolicitud = "pending";
                break;
            }
          } else if (edicionData.solicitud?.status) {
            nuevoEstadoSolicitud = edicionData.solicitud.status;
          }

          if (nuevoEstadoSolicitud) {
            updates_solicitud_clauses.push("status = ?");
            params_update_solicitud_values.push(nuevoEstadoSolicitud);
          }

          // Ejecutar la actualización de solicitudes si hay cláusulas para actualizar
          if (updates_solicitud_clauses.length > 0) {
            const query_update_solicitud = `UPDATE solicitudes SET ${updates_solicitud_clauses.join(
              ", "
            )} WHERE id_solicitud = ?;`;
            await connection.execute(query_update_solicitud, [
              ...params_update_solicitud_values,
              id_solicitud_actual,
            ]);
          }
        }

        return {
          message: "Reserva actualizada exitosamente",
          id_booking: id_booking_a_editar,
        };
      }
    );
    return response;
  } catch (error) {
    console.error("Error al editar reserva:", error, edicionData);

    const message = error && error.message ? error.message : String(error);

    throw new Error(
      `Error al editar reserva: ${message}. Datos: ${JSON.stringify(
        edicionData
      )}`
    );
  }
};

const insertarReservaOperaciones = async (reserva,bandera) => {
  /*VAMOS A USAR UNA BANDERA CON LA SIG REGLA
  SI BANDERA == 0 -> PAGO SOLO A CREDITO
  SI BANDERA == 1  -> PAGO SOLO A WALLET */
  if(bandera === 0){
      try {
        const agentes = await executeQuery(
          `SELECT * FROM agentes WHERE id_agente = ?`,
          [reserva.solicitud.id_agente]
        );
        if (!agentes || agentes.length === 0) {
          throw new Error("Agente no encontrado");
        } else {
          const agente = agentes[0];
          if (agente.saldo < reserva.venta.total) {
            throw new Error(
              `El saldo del agente ${agente.nombre} es insuficiente para procesar esta reserva.`
            );
          }
        }

        const { venta, proveedor, hotel, items, viajero } = reserva; // 'items' aquí es ReservaForm['items']
        const id_servicio = `ser-${uuidv4()}`;
        const query_servicio = `INSERT INTO servicios (id_servicio, total, subtotal, impuestos, is_credito, otros_impuestos, fecha_limite_pago, id_agente) VALUES (?,?,?,?,?,?,?,?);`;
        const params_servicio = [
          id_servicio,
          venta.total,
          parseFloat(venta.subtotal.toFixed(2)),
          parseFloat(venta.impuestos.toFixed(2)),
          true,
          null,
          null,
          reserva.solicitud.id_agente,
        ];

        // La función executeTransaction debería tomar la primera query y sus params,
        // y luego el callback con la conexión para las siguientes operaciones.
        const response = await executeTransaction(
          query_servicio,
          params_servicio,
          async (results, connection) => {
            // 'results' es de la inserción en bookings
            try {
              const id_solicitud = `sol-${uuidv4()}`;
              const query_solicitudes = `INSERT INTO solicitudes (id_solicitud, id_servicio, id_usuario_generador, confirmation_code, id_viajero, hotel, check_in, check_out, room, total, status) VALUES (?,?,?,?,?,?,?,?,?,?,?);`;
              const params_solicitud = [
                id_solicitud,
                id_servicio,
                null,
                uuidv4().slice(0, 29),
                viajero.id_viajero,
                hotel.name,
                reserva.check_in,
                reserva.check_out,
                reserva.habitacion,
                venta.total,
                reserva.estado_reserva,
              ];
              await connection.execute(query_solicitudes, params_solicitud);
              //aqui metere el update para el saldo del agente
              const query_update_saldo_agente = `
              UPDATE agentes SET saldo = saldo - ? WHERE id_agente = ?;`;
              const params_update_saldo_agente = [
                venta.total,
                reserva.solicitud.id_agente,
              ];
              //console.log(`Actualizando saldo del agente ${reserva.solicitud.id_agente} con el monto ${venta.total}`);
              await connection.execute(
                query_update_saldo_agente,
                params_update_saldo_agente
              );

              const id_booking = `boo-${uuidv4()}`;

              // Query y parámetros para la inserción inicial en 'bookings'
              // Asegúrate de que estas columnas coincidan con tu tabla 'bookings'
              const query_bookings = `
          INSERT INTO bookings (
            id_booking, id_servicio, check_in, check_out, 
            total, subtotal, impuestos, estado, 
            costo_total, costo_subtotal, costo_impuestos, 
            fecha_pago_proveedor, fecha_limite_cancelacion, id_solicitud
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
              const params_bookings = [
                id_booking,
                id_servicio,
                reserva.check_in,
                reserva.check_out,
                venta.total,
                venta.subtotal,
                venta.impuestos,
                reserva.estado_reserva,
                proveedor.total,
                proveedor.subtotal,
                proveedor.impuestos,
                null, // fecha_pago_proveedor - Ajusta si lo tienes
                null, // fecha_limite_cancelacion - Ajusta si lo tienes
                id_solicitud,
              ];

              await connection.execute(query_bookings, params_bookings);

              // 1. Insertar Hospedaje
              const id_hospedaje = `hos-${uuidv4()}`;
              // Asegúrate de que estas columnas coincidan con tu tabla 'hospedajes'
              //Antes ubicamos el tipo de cuarto para poder ir por los detalles del desayuno
              if(reserva.habitacion ==='SENCILLO'){
                var tipo_desayuno = reserva.hotel.content.tipos_cuartos[0].tipo_desayuno;
                var comentario_desayuno = reserva.hotel.content.tipos_cuartos[0].comentario_desayuno;
                var precio_desayuno = reserva.hotel.content.tipos_cuartos[0].precio_desayuno;
                var incluye_desayuno = reserva.hotel.content.tipos_cuartos[0].incluye_desayuno;

              }else if(reserva.habitacion=== 'DOBLE'){
                tipo_desayuno = reserva.hotel.content.tipos_cuartos[1].tipo_desayuno;
                comentario_desayuno = reserva.hotel.content.tipos_cuartos[1].comentario_desayuno;
                precio_desayuno = reserva.hotel.content.tipos_cuartos[1].precio_desayuno;
                  incluye_desayuno = reserva.hotel.content.tipos_cuartos[1].incluye_desayuno;
              }
              const query_hospedaje = `
                INSERT INTO hospedajes (
                  id_hospedaje, id_booking, nombre_hotel, cadena_hotel, 
                  codigo_reservacion_hotel, tipo_cuarto, noches, 
                  is_rembolsable, monto_penalizacion, conciliado, 
                  credito, comments, id_hotel,nuevo_incluye_desayuno,tipo_desayuno,comentario_desayuno,
                  precio_desayuno 
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?,?);
              `;
              const params_hospedaje = [
                id_hospedaje,
                id_booking,
                hotel.content?.nombre_hotel, // Usar optional chaining por si content no viene
                null, // cadena_hotel - Ajusta si lo tienes
                reserva.codigo_reservacion_hotel,
                reserva.habitacion,
                reserva.noches,
                null, // is_rembolsable
                null, // monto_penalizacion
                null, // conciliado
                null, // credito (¿se refiere al método de pago o a una línea de crédito del hotel?)
                reserva.comments,
                hotel.content?.id_hotel,
                reserva.nuevo_incluye_desayuno || null, // nuevo_incluye_desayuno
                tipo_desayuno || null,
                comentario_desayuno || null,
                precio_desayuno || null
              ];

              console.log("Revisando la lista de parametros que enviamos a la query 😎😎😎😎",params_hospedaje);
              await connection.execute(query_hospedaje, params_hospedaje);

              // Preparar items con ID (común para ambos casos: crédito o contado)
              // 'items' es el array original de ReservaForm['items']
              const itemsConIdAnadido =
                items && items.length > 0
                  ? items.map((item) => ({
                      ...item, // Esto incluye item.costo, item.venta, item.impuestos originales
                      id_item: `ite-${uuidv4()}`,
                    }))
                  : [];

              // 2. Insertar Items en la tabla 'items' (común si hay items)
              if (itemsConIdAnadido.length > 0) {
                const query_items_insert = `
                  INSERT INTO items (
                    id_item, id_catalogo_item, id_factura, 
                    total, subtotal, impuestos, 
                    is_facturado, fecha_uso, id_hospedaje, 
                    costo_total, costo_subtotal, costo_impuestos, costo_iva, saldo
                  ) VALUES ${itemsConIdAnadido
                    .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                    .join(",")};
                `;
                const params_items_insert = itemsConIdAnadido.flatMap(
                  (itemConId) => [
                    itemConId.id_item,
                    null, // id_catalogo_item - Ajusta si lo tienes
                    null, // id_factura - Ajusta si lo tienes
                    itemConId.venta.total.toFixed(2),
                    itemConId.venta.subtotal.toFixed(2),
                    itemConId.venta.impuestos.toFixed(2),
                    null, // is_facturado - Ajusta si lo tienes
                    new Date().toISOString().split("T")[0], // fecha_uso
                    id_hospedaje,
                    itemConId.costo.total.toFixed(2),
                    itemConId.costo.subtotal.toFixed(2),
                    itemConId.costo.impuestos.toFixed(2),
                    // Asumimos IVA del 16% sobre el costo total del item. ¡VERIFICA ESTA LÓGICA!
                    (itemConId.costo.total * 0.16).toFixed(2),
                    itemConId.venta.total.toFixed(2), // saldo inicial - Ajusta si es diferente
                  ]
                );
                await connection.execute(query_items_insert, params_items_insert);
              }

              // 3. Insertar Impuestos de Items en 'impuestos_items' (común si hay items con impuestos)
              const taxesDataParaDb = []; // Puedes crear un tipo para esto
              if (itemsConIdAnadido.length > 0) {
                itemsConIdAnadido.forEach((itemConId) => {
                  // itemConId.impuestos debe ser ItemLevelTax[] según ReservaForm
                  if (itemConId.impuestos && itemConId.impuestos.length > 0) {
                    itemConId.impuestos.forEach((tax) => {
                      taxesDataParaDb.push({
                        id_item: itemConId.id_item,
                        base: tax.base,
                        total: tax.total,
                        porcentaje: tax.rate ?? 0,
                        monto: tax.monto ?? 0,
                        name: tax.name,
                        tipo_impuestos: tax.tipo_impuesto,
                      });
                    });
                  }
                });

                if (taxesDataParaDb.length > 0) {
                  const query_impuestos_items = `
                    INSERT INTO impuestos_items (id_item, base, total, porcentaje, monto, nombre_impuesto, tipo_impuesto)
                    VALUES ${taxesDataParaDb
                      .map(() => "(?, ?, ?, ?, ?, ?, ?)")
                      .join(", ")};
                  `;
                  const params_impuestos_items = taxesDataParaDb.flatMap((t) => [
                    t.id_item,
                    t.base,
                    t.total,
                    t.porcentaje,
                    t.monto,
                    t.name,
                    t.tipo_impuestos,
                  ]);
                  await connection.execute(
                    query_impuestos_items,
                    params_impuestos_items
                  );
                }
              }
              // 4. meter a viajero hospedajes
              const query_insert_relacion = `
                  INSERT INTO viajeros_hospedajes (id_viajero, id_hospedaje, is_principal)
                  VALUES (?, ?, ?);
                `;
              await connection.execute(query_insert_relacion, [
                viajero.id_viajero,
                id_hospedaje,
                1,
              ]);
              // Insertamos a los acompañantes del viajero
              reserva.acompanantes.forEach(async acompanante => {
                await connection.execute(query_insert_relacion,[
                  acompanante.id_viajero,
                  id_hospedaje,
                  0
                ])
              });

              /* FALTA AGREGAR EL CREDITO CON PAGO Y LOS ITEMS A SUS CREDITOS */ /*vamos a comentar la query de credito por el momento*/
                      const queryCredito = `
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
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            );`;
                      const paramsCredito = [
                        `cre-${uuidv4()}`,
                        id_servicio,
                        venta.total,
                        null,
                        reserva.solicitud.id_agente,
                        new Date(),
                        venta.total,
                        venta.total,
                        venta.total,
                        venta.subtotal,
                        venta.impuestos,
                        `Reserva por ${reserva.noches} a ${hotel.name}`,
                        null,
                        "mxn",
                        "credito",
                      ];

                      await connection.execute(queryCredito, paramsCredito);

              await connection.execute(
                `UPDATE solicitudes SET status = "complete" WHERE id_solicitud = ?;`,
                [id_solicitud] // Asegúrate que solicitud.id_solicitud está disponible
              );

              return {
                message: "Reserva procesada exitosamente",
                id_servicio : id_servicio,
                id_booking: id_booking,
                id_hospedaje: id_hospedaje,
                total: venta.total,
                items: itemsConIdAnadido
                // puedes añadir más datos al objeto de respuesta si es necesario
              };
            } catch (errorInTransaction) {
              console.error("Error dentro de la transacción:", errorInTransaction);
              throw errorInTransaction; // Es crucial para que executeTransaction pueda hacer rollback
            }
          
      }
    );

    return response; // Esto será lo que devuelva el callback de executeTransaction
  } catch (error) {
    console.error("Error al insertar reserva:", error);
    throw error; // Lanza el error para que puedas manejarlo donde llames la función
  }
} else if(bandera === 1){
    const ejemplo_saldos = [
      {
      id_saldo: 33,
      saldo_original: 500,
      saldo_actual: 0,
      aplicado: 50,
      // id_pago, LO VAMOS A GENERAR
      // id_servicio, YA LO TENEMOS
      // id_saldo_a_favor, YA LO TENEMOS
      id_agente,
      metodo_de_pago,
      fecha_pago,
      concepto,
      referencia,
      currency,
      tipo_de_tarjeta,
      link_pago,
      last_digits,
      total : 3000
    },{
      id_saldo: 55,
      saldo_original: 100,
      saldo_actual: 0,
      aplicado: 100,
      // id_pago, LO VAMOS A GENERAR
      id_servicio,
      id_saldo_a_favor,
      id_agente,
      metodo_de_pago,
      fecha_pago,
      concepto,
      referencia,
      currency,
      tipo_de_tarjeta,
      link_pago,
      last_digits,
      total : 2000
    },
  ];
  try {
    let pagos_insertados;
    const query_pagos = ` INSERT INTO pagos (
        id_pago,
        id_servicio,
        id_saldo_a_favor,
        id_agente,
        metodo_de_pago,
        fecha_pago,
        concepto,
        referencia,
        currency,
        tipo_de_tarjeta,
        link_pago,
        last_digits,
        total
    ) values (?,?,?,?,?,?,?,?,?,?,?,?,?);`;

for (const saldo of ejemplo_saldos) {
  let id_pago = `pag-${uuidv4()}`;
  await connection.execute(query_pagos, [
    id_pago,
    id_servicio,
    saldo.id_saldo,
    saldo.id_agente,
    saldo.metodo_de_pago,
    saldo.fecha_pago,
    saldo.concepto,
    saldo.referencia,
    saldo.currency,
    saldo.tipo_de_tarjeta,
    saldo.link_pago,
    saldo.last_digits,
    venta.total 
  ]);
  pagos_insertados.push(id_pago);
}
    
  } catch (error) {
    
  }
}
};
const getReserva = async () => {
  try {
    const query = `select * from bookings left join hospedajes on bookings.id_booking = hospedajes.id_booking;`;

    // Ejecutar el procedimiento almacenado
    const response = await executeQuery(query);

    return response; // Retorna el resultado de la ejecución
  } catch (error) {
    throw error; // Lanza el error para que puedas manejarlo donde llames la función
  }
};
const getReservaById = async (id) => {
  try {
    const query = `select 
s.id_servicio,
s.created_at,
s.is_credito,
so.id_solicitud,
so.confirmation_code,
so.hotel,
so.check_in,
so.check_out,
so.room,
so.total,
so.id_usuario_generador,
b.id_booking, 
h.codigo_reservacion_hotel, 
p.id_pago, 
p.pendiente_por_cobrar,
p.monto_a_credito,
fp.id_factura,
vw.primer_nombre,
vw.apellido_paterno
from solicitudes as so
LEFT JOIN servicios as s ON so.id_servicio = s.id_servicio
LEFT JOIN bookings as b ON so.id_solicitud = b.id_solicitud
LEFT JOIN hospedajes as h ON b.id_booking = h.id_booking
LEFT JOIN pagos as p ON so.id_servicio = p.id_servicio
LEFT JOIN facturas_pagos as fp ON p.id_pago = fp.id_pago
LEFT JOIN viajeros_con_empresas_con_agentes as vw ON vw.id_agente = so.id_viajero
WHERE id_usuario_generador in (
	select id_empresa 
	from empresas_agentes 
	where id_agente = ?
) or id_usuario_generador = ?
GROUP BY so.id_solicitud
ORDER BY s.created_at DESC;`;

    // Ejecutar el procedimiento almacenado
    const response = await executeQuery(query, [id, id]);

    return response; // Retorna el resultado de la ejecución
  } catch (error) {
    throw error; // Lanza el error para que puedas manejarlo donde llames la función
  }
};
const getReservaAll = async () => {
  try {
    const query = `select 
s.id_servicio,
s.created_at,
s.is_credito,
so.id_solicitud,
so.confirmation_code,
h.nombre_hotel as hotel,
so.check_in,
so.check_out,
so.room,
so.total,
so.id_usuario_generador,
b.id_booking, 
h.codigo_reservacion_hotel, 
p.id_pago, 
p.pendiente_por_cobrar,
p.monto_a_credito,
fp.id_factura,
vw.primer_nombre,
vw.apellido_paterno,
a.nombre,
  (
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT(
        'id_item', i.id_item,
        'fecha_uso', i.fecha_uso,
        'total', i.total,
        'subtotal', i.subtotal,
        'impuestos', i.impuestos,
        'costo_total', i.costo_total,
        'costo_subtotal', i.costo_subtotal,
        'costo_impuestos', i.costo_impuestos,
        'saldo', i.saldo,
        'is_facturado', i.is_facturado,
        'id_factura', i.id_factura
      )
    )
    FROM items i
    WHERE i.id_hospedaje = h.id_hospedaje
    ORDER BY i.fecha_uso
  ) AS items
from solicitudes as so
LEFT JOIN servicios as s ON so.id_servicio = s.id_servicio
LEFT JOIN bookings as b ON so.id_solicitud = b.id_solicitud
LEFT JOIN hospedajes as h ON b.id_booking = h.id_booking
LEFT JOIN pagos as p ON so.id_servicio = p.id_servicio
LEFT JOIN facturas_pagos as fp ON p.id_pago = fp.id_pago
LEFT JOIN viajeros_con_empresas_con_agentes as vw ON vw.id_agente = so.id_viajero
LEFT JOIN agentes as a ON so.id_usuario_generador = a.id_agente
WHERE b.id_booking IS NOT NULL
GROUP BY so.id_solicitud
ORDER BY s.created_at DESC;`;

    // Ejecutar el procedimiento almacenado
    const response = await executeQuery(query);
    return response; // Retorna el resultado de la ejecución
  } catch (error) {
    throw error; // Lanza el error para que puedas manejarlo donde llames la función
  }
};

const getReservaAllFacturacion = async () => {
  try {
    const query = `SELECT
  ad.id_agente as id_usuario_generador,
  rc.id_servicio,
  rc.status_reserva           AS estado_reserva,
  rc.created_at_reserva       AS created_at,
  rc.id_solicitud,
  rc.id_viajero_reserva       AS id_viajero,
  rc.hotel_reserva            AS hotel,
  rc.check_in,
  rc.check_out,
  rc.tipo_cuarto              AS room,
  rc.total,
  rc.nombre_viajero_reservacion AS nombre_viajero,
  rc.id_booking,
  rc.updated_at,
  rc.costo_total,
  rc.id_hospedaje,
  rc.comments,
  rc.codigo_reservacion_hotel,
  GROUP_CONCAT(DISTINCT rc.id_pago     SEPARATOR ',') AS id_pago,
  GROUP_CONCAT(DISTINCT rc.id_credito  SEPARATOR ',') AS id_credito,
  ad.nombre        AS nombre_agente_completo,
  ad.correo,
  ad.telefono,
  ad.razon_social,
  ad.rfc,
  ad.tipo_persona,
  (
    SELECT JSON_ARRAYAGG(
             JSON_OBJECT(
               'id_item', i.id_item,
               'fecha_uso', i.fecha_uso,
               'total', i.total,
               'subtotal', i.subtotal,
               'impuestos', i.impuestos,
               'costo_total', i.costo_total,
               'costo_subtotal', i.costo_subtotal,
               'costo_impuestos', i.costo_impuestos,
               'saldo', i.saldo,
               'is_facturado', i.is_facturado,
               'id_factura', i.id_factura
             )
             -- ORDER BY i.fecha_uso
           )
    FROM items i
    WHERE i.id_hospedaje = h.id_hospedaje
  ) AS items
FROM vw_reservas_client rc
LEFT JOIN agente_details ad ON ad.id_agente = rc.id_agente
LEFT JOIN hospedajes h
       ON h.id_hospedaje = rc.id_hospedaje
WHERE rc.status_reserva = 'Confirmada'
GROUP BY
  rc.id_hospedaje,
  rc.id_servicio,
  rc.status_reserva,
  rc.created_at_reserva,
  rc.id_solicitud,
  rc.id_viajero_reserva,
  rc.hotel_reserva,
  rc.check_in,
  rc.check_out,
  rc.tipo_cuarto,
  rc.total,
  rc.nombre_viajero_reservacion,
  rc.id_booking,
  rc.updated_at,
  rc.costo_total,
  rc.comments,
  rc.codigo_reservacion_hotel,
  ad.nombre,
  ad.correo,
  ad.telefono,
  ad.razon_social,
  ad.rfc,
  ad.tipo_persona
ORDER BY rc.created_at_reserva DESC;`;

    // Ejecutar el procedimiento almacenado
    const response = await executeQuery(query);
    return response; // Retorna el resultado de la ejecución
  } catch (error) {
    throw error; // Lanza el error para que puedas manejarlo donde llames la función
  }
};

const getOnlyReservaByID = async (id) => {
  try {
    const query = `select *, b.total as total_client, b.subtotal as subtotal_client, b.impuestos as impuestos_client from bookings as b
LEFT JOIN servicios as s ON s.id_servicio = b.id_servicio
LEFT JOIN hospedajes as h ON h.id_booking = b.id_booking
LEFT JOIN items as i ON i.id_hospedaje = h.id_hospedaje
LEFT JOIN impuestos_items as ii ON ii.id_item = i.id_item
LEFT JOIN items_pagos as ip ON ip.id_item = i.id_item
WHERE b.id_booking = ?;`;

    // Ejecutar el procedimiento almacenado
    const response = await executeQuery(query, [id]);

    return agruparDatos(response); // Retorna el resultado de la ejecución
  } catch (error) {
    throw error; // Lanza el error para que puedas manejarlo donde llames la función
  }
};

const insertarReserva = async ({ reserva }) => {
  // console.log("LLegando a insertarReserva con reserva: ");
  // console.log(reserva);
  // const {solicitud} = reserva;
  // console.log("Verificando solicitud: ",solicitud);
  try {
    const id_booking = `boo-${uuidv4()}`;
    const { solicitud, venta, proveedor, hotel, items, viajero } = reserva; // 'items' aquí es ReservaForm['items']

    const existingSolicitud = await executeQuery(
      "select * from solicitudes as so inner join bookings as bo on bo.id_solicitud = so.id_solicitud where so.id_solicitud = ?;",
      [solicitud.id_solicitud]
    );
    console.log(existingSolicitud);
    if (existingSolicitud && existingSolicitud.length > 0) {
      throw new Error(
        `Ya existe una solicitud con el ID ${solicitud.id_solicitud}. Por favor, verifica el ID de la solicitud.`
      );
    }

    // Query y parámetros para la inserción inicial en 'bookings'
    // Asegúrate de que estas columnas coincidan con tu tabla 'bookings'
    const query_bookings = `
      INSERT INTO bookings (
        id_booking, id_servicio, check_in, check_out, 
        total, subtotal, impuestos, estado, 
        costo_total, costo_subtotal, costo_impuestos, 
        fecha_pago_proveedor, fecha_limite_cancelacion, id_solicitud
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const params_bookings = [
      id_booking,
      solicitud.id_servicio,
      reserva.check_in,
      reserva.check_out,
      venta.total,
      venta.subtotal,
      venta.impuestos,
      reserva.estado_reserva,
      proveedor.total,
      proveedor.subtotal,
      proveedor.impuestos,
      null, // fecha_pago_proveedor - Ajusta si lo tienes
      null, // fecha_limite_cancelacion - Ajusta si lo tienes
      solicitud.id_solicitud,
    ];

    // La función executeTransaction debería tomar la primera query y sus params,
    // y luego el callback con la conexión para las siguientes operaciones.
    const response = await executeTransaction(
      query_bookings,
      params_bookings,
      async (results, connection) => {
        // 'results' es de la inserción en bookings
        try {
          // 1. Insertar Hospedaje
          const id_hospedaje = `hos-${uuidv4()}`;
          // Asegúrate de que estas columnas coincidan con tu tabla 'hospedajes'
          const query_hospedaje = `
            INSERT INTO hospedajes (
              id_hospedaje, id_booking, nombre_hotel, cadena_hotel, 
              codigo_reservacion_hotel, tipo_cuarto, noches, 
              is_rembolsable, monto_penalizacion, conciliado, 
              credito, comments, id_hotel
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `;
          const params_hospedaje = [
            id_hospedaje,
            id_booking,
            hotel.content?.nombre_hotel, // Usar optional chaining por si content no viene
            null, // cadena_hotel - Ajusta si lo tienes
            reserva.codigo_reservacion_hotel,
            reserva.habitacion,
            reserva.noches,
            null, // is_rembolsable
            null, // monto_penalizacion
            null, // conciliado
            null, // credito (¿se refiere al método de pago o a una línea de crédito del hotel?)
            reserva.comments,
            hotel.content?.id_hotel,
          ];
          await connection.execute(query_hospedaje, params_hospedaje);

          // Preparar items con ID (común para ambos casos: crédito o contado)
          // 'items' es el array original de ReservaForm['items']
          const itemsConIdAnadido =
            items && items.length > 0
              ? items.map((item) => ({
                  ...item, // Esto incluye item.costo, item.venta, item.impuestos originales
                  id_item: `ite-${uuidv4()}`,
                }))
              : [];

          // 2. Insertar Items en la tabla 'items' (común si hay items)
          if (itemsConIdAnadido.length > 0) {
            const query_items_insert = `
              INSERT INTO items (
                id_item, id_catalogo_item, id_factura, 
                total, subtotal, impuestos, 
                is_facturado, fecha_uso, id_hospedaje, 
                costo_total, costo_subtotal, costo_impuestos, costo_iva, saldo
              ) VALUES ${itemsConIdAnadido
                .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .join(",")};
            `;
            const params_items_insert = itemsConIdAnadido.flatMap(
              (itemConId) => [
                itemConId.id_item,
                null, // id_catalogo_item - Ajusta si lo tienes
                null, // id_factura - Ajusta si lo tienes
                itemConId.venta.total.toFixed(2),
                itemConId.venta.subtotal.toFixed(2),
                itemConId.venta.impuestos.toFixed(2),
                null, // is_facturado - Ajusta si lo tienes
                new Date().toISOString().split("T")[0], // fecha_uso
                id_hospedaje,
                itemConId.costo.total.toFixed(2),
                itemConId.costo.subtotal.toFixed(2),
                itemConId.costo.impuestos.toFixed(2),
                // Asumimos IVA del 16% sobre el costo total del item. ¡VERIFICA ESTA LÓGICA!
                (itemConId.costo.total * 0.16).toFixed(2),
                0, // saldo inicial - Ajusta si es diferente
              ]
            );
            await connection.execute(query_items_insert, params_items_insert);
          }

          // 3. Insertar Impuestos de Items en 'impuestos_items' (común si hay items con impuestos)
          const taxesDataParaDb = []; // Puedes crear un tipo para esto
          if (itemsConIdAnadido.length > 0) {
            itemsConIdAnadido.forEach((itemConId) => {
              // itemConId.impuestos debe ser ItemLevelTax[] según ReservaForm
              if (itemConId.impuestos && itemConId.impuestos.length > 0) {
                itemConId.impuestos.forEach((tax) => {
                  taxesDataParaDb.push({
                    id_item: itemConId.id_item,
                    base: tax.base,
                    total: tax.total,
                    porcentaje: tax.rate ?? 0,
                    monto: tax.monto ?? 0,
                    name: tax.name,
                    tipo_impuestos: tax.tipo_impuesto,
                  });
                });
              }
            });

            if (taxesDataParaDb.length > 0) {
              const query_impuestos_items = `
                INSERT INTO impuestos_items (id_item, base, total, porcentaje, monto, nombre_impuesto, tipo_impuesto)
                VALUES ${taxesDataParaDb
                  .map(() => "(?, ?, ?, ?, ?, ?, ?)")
                  .join(", ")};
              `;
              const params_impuestos_items = taxesDataParaDb.flatMap((t) => [
                t.id_item,
                t.base,
                t.total,
                t.porcentaje,
                t.monto,
                t.name,
                t.tipo_impuestos,
              ]);
              await connection.execute(
                query_impuestos_items,
                params_impuestos_items
              );
            }
          }

          // 4. Lógica Específica de Pago (Contado vs Crédito)
          const query_pago_contado = `SELECT id_pago FROM pagos WHERE id_servicio = ? LIMIT 1;`;
          const [rowsContado] = await connection.execute(query_pago_contado, [
            solicitud.id_servicio,
          ]);

          if (rowsContado.length > 0) {
            // --- Bloque de PAGO DE CONTADO ---
            const id_pago = rowsContado[0].id_pago;
            console.log("Procesando pago de contado:", id_pago);

            if (itemsConIdAnadido.length > 0) {
              const query_items_pagos = `
                INSERT INTO items_pagos (id_item, id_pago, monto)
                VALUES ${itemsConIdAnadido.map(() => "(?, ?, ?)").join(",")};
              `;
              // El monto asociado al pago del item suele ser el total de la venta del item
              const params_items_pagos = itemsConIdAnadido.flatMap(
                (itemConId) => [
                  itemConId.id_item,
                  id_pago,
                  itemConId.venta.total.toFixed(2),
                ]
              );
              await connection.execute(query_items_pagos, params_items_pagos);
            }
          } else {
            // --- Bloque de PAGO A CRÉDITO (o no se encontró pago de contado) ---
            const query_pago_credito = `SELECT id_credito FROM pagos_credito WHERE id_servicio = ? LIMIT 1;`;
            const [rowsCredito] = await connection.execute(query_pago_credito, [
              solicitud.id_servicio,
            ]);

            if (rowsCredito.length === 0) {
              console.error(
                "Error: No se encontró un pago (contado o crédito) para el servicio",
                solicitud.id_servicio
              );
              throw new Error(
                `No se encontró un pago para el servicio ${solicitud.id_servicio}`
              );
            }
            const id_credito = rowsCredito[0].id_credito;
            console.log("Procesando pago a crédito:", id_credito);
            // La lógica original no asociaba el id_credito directamente a los items en una tabla similar a items_pagos.
            // Si necesitas hacerlo, aquí sería el lugar.
          }

          // 5. Actualizar Solicitud y servicios (común para ambos casos)
          //VALIDANDO BIEN EL ESTADO CORRECTO DE LA SOLICITUD
          let estado = null;
          if (reserva.estado_reserva === "En proceso") {
            estado = "pending";
          } else if (reserva.estado_reserva === "Confirmada") {
            estado = "complete";
          }
          if (!estado) {
            throw new Error("Estado de reserva no válido para inserción");
          }

          console.log(
            "Actualizando estado de solicitud:",
            solicitud.id_solicitud,
            "a",
            estado
          );
          await connection.execute(
            `UPDATE solicitudes SET status = ? WHERE id_solicitud = ?;`,
            [estado, solicitud.id_solicitud] // Asegúrate que solicitud.id_solicitud está disponible
          );
          await connection.execute(
            `UPDATE servicios SET id_agente = ? WHERE id_servicio = ?;`,
            [solicitud.id_agente, solicitud.id_servicio] // Asegúrate que solicitud.id_solicitud está disponible
          );
          const id_viajeros = [viajero.id_viajero];
          if (
            solicitud.viajeros_adicionales &&
            Array.isArray(solicitud.viajeros_adicionales)
          ) {
            solicitud.viajeros_adicionales.forEach((viajero_adicional) => {
              if (viajero_adicional?.id_viajero) {
                id_viajeros.push(viajero_adicional.id_viajero);
              } else if (typeof viajero_adicional === "string") {
                id_viajeros.push(viajero_adicional);
              }
            });
          }

          // 6. meter a viajero hospedajes
          const query_insert_relacion = `
              INSERT INTO viajeros_hospedajes (id_viajero, id_hospedaje, is_principal)
              VALUES (?, ?, ?);
            `;
          for (let i = 0; i < id_viajeros.length; i++) {
            await connection.execute(query_insert_relacion, [
              id_viajeros[i],
              id_hospedaje,
              i === 0 ? 1 : 0, // El primero es principal
            ]);
          }

          return {
            message: "Reserva procesada exitosamente",
            id_booking: id_booking,
            // puedes añadir más datos al objeto de respuesta si es necesario
          };
        } catch (errorInTransaction) {
          console.error("Error dentro de la transacción:", errorInTransaction);
          throw errorInTransaction; // Es crucial para que executeTransaction pueda hacer rollback
        }
      }
    );

    return response; // Esto será lo que devuelva el callback de executeTransaction
  } catch (error) {
    console.error("Error al insertar reserva:", error);
    throw error; // Lanza el error para que puedas manejarlo donde llames la función
  }
};

module.exports = {
  insertarReserva,
  getReserva,
  getReservaById,
  getOnlyReservaByID,
  getReservaAll,
  editarReserva,
  insertarReservaOperaciones,
  getReservaAllFacturacion,
};

function agruparDatos(data) {
  if (!data || data.length === 0) return null;

  const base = data[0]; // Todos comparten la mayoría de datos

  // Servicios
  const servicio = {
    id_servicio: base.id_servicio,
    total: base.total_client,
    subtotal: base.costo_subtotal_client,
    impuestos: base.costo_impuestos,
    otros_impuestos: base.otros_impuestos,
    is_credito: base.is_credito,
    fecha_limite_pago: base.fecha_limite_pago,
  };

  // Booking
  const booking = {
    id_booking: base.id_booking,
    id_servicio: base.id_servicio,
    check_in: base.check_in,
    check_out: base.check_out,
    total: base.total_client,
    subtotal: base.subtotal_client,
    impuestos: base.impuestos_client,
    estado: base.estado,
    fecha_pago_proveedor: base.fecha_pago_proveedor,
    costo_total: base.costo_total,
    costo_subtotal: base.costo_subtotal,
    costo_impuestos: base.costo_impuestos,
    fecha_limite_cancelacion: base.fecha_limite_cancelacion,
    created_at: base.created_at,
    updated_at: base.updated_at,
    id_solicitud: base.id_solicitud,
  };

  // Hospedaje
  const hospedaje = {
    id_hospedaje: base.id_hospedaje,
    id_booking: base.id_booking,
    id_hotel: base.id_hotel,
    nombre_hotel: base.nombre_hotel,
    cadena_hotel: base.cadena_hotel,
    codigo_reservacion_hotel: base.codigo_reservacion_hotel,
    tipo_cuarto: base.tipo_cuarto,
    noches: base.noches,
    is_rembolsable: base.is_rembolsable,
    monto_penalizacion: base.monto_penalizacion,
    conciliado: base.conciliado,
    credito: base.credito,
    created_at: base.created_at,
    updated_at: base.updated_at,
  };

  // Agrupar impuestos por item
  const itemsMap = new Map();

  data.forEach((row) => {
    const id = row.id_item;

    if (!itemsMap.has(id)) {
      itemsMap.set(id, {
        id_item: id,
        id_catalogo_item: row.id_catalogo_item,
        id_factura: row.id_factura,
        total: row.total,
        subtotal: row.subtotal,
        impuestos: row.impuestos,
        is_facturado: row.is_facturado,
        fecha_uso: row.fecha_uso,
        id_hospedaje: row.id_hospedaje,
        created_at: row.created_at,
        updated_at: row.updated_at,
        costo_total: row.costo_total,
        costo_subtotal: row.costo_subtotal,
        costo_impuestos: row.costo_impuestos,
        saldo: row.saldo,
        costo_iva: row.costo_iva,
        impuestos_detalle: [],
        pagos: [],
      });
    }

    // Agregar impuesto
    if (row.id_impuesto !== undefined && row.id_impuesto !== null) {
      itemsMap.get(id).impuestos_detalle.push({
        id_impuesto: row.id_impuesto,
        id_item: row.id_item,
        base: row.base,
        total: row.total,
      });
    }

    // Agregar pago
    if (
      row.id_pago !== undefined &&
      row.id_pago !== null &&
      itemsMap.get(id).pagos.length == 0
    ) {
      itemsMap.get(id).pagos.push({
        id_item: row.id_item,
        id_pago: row.id_pago,
        monto: row.monto,
      });
    }
  });

  const items = Array.from(itemsMap.values());

  return {
    booking,
    hospedaje,
    servicio,
    items,
  };
}
