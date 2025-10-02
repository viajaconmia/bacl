const { API_STRIPE } = require("../../../../config/auth");
const { API_STRIPE_TEST } = require("../../../../config/auth");
const express = require("express");
const stripe = require("stripe")(API_STRIPE);
const stripeTest = require("stripe")(API_STRIPE_TEST);
const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const {
  executeTransaction,
  executeQuery,
  runTransaction,
} = require("../../../../config/db");
const {
  CustomError,
  ShortError,
} = require("../../../../middleware/errorHandler");
const { calcularPrecios } = require("../../../../lib/utils/calculates");

router.post("/create-checkout-session", async (req, res) => {
  try {
    const { payment_data } = req.body;
    const session = await stripeTest.checkout.sessions.create(payment_data);
    res.json(session);
  } catch (error) {
    console.log(error);
    res.json(error);
  }
});
router.post("/save-payment-method", async (req, res) => {
  try {
    const { id_agente, paymentMethodId } = req.body;

    if (!id_agente || !paymentMethodId)
      throw new CustomError(
        "Falta un parametro",
        400,
        "MISSING",
        Object.entries(req.body).filter(([, value]) => !!value)
      );

    const rows = await executeQuery(
      "SELECT id_cliente_stripe FROM clientes_stripe WHERE id_agente = ?;",
      [id_agente]
    );

    if (rows.length === 0)
      throw new CustomError(
        "No se encontro el cliente de stripe para este agente",
        404,
        "NOT_FOUND",
        null
      );

    const customerId = rows[0].id_cliente_stripe;

    //Guardar metodo de pago en el cliente
    await stripeTest.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    res
      .status(204)
      .json({ message: "Se guardo el metodo de pago", data: null });
  } catch (error) {
    console.log("Este es el error", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.details,
      message: error.message,
      data: null,
    });
  }
});
router.post("/delete-payment-method", async (req, res) => {
  try {
    const { id_agente, paymentMethodId } = req.body;
    // Consultar el `customer_id` de la base de datos
    const [rows] = await executeQuery(
      "SELECT id_cliente_stripe FROM clientes_stripe WHERE id_agente = ?;",
      [id_agente]
    ).catch((err) => {
      console.error("Database query error:", err);
      throw new Error("Database connection error");
    });

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Cliente de Stripe no encontrado para este agente" });
    }

    const customerId = rows.id_cliente_stripe;

    //Guardar metodo de pago en el cliente
    await stripeTest.paymentMethods.detach(paymentMethodId);

    res.json({ success: true, message: "Se elimino el metodo de pago" });
  } catch (error) {
    console.log(error);
    res.json(error);
  }
});
router.post("/make-payment", async (req, res) => {
  try {
    /* INICIA VALIDACION DE DATOS */
    const { id_agente, paymentMethodId, amount, id_viajero, card, itemsCart } =
      req.body;
    if (!id_agente || !paymentMethodId || !amount || !id_viajero) {
      throw new CustomError("Faltan parametros", 400, "MISSING_PARAMS", {
        id_agente,
        paymentMethodId,
        amount,
        id_viajero,
      });
    }

    //Obtenemos el cliente de stripe
    const rows = await executeQuery(
      "SELECT id_cliente_stripe FROM clientes_stripe WHERE id_agente = ?;",
      [id_agente]
    );
    if (rows.length === 0)
      throw new ShortError("No se encontro el cliente de stripe", 404);
    const customerId = rows[0].id_cliente_stripe;

    const ids_solicitudes = itemsCart.map((item) => item.details.id_solicitud);
    const solicitudes = await executeQuery(
      `SELECT * FROM solicitudes where id_solicitud in (${ids_solicitudes
        .map((id) => "?")
        .join(",")})`,
      ids_solicitudes
    );

    const totalSolicitudes = solicitudes.reduce(
      (prev, current) => prev + Number(current.total),
      0
    );
    console.log(
      Number(totalSolicitudes.toFixed(2)),
      Number(amount.toFixed()) / 100,
      Number(amount.toFixed()) / 100 - Number(totalSolicitudes.toFixed(2))
    );
    if (
      Number(amount.toFixed()) / 100 - Number(totalSolicitudes.toFixed(2)) <=
      -2
    )
      throw new Error("Ha ocurrido un error, intenta de nuevo mas tarde");

    /* TERMINA VALIDACION DE DATOS */

    /* INICIA TRANSACTION DE ACCIONES */
    const response = await runTransaction(async (conn) => {
      try {
        /* INICIA PAGO Y GUARDADO DE LOG */

        const paymentIntent = await stripeTest.paymentIntents.create({
          amount: Number(amount.toFixed(0)),
          currency: "mxn",
          customer: customerId,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
        });
        const query_add_strippe_log =
          "INSERT INTO stripe_logs (request, response, precio, id_viajero, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW());";
        const params_add_stripe_log = [
          JSON.stringify(req.body),
          JSON.stringify(paymentIntent),
          amount / 100,
          id_viajero,
        ];
        await conn.execute(query_add_strippe_log, params_add_stripe_log);
        /* TERMINA PAGO Y GUARDADO DE LOG */

        /* INICIA EL GUARDADO EN LA BASE DEDATOS Y LA ASIGNACIóN DE SERVICIO */
        const id_servicio = `ser-${uuidv4()}`;
        const precio_venta = calcularPrecios(amount / 100);
        const query_create_service = `
    INSERT INTO servicios
    (id_servicio, id_agente, total, subtotal, impuestos) VALUES (?, ?, ?, ?,?)`;
        const params_create_service = [
          id_servicio,
          id_agente,
          precio_venta.total,
          precio_venta.subtotal,
          precio_venta.impuestos,
        ];
        await conn.execute(query_create_service, params_create_service);

        const id_pago = `pag-${uuidv4()}`;
        const id_transaccion = uuidv4();
        const query_agregar_pago = `
      INSERT INTO pagos
      (
        id_pago,
        id_servicio,
        responsable_pago_agente,
        fecha_creacion,
        total,
        subtotal,
        impuestos,
        concepto,
        fecha_pago,
        banco,
        autorizacion_stripe,
        last_digits,
        fecha_transaccion,
        currency,
        metodo_de_pago,
        tipo_de_tarjeta,
        tipo_de_pago,
        id_agente,
        transaccion,
        monto_transaccion
      ) 
      VALUES (?,?,?,NOW(),?,?,?,?,NOW(),?,?,?,NOW(),?,?,?,?,?,?,?)`;

        const params_agregar_pago = [
          id_pago,
          id_servicio, // Requerido de la relación con servicios
          id_viajero || null, // Requerido
          precio_venta.total || "0",
          precio_venta.subtotal || "0",
          precio_venta.impuestos || "0",
          `Ejecución de pago por los servicios con el id: ${
            id_servicio || "Error al obtener el id"
          }`,
          card.brand || "",
          paymentIntent.client_secret,
          card.last4 || null,
          "mxn",
          "tarjeta",
          card.funding || null,
          "contado",
          id_agente,
          id_transaccion,
          precio_venta.total || "0",
        ];

        await conn.execute(query_agregar_pago, params_agregar_pago);

        const ids_carrito = itemsCart.map((item) => item.id);

        await Promise.all(
          ids_solicitudes.map((id) =>
            conn.execute(
              `UPDATE solicitudes SET id_servicio = ? WHERE id_solicitud = ?`,
              [id_servicio, id]
            )
          )
        );
        await Promise.all(
          ids_carrito.map((id) =>
            conn.execute(`UPDATE cart SET active = 0 WHERE id = ?`, [id], [id])
          )
        );

        return { paymentIntent };
      } catch (error) {
        throw new CustomError(
          error.message || "Error al intentar hacer el pago",
          error.status || error.statusCode || 500,
          "CREATE_PAYMENT_ERROR",
          error
        );
      }
    });

    res.status(200).json({
      message: "Pago procesado exitosamente",
      data: response,
    });
  } catch (error) {
    console.log("Este es el error", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.details || null,
      message: error.message,
      data: null,
    });
  }
});
// router.post("/create-user-stripe", async (req, res) => {
//   try {
//     const { email, id_agente } = req.body;
//     const customer = await stripeTest.customers.create({ email });
//     const { error } = await executeQuery(
//       "INSERT INTO clientes_stripe (id_agente, id_cliente_stripe) VALUES (?, ?)",
//       [id_agente, customer.id]
//     );
//     if (error) {
//       throw new Error("Error al almacenar el Log del payment");
//     }
//     console.log("Agente creado con Customer ID:", customer.id);
//     res.json({
//       success: true,
//       message: "Customer id almacenado correctamente",
//     });
//   } catch (error) {
//     console.log(error);
//     res.json(error);
//   }
// });
router.get("/get-payment-methods", async (req, res) => {
  try {
    const { id_agente } = req.query;
    if (!id_agente)
      throw new CustomError("Falta el id del agente", 404, "MISSING_PARAMS", {
        id_agente,
      });

    // Consultar el `customer_id` de la base de datos
    const rows = await executeQuery(
      "SELECT id_cliente_stripe FROM clientes_stripe WHERE id_agente = ?;",
      [id_agente]
    );

    if (rows.length === 0)
      throw new CustomError(
        "No se encontro el cliente de stripe para este agente",
        404,
        "NOT_FOUND",
        null
      );

    const customerId = rows[0].id_cliente_stripe;

    //Consultar métodos de pago en Stripe
    const paymentMethods = await stripeTest.paymentMethods.list({
      customer: customerId,
      type: "card", // Puedes cambiarlo según el tipo de método que necesites
    });

    res.status(200).json({
      message: "Tarjetas obtenidas con exito",
      data: paymentMethods.data,
    });
  } catch (error) {
    console.log("Este es el error", error.message);
    return res.status(error.statusCode || error.status || 500).json({
      error: error.details || error,
      message: error.message || "",
      data: null,
    });
  }
});
router.post("/create-setup-intent", async (req, res) => {
  try {
    const { id_agente } = req.body;
    if (!id_agente) {
      return res.status(400).json({ error: "Falta el parámetro id_agente" });
    }

    // Consultar el `customer_id` de la base de datos
    const [rows] = await executeQuery(
      "SELECT id_cliente_stripe FROM clientes_stripe WHERE id_agente = ?;",
      [id_agente]
    ).catch((err) => {
      console.error("Database query error:", err);
      throw new Error("Database connection error");
    });

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Cliente de Stripe no encontrado para este agente" });
    }
    console.log(rows);
    const customerId = rows.id_cliente_stripe;

    const setupIntent = await stripeTest.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
    });
    console.log(setupIntent);
    res.json({ client_secret: setupIntent.client_secret });
  } catch (error) {
    console.error("Error creating setup intent:", error);
    res.status(500).json({ error: "Error al crear Setup Intent" });
  }
});
router.get("/get-checkout-session", async (req, res) => {
  try {
    const { id_checkout } = req.query;
    const checkout = await stripeTest.checkout.sessions.retrieve(id_checkout);
    console.log(checkout);
    res.json(checkout);
  } catch (error) {
    console.log(error);
  }
});
router.post("/create-payment-intent-card", async (req, res) => {
  try {
    const { amount, currency, id_viajero } = req.body;
    console.log(amount);
    console.log(currency);
    const paymentIntent = await stripeTest.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ["card"], // Tarjetas de crédito/débito
    });
    const query =
      "INSERT INTO stripe_logs (request, response, precio, id_viajero, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW());";
    const params = [
      JSON.stringify(req.body),
      JSON.stringify(paymentIntent),
      amount / 100,
      id_viajero,
    ];
    const { error } = await executeQuery(query, params);
    if (error) {
      throw new Error("Error al almacenar el Log de payment intent");
    }

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post("/payment-log-storage", async (req, res) => {
  try {
    const { amount, id_viajero, response_payment } = req.body;
    console.log(amount);
    console.log(response_payment);

    const query =
      "INSERT INTO stripe_logs (request, response, precio, id_viajero, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW());";
    const params = [
      JSON.stringify(req.body),
      JSON.stringify(response_payment),
      amount / 100,
      id_viajero,
    ];
    const { error } = await executeQuery(query, params);
    if (error) {
      throw new Error("Error al almacenar el Log del payment");
    }

    res.json({ success: true, message: "Log almacenado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post("/create-payment-link", async (req, res) => {
  try {
    const { amount, currency, metadata, description } = req.body;

    // Primero crea un precio
    const price = await stripe.prices.create({
      unit_amount: amount,
      currency: currency,
      product_data: {
        name: `Saldo a favor: ${description}`,
      },
    });

    // Luego crea el payment link con el price ID
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price: price.id, // Usa el ID del precio creado
          quantity: 1,
        },
      ],
      metadata: metadata,
    });

    res.status(200).json({
      url: paymentLink.url,
      id: paymentLink.id,
    });
  } catch (error) {
    console.error("Error creating payment link:", error);
    res.status(500).json({
      message: "Error creating payment link",
      error: error.message,
    });
  }
});
router.post(
  "/payment-links-hook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        "whsec_nau4uGg351SWXP1PJAqhPUdRMqznaWZ9"
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;
        const query =
          "UPDATE saldos SET estado_link = ?, fecha_procesamiento = ? WHERE id_saldo = ?;";
        const params = [
          "completed",
          new Date().toISOString(),
          session.metadata.saldo_id,
        ];
        // Actualiza tu base de datos
        await executeQuery(query, params);
        break;

      case "checkout.session.expired":
        const expiredSession = event.data.object;
        await updateSaldo(expiredSession.metadata.saldo_id, {
          estado: "expired",
        });
        break;

      case "payment_intent.payment_failed":
        const failedPayment = event.data.object;
        // Puedes notificar al admin o cliente
        break;

      default:
        console.log(`Evento no manejado: ${event.type}`);
    }

    res.json({ received: true });
  }
);

