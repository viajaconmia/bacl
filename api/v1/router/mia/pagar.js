// const middleware = require("../../middleware/validateParams");
const router = require("express").Router();
const { validate: isUuid } = require("uuid");
const { executeQuery } = require("../../../../config/db");
const { v4: uuidv4 } = require("uuid");

// router.post("/", middleware.validateParams([]), controller.create);
router.get("/", async (req, res) => {
  try {
    // Escenario 1: La consulta es exitosa.
    let query = `select * from tarjetas;`;
    let response = await executeQuery(query); // <-- El error ocurrirá aquí
    res.status(200).json(
      response.map((tarjeta) => ({
        ...tarjeta,
        activa: Boolean(tarjeta.activa), 
      }))
    );
  } catch (error) {
    // <-- Todos los errores inesperados caen aquí
    // Escenario 2: Algo falló en el 'try'.
    console.error(error);
    res.status(500).json({
      error: "Ocurrió un error al extraer los datos de las tarjetas",
      details: error.message,
    });
  }
});


router.get("/:id", async (req, res) => {
  const { id } = req.params;

  // 2. VALIDAR LA ENTRADA (Manejo de 400 Bad Request para UUID)
  // Verificamos si el 'id' proporcionado es un UUID válido.
  if (!isUuid(id)) {
    return res.status(400).json({
      error: "ID inválido.",
      message: "El ID proporcionado no tiene el formato válido.",
    });
  }

  try {
    // El resto del código es EXACTAMENTE IGUAL
    const query = `SELECT * FROM tarjetas WHERE id = ?;`;
    const results = await executeQuery(query, [id]);

    if (results.length === 0) {
      return res.status(404).json({
        error: "Recurso no encontrado.",
        message: `La tarjeta con el ID '${id}' no existe.`,
      });
    }

    res.status(200).json(
      results.map((tarjeta) => ({
        ...tarjeta,
        activa: Boolean(tarjeta.activa),
      }))[0]
    );
  } catch (error) {
    console.error("Error al consultar la tarjeta por UUID:", error);
    res.status(500).json({
      error: "Error interno del servidor.",
      details: error.message,
    });
  }
});

const FIELDS = new Set([
  "alias",
  "nombre_titular",
  "ultimos_4",
  "numero_completo",
  "banco_emisor",
  "tipo_tarjeta",
  "fecha_vencimiento",
  "activa",
  "cvv",
  "url_identificacion",
]);

const toTinyInt01 = (v) => {
  if (v === true || v === 1 || v === "1" || v === "true") return 1;
  if (v === false || v === 0 || v === "0" || v === "false") return 0;
  return 0;
};

const computeLast4 = (numero_completo) => {
  if (numero_completo == null) return null;
  const digits = String(numero_completo).replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
};

/* =========================
   INSERT
   POST /tarjetas
   - Si no mandas id, se genera uuidv4()
   - Inserta solo campos permitidos que vengan en req.body
   - Si mandas numero_completo y NO mandas ultimos_4, lo calcula
========================= */
router.post("/", async (req, res) => {
  try {
    let { id, ...body } = req.body || {};

    // id opcional: si viene, valida; si no, genera
    if (id !== undefined && id !== null && id !== "") {
      if (!isUuid(id)) {
        return res.status(400).json({
          error: "ID inválido.",
          message: "El 'id' proporcionado no tiene formato UUID válido.",
        });
      }
    } else {
      id = uuidv4();
    }

    // Autocalcular ultimos_4 si aplica
    if (body.numero_completo !== undefined && body.ultimos_4 === undefined) {
      const last4 = computeLast4(body.numero_completo);
      if (last4) body.ultimos_4 = last4;
    }

    const cols = ["id"];
    const placeholders = ["?"];
    const values = [id];

    for (const [key, value] of Object.entries(body)) {
      if (!FIELDS.has(key)) continue;
      if (value === undefined) continue;

      cols.push(key);
      placeholders.push("?");

      if (key === "activa") values.push(toTinyInt01(value));
      else values.push(value);
    }

    if (cols.length === 1) {
      return res.status(400).json({
        error: "Datos insuficientes.",
        message: "Envía al menos un campo válido para insertar.",
      });
    }

    const insertQuery = `INSERT INTO tarjetas (${cols.join(", ")}) VALUES (${placeholders.join(", ")});`;
    await executeQuery(insertQuery, values);

    const rows = await executeQuery(`SELECT * FROM tarjetas WHERE id = ?;`, [id]);
    const tarjeta = rows?.[0];

    return res.status(201).json({
      message: "Tarjeta creada correctamente.",
      data: tarjeta ? { ...tarjeta, activa: Boolean(tarjeta.activa) } : { id },
    });
  } catch (error) {
    console.error("Error al insertar tarjeta:", error);
    return res.status(500).json({
      error: "Ocurrió un error al crear la tarjeta",
      details: error.message,
    });
  }
});

