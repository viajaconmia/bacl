const { API_STRIPE } = require("../../../../config/auth");
const { API_STRIPE_TEST } = require("../../../../config/auth");
const stripe = require("stripe")(API_STRIPE);
const stripeTest = require("stripe")(API_STRIPE_TEST);
const router = require("express").Router();
const { executeTransaction, executeQuery } = require("../../../../config/db");

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
    await stripeTest.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    res.json({ success: true, message: "Se guardo el metodo de pago" });
  } catch (error) {
    console.log(error);
    res.json(error);
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
    const { id_agente, paymentMethodId, amount } = req.body;
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
    const paymentIntent = await stripeTest.paymentIntents.create({
      amount: amount,
      currency: "mxn",
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
    });
    if (paymentIntent.status === "succeeded") {
      res.json({
        success: true,
        message: "Pago procesado exitosamente",
        paymentIntent,
      });
    } else {
      res.json({
        success: false,
        message: "Se guardo el metodo de pago",
        paymentIntent,
      });
    }
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error al procesar el pago", details: error });
  }
});

router.post("/create-user-stripe", async (req, res) => {
  try {
    const { email, id_agente } = req.body;
    const customer = await stripeTest.customers.create({ email });
    const { error } = await executeQuery(
      "INSERT INTO clientes_stripe (id_agente, id_cliente_stripe) VALUES (?, ?)",
      [id_agente, customer.id]
    );
    if (error) {
      throw new Error("Error al almacenar el Log del payment");
    }
    console.log("Agente creado con Customer ID:", customer.id);
    res.json({
      success: true,
      message: "Customer id almacenado correctamente",
    });
  } catch (error) {
    console.log(error);
    res.json(error);
  }
});

router.get("/get-payment-methods", async (req, res) => {
  try {
    const { id_agente } = req.query;
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

    //Consultar métodos de pago en Stripe
    const paymentMethods = await stripeTest.paymentMethods.list({
      customer: customerId,
      type: "card", // Puedes cambiarlo según el tipo de método que necesites
    });

    res.json(paymentMethods.data);
  } catch (error) {
    console.error("Error obteniendo métodos de pago:", error);
    res.status(500).json({ error: "Error en el servidor" });
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

module.exports = router;