module.exports = router;

const objeto_muestra = {
  paymentIntent: {
    id: "pi_3S07pHA3jkUyZycM1FAXco7v",
    object: "payment_intent",
    amount: 1429700,
    amount_capturable: 0,
    amount_details: {
      tip: {},
    },
    amount_received: 1429700,
    application: null,
    application_fee_amount: null,
    automatic_payment_methods: {
      allow_redirects: "always",
      enabled: true,
    },
    canceled_at: null,
    cancellation_reason: null,
    capture_method: "automatic_async",
    client_secret:
      "pi_3S07pHA3jkUyZycM1FAXco7v_secret_GrmRwe7l0B8sDWZ02GNRTEIit",
    confirmation_method: "automatic",
    created: 1756156875,
    currency: "mxn",
    customer: "cus_SulbamdbUeYKRy",
    description: null,
    excluded_payment_method_types: null,
    invoice: null,
    last_payment_error: null,
    latest_charge: "ch_3S07pHA3jkUyZycM1Kp8V1Qr",
    livemode: false,
    metadata: {},
    next_action: null,
    on_behalf_of: null,
    payment_method: "pm_1Rz1i5A3jkUyZycMy5zwOYfe",
    payment_method_configuration_details: {
      id: "pmc_1Qye8MA3jkUyZycMP3vfEvaz",
      parent: null,
    },
    payment_method_options: {
      card: {
        installments: {
          available_plans: [],
          enabled: false,
          plan: null,
        },
        mandate_options: null,
        network: null,
        request_three_d_secure: "automatic",
      },
      link: {
        persistent_token: null,
      },
    },
    payment_method_types: ["card", "link"],
    processing: null,
    receipt_email: null,
    review: null,
    setup_future_usage: null,
    shipping: null,
    source: null,
    statement_descriptor: null,
    statement_descriptor_suffix: null,
    status: "succeeded",
    transfer_data: null,
    transfer_group: null,
  },
};