/* =========================
   UPDATE
   PUT /tarjetas/:id
   - id NO es editable
   - Actualiza solo lo que venga en req.body y sea permitido
   - Si actualizas numero_completo y NO mandas ultimos_4, recalcula ultimos_4
========================= */
router.put("/:id", async (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({
      error: "ID inválido.",
      message: "El ID proporcionado no tiene el formato válido.",
    });
  }

  try {
    const body = req.body || {};

    // Si se actualiza numero_completo sin ultimos_4, lo recalculamos
    const willUpdateNumero = body.numero_completo !== undefined;
    const willUpdateUltimos4 = body.ultimos_4 !== undefined;

    const setParts = [];
    const values = [];

    for (const [key, value] of Object.entries(body)) {
      if (key === "id") continue;        // id no editable
      if (!FIELDS.has(key)) continue;    // ignora campos no permitidos
      if (value === undefined) continue;

      setParts.push(`${key} = ?`);
      values.push(key === "activa" ? toTinyInt01(value) : value);
    }

    if (willUpdateNumero && !willUpdateUltimos4) {
      const last4 = computeLast4(body.numero_completo);
      if (last4) {
        setParts.push(`ultimos_4 = ?`);
        values.push(last4);
      }
    }

    if (setParts.length === 0) {
      return res.status(400).json({
        error: "Sin cambios.",
        message: "No se enviaron campos válidos para actualizar.",
      });
    }

    values.push(id);
    const updateQuery = `UPDATE tarjetas SET ${setParts.join(", ")} WHERE id = ?;`;
    const result = await executeQuery(updateQuery, values);

    if (result?.affectedRows === 0) {
      return res.status(404).json({
        error: "Recurso no encontrado.",
        message: `La tarjeta con el ID '${id}' no existe.`,
      });
    }

    const rows = await executeQuery(`SELECT * FROM tarjetas WHERE id = ?;`, [id]);
    const tarjeta = rows?.[0];

    return res.status(200).json({
      message: "Tarjeta actualizada correctamente.",
      data: tarjeta ? { ...tarjeta, activa: Boolean(tarjeta.activa) } : null,
    });
  } catch (error) {
    console.error("Error al actualizar tarjeta:", error);
    return res.status(500).json({
      error: "Ocurrió un error al actualizar la tarjeta",
      details: error.message,
    });
  }
});

/* =========================
   DELETE
   DELETE /tarjetas/:id
========================= */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({
      error: "ID inválido.",
      message: "El ID proporcionado no tiene el formato válido.",
    });
  }

  try {
    const delQuery = `DELETE FROM tarjetas WHERE id = ?;`;
    const result = await executeQuery(delQuery, [id]);

    if (result?.affectedRows === 0) {
      return res.status(404).json({
        error: "Recurso no encontrado.",
        message: `La tarjeta con el ID '${id}' no existe.`,
      });
    }

    return res.status(200).json({ message: "Tarjeta eliminada correctamente." });
  } catch (error) {
    console.error("Error al eliminar tarjeta:", error);
    return res.status(500).json({
      error: "Ocurrió un error al eliminar la tarjeta",
      details: error.message,
    });
  }
});

module.exports = router;


module.exports = router;
