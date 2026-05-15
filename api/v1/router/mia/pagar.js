// const middleware = require("../../middleware/validateParams");
const router = require("express").Router();
const { validate: isUuid } = require("uuid");
const { executeQuery } = require("../../../../config/db");
const { v4: uuidv4 } = require("uuid");

// =========================
// Helpers TITULARES
// =========================
const isPositiveInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
};

const normalizeTitularBody = (body = {}) => {
  // Acepta tanto "Titular" como "titular" por conveniencia
  const titular = body.Titular ?? body.titular;
  const identificacion =
    body.identificacion ?? body.url_identificacion ?? body.identificacion_url;

  return { titular, identificacion };
};

// =========================
// TARJETAS - GET ALL
// =========================
// router.post("/", middleware.validateParams([]), controller.create);
router.get("/", async (req, res) => {
  try {
let query = `
  SELECT *
  FROM tarjetas
  WHERE \`finanzas/operaciones\` IN ('ambos', 'operaciones');
`;    let response = await executeQuery(query);
    res.status(200).json(
      response.map((tarjeta) => ({
        ...tarjeta,
        activa: Boolean(tarjeta.activa),
      })),
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Ocurrió un error al extraer los datos de las tarjetas",
      details: error.message,
    });
  }
});

router.get("/titulares", async (req, res) => {
  try {
    let query = `select * from titular;`;
    let response = await executeQuery(query);
    res.status(200).json(
      response.map((tarjeta) => ({
        ...tarjeta,
        activa: Boolean(tarjeta.activa),
      })),
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Ocurrió un error al extraer los datos de las tarjetas",
      details: error.message,
    });
  }
});

/* =========================================================
   TITULARES
   Nota: Estas rutas van ANTES de router.get("/:id") de tarjetas
   (si no, /titulares se interpreta como :id)
========================================================= */

/* =========================
   INSERT TITULAR
   POST /tarjetas/titulares   (si montas este router en /tarjetas)
   Body:
   - Titular (string, requerido)  o "titular"
   - identificacion (string url, opcional)
========================= */
router.post("/titulares", async (req, res) => {
  try {
    const { titular, identificacion } = normalizeTitularBody(req.body || {});

    if (
      !titular ||
      typeof titular !== "string" ||
      titular.trim().length === 0
    ) {
      return res.status(400).json({
        error: "Datos inválidos.",
        message: "El campo 'Titular' es requerido (string).",
      });
    }

    if (titular.length > 100) {
      return res.status(400).json({
        error: "Datos inválidos.",
        message: "El campo 'Titular' no puede exceder 100 caracteres.",
      });
    }

    if (
      identificacion !== undefined &&
      identificacion !== null &&
      typeof identificacion !== "string"
    ) {
      return res.status(400).json({
        error: "Datos inválidos.",
        message: "El campo 'identificacion' debe ser string (URL) si se envía.",
      });
    }

    const insertQuery = `
      INSERT INTO titular(Titular, identificacion)
      VALUES (?, ?);
    `;
    const result = await executeQuery(insertQuery, [
      titular.trim(),
      identificacion ?? null,
    ]);

    // MySQL típico: result.insertId
    const newId = result?.insertId;

    if (!newId) {
      return res.status(201).json({
        message: "Titular creado correctamente.",
        data: {
          Titular: titular.trim(),
          identificacion: identificacion ?? null,
        },
      });
    }

    const rows = await executeQuery(
      `SELECT * FROM titular WHERE idTitular = ?;`,
      [newId],
    );
    return res.status(201).json({
      message: "Titular creado correctamente.",
      data: rows?.[0] ?? {
        idTitular: newId,
        Titular: titular.trim(),
        identificacion: identificacion ?? null,
      },
    });
  } catch (error) {
    console.error("Error al insertar titular:", error);
    return res.status(500).json({
      error: "Ocurrió un error al crear el titular",
      details: error.message,
    });
  }
});

/* =========================
   UPDATE TITULAR
   PUT /tarjetas/titulares/:idTitular
   Body:
   - Titular (string, opcional) o "titular"
   - identificacion (string url, opcional)
========================= */
router.put("/titulares/:idTitular", async (req, res) => {
  const { idTitular } = req.params;

  if (!isPositiveInt(idTitular)) {
    return res.status(400).json({
      error: "ID inválido.",
      message: "El 'idTitular' debe ser un entero positivo.",
    });
  }

  try {
    const { titular, identificacion } = normalizeTitularBody(req.body || {});
    const setParts = [];
    const values = [];

    if (titular !== undefined) {
      if (typeof titular !== "string" || titular.trim().length === 0) {
        return res.status(400).json({
          error: "Datos inválidos.",
          message: "Si envías 'Titular', debe ser un string no vacío.",
        });
      }
      if (titular.length > 100) {
        return res.status(400).json({
          error: "Datos inválidos.",
          message: "El campo 'Titular' no puede exceder 100 caracteres.",
        });
      }
      setParts.push("Titular = ?");
      values.push(titular.trim());
    }

    if (identificacion !== undefined) {
      if (identificacion !== null && typeof identificacion !== "string") {
        return res.status(400).json({
          error: "Datos inválidos.",
          message: "Si envías 'identificacion', debe ser string (URL) o null.",
        });
      }
      setParts.push("identificacion = ?");
      values.push(identificacion ?? null);
    }

    if (setParts.length === 0) {
      return res.status(400).json({
        error: "Sin cambios.",
        message: "No se enviaron campos válidos para actualizar.",
      });
    }

    values.push(Number(idTitular));
    const updateQuery = `UPDATE titular SET ${setParts.join(", ")} WHERE idTitular = ?;`;
    const result = await executeQuery(updateQuery, values);

    if (result?.affectedRows === 0) {
      return res.status(404).json({
        error: "Recurso no encontrado.",
        message: `El titular con idTitular '${idTitular}' no existe.`,
      });
    }

    const rows = await executeQuery(
      `SELECT * FROM titular WHERE idTitular = ?;`,
      [Number(idTitular)],
    );
    return res.status(200).json({
      message: "Titular actualizado correctamente.",
      data: rows?.[0] ?? null,
    });
  } catch (error) {
    console.error("Error al actualizar titular:", error);
    return res.status(500).json({
      error: "Ocurrió un error al actualizar el titular",
      details: error.message,
    });
  }
});

/* =========================
   DELETE TITULAR
   DELETE /tarjetas/titulares/:idTitular
========================= */
router.delete("/titulares/:idTitular", async (req, res) => {
  const { idTitular } = req.params;

  if (!isPositiveInt(idTitular)) {
    return res.status(400).json({
      error: "ID inválido.",
      message: "El 'idTitular' debe ser un entero positivo.",
    });
  }

  try {
    const delQuery = `DELETE FROM titular WHERE idTitular = ?;`;
    const result = await executeQuery(delQuery, [Number(idTitular)]);

    if (result?.affectedRows === 0) {
      return res.status(404).json({
        error: "Recurso no encontrado.",
        message: `El titular con idTitular '${idTitular}' no existe.`,
      });
    }

    return res
      .status(200)
      .json({ message: "Titular eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar titular:", error);
    return res.status(500).json({
      error: "Ocurrió un error al eliminar el titular",
      details: error.message,
    });
  }
});

// =========================
// FINANZAS - GET (solo tarjetas accesibles por finanzas)
// =========================
router.get("/finanzas", async (req, res) => {
  try {
    const query = `
      SELECT *
      FROM tarjetas;
    `;
    const response = await executeQuery(query);
    res.status(200).json(
      response.map((t) => ({
        ...t,
        activa: Boolean(t.activa),
        activa_finanzas: Boolean(t.activa_finanzas),
      })),
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error al obtener tarjetas de finanzas",
      details: error.message,
    });
  }
});

// =========================
// FINANZAS - PATCH activa_finanzas
// PATCH /finanzas/:id/activa   Body: { activa_finanzas: true | false }
// =========================
router.patch("/finanzas/:id/activa", async (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({ error: "ID inválido." });
  }

  const valor = req.body?.activa_finanzas;
  if (valor === undefined) {
    return res.status(400).json({
      error: "Falta campo.",
      message: "Envía { activa_finanzas: true | false }.",
    });
  }

  const { user } = req.session;
  const id_user = user?.id ?? null;

  try {
    const nuevoValor = toTinyInt01(valor);
    const textoCambio = nuevoValor === 1
      ? "Activó uso de finanzas"
      : "Desactivó uso de finanzas";

    const result = await executeQuery(
      "UPDATE tarjetas SET activa_finanzas = ?, user_edit = ?, cambios = ? WHERE id = ?",
      [nuevoValor, id_user, textoCambio, id],
    );

    if (result?.affectedRows === 0) {
      return res.status(404).json({ error: "Tarjeta no encontrada." });
    }

    const rows = await executeQuery("SELECT * FROM tarjetas WHERE id = ?", [id]);
    const t = rows[0];
    return res.status(200).json({
      message: "activa_finanzas actualizada.",
      data: { ...t, activa: Boolean(t.activa), activa_finanzas: Boolean(t.activa_finanzas) },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error al actualizar activa_finanzas",
      details: error.message,
    });
  }
});

// =========================
// FINANZAS - PATCH finanzas/operaciones
// PATCH /finanzas/:id/tipo   Body: { tipo: 'finanzas' | 'operaciones' | 'ambos' | 'ninguno' }
// =========================
const TIPO_ENUM = new Set(["finanzas", "operaciones", "ambos", "ninguno"]);

router.patch("/finanzas/:id/tipo", async (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({ error: "ID inválido." });
  }

  const tipo = req.body?.tipo;
  if (!tipo || !TIPO_ENUM.has(tipo)) {
    return res.status(400).json({
      error: "Valor inválido.",
      message: `'tipo' debe ser uno de: ${[...TIPO_ENUM].join(", ")}`,
    });
  }

  const { user } = req.session;
  const id_user = user?.id ?? null;

  try {
    const current = await executeQuery(
      "SELECT `finanzas/operaciones` FROM tarjetas WHERE id = ?",
      [id],
    );
    if (!current.length) {
      return res.status(404).json({ error: "Tarjeta no encontrada." });
    }
    const tipoAnterior = current[0]?.["finanzas/operaciones"] ?? "—";
    const textoCambio = `Cambió permiso de '${tipoAnterior}' a '${tipo}'`;

    const result = await executeQuery(
      "UPDATE tarjetas SET `finanzas/operaciones` = ?, user_edit = ?, cambios = ? WHERE id = ?",
      [tipo, id_user, textoCambio, id],
    );

    if (result?.affectedRows === 0) {
      return res.status(404).json({ error: "Tarjeta no encontrada." });
    }

    const rows = await executeQuery("SELECT * FROM tarjetas WHERE id = ?", [id]);
    const t = rows[0];
    return res.status(200).json({
      message: "Tipo actualizado.",
      data: { ...t, activa: Boolean(t.activa), activa_finanzas: Boolean(t.activa_finanzas) },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error al actualizar tipo",
      details: error.message,
    });
  }
});

// =========================
// FINANZAS - PUT (editar tarjeta, incluye campos de finanzas)
// =========================
const FINANZAS_FIELDS = new Set([
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
  "activa_finanzas",
  "finanzas/operaciones",
  "user_created",
  "user_edit",
  "cambios",
]);

router.put("/finanzas/:id", async (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({ error: "ID inválido." });
  }

  const { user } = req.session;
  const id_user = user?.id ?? null;

  try {
    const body = req.body || {};
    const setParts = [];
    const values = [];
    const camposEditados = [];

    for (const [key, value] of Object.entries(body)) {
      if (key === "id" || key === "user_edit" || key === "cambios" || !FINANZAS_FIELDS.has(key) || value === undefined) continue;
      setParts.push(`\`${key}\` = ?`);
      if (key === "activa" || key === "activa_finanzas") values.push(toTinyInt01(value));
      else values.push(value);
      camposEditados.push(key);
    }

    if (body.numero_completo !== undefined && body.ultimos_4 === undefined) {
      const last4 = computeLast4(body.numero_completo);
      if (last4) { setParts.push("ultimos_4 = ?"); values.push(last4); }
    }

    if (!setParts.length) {
      return res.status(400).json({ error: "No hay campos válidos para actualizar." });
    }

    // Auditoría
    setParts.push("user_edit = ?");
    values.push(id_user);
    setParts.push("cambios = ?");
    values.push(`Editó: ${camposEditados.join(", ")}`);

    values.push(id);
    const result = await executeQuery(
      `UPDATE tarjetas SET ${setParts.join(", ")} WHERE id = ?`,
      values,
    );

    if (result?.affectedRows === 0) {
      return res.status(404).json({ error: "Tarjeta no encontrada." });
    }

    const rows = await executeQuery("SELECT * FROM tarjetas WHERE id = ?", [id]);
    const t = rows[0];
    return res.status(200).json({
      message: "Tarjeta actualizada.",
      data: { ...t, activa: Boolean(t.activa), activa_finanzas: Boolean(t.activa_finanzas) },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error al actualizar tarjeta",
      details: error.message,
    });
  }
});

// =========================
// FINANZAS - DELETE
// =========================
router.delete("/finanzas/:id", async (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({ error: "ID inválido." });
  }

  try {
    const result = await executeQuery("DELETE FROM tarjetas WHERE id = ?", [id]);

    if (result?.affectedRows === 0) {
      return res.status(404).json({ error: "Tarjeta no encontrada." });
    }

    return res.status(200).json({ message: "Tarjeta eliminada." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error al eliminar tarjeta",
      details: error.message,
    });
  }
});

// =========================
// TARJETAS - GET BY UUID
// =========================
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({
      error: "ID inválido.",
      message: "El ID proporcionado no tiene el formato válido.",
    });
  }

  try {
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
      }))[0],
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
  "activa_finanzas",
  "finanzas/operaciones",
  "user_created",
  "user_edit",
  "cambios",
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
   INSERT TARJETA
   POST /tarjetas
========================= */
router.post("/", async (req, res) => {
  try {
    const { user } = req.session;
    const id_user = user?.id ?? null;

    let { id, ...body } = req.body || {};

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
      if (key === "user_created" || key === "user_edit" || key === "cambios") continue;

      cols.push(key);
      placeholders.push("?");

      if (key === "activa" || key === "activa_finanzas") values.push(toTinyInt01(value));
      else values.push(value);
    }

    // Auditoría: user_created desde sesión
    if (id_user !== null) {
      cols.push("user_created");
      placeholders.push("?");
      values.push(id_user);
    }

    if (cols.length === 1) {
      return res.status(400).json({
        error: "Datos insuficientes.",
        message: "Envía al menos un campo válido para insertar.",
      });
    }

    const insertQuery = `INSERT INTO tarjetas (${cols.join(", ")}) VALUES (${placeholders.join(", ")});`;
    await executeQuery(insertQuery, values);

    const rows = await executeQuery(`SELECT * FROM tarjetas WHERE id = ?;`, [
      id,
    ]);
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
   UPDATE TARJETA
   PUT /tarjetas/:id
========================= */
router.put("/:id", async (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({
      error: "ID inválido.",
      message: "El ID proporcionado no tiene el formato válido.",
    });
  }

  const { user } = req.session;
  const id_user = user?.id ?? null;

  try {
    const body = req.body || {};

    const willUpdateNumero = body.numero_completo !== undefined;
    const willUpdateUltimos4 = body.ultimos_4 !== undefined;

    const setParts = [];
    const values = [];
    const camposEditados = [];

    for (const [key, value] of Object.entries(body)) {
      if (key === "id" || key === "user_edit" || key === "cambios") continue;
      if (!FIELDS.has(key)) continue;
      if (value === undefined) continue;

      setParts.push(`\`${key}\` = ?`);
      values.push(key === "activa" || key === "activa_finanzas" ? toTinyInt01(value) : value);
      camposEditados.push(key);
    }

    if (willUpdateNumero && !willUpdateUltimos4) {
      const last4 = computeLast4(body.numero_completo);
      if (last4) {
        setParts.push("ultimos_4 = ?");
        values.push(last4);
      }
    }

    if (setParts.length === 0) {
      return res.status(400).json({
        error: "Sin cambios.",
        message: "No se enviaron campos válidos para actualizar.",
      });
    }

    // Auditoría
    setParts.push("user_edit = ?");
    values.push(id_user);
    setParts.push("cambios = ?");
    values.push(`Editó: ${camposEditados.join(", ")}`);

    values.push(id);
    const updateQuery = `UPDATE tarjetas SET ${setParts.join(", ")} WHERE id = ?;`;
    const result = await executeQuery(updateQuery, values);

    if (result?.affectedRows === 0) {
      return res.status(404).json({
        error: "Recurso no encontrado.",
        message: `La tarjeta con el ID '${id}' no existe.`,
      });
    }

    const rows = await executeQuery(`SELECT * FROM tarjetas WHERE id = ?;`, [
      id,
    ]);
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
   DELETE TARJETA
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

    return res
      .status(200)
      .json({ message: "Tarjeta eliminada correctamente." });
  } catch (error) {
    console.error("Error al eliminar tarjeta:", error);
    return res.status(500).json({
      error: "Ocurrió un error al eliminar la tarjeta",
      details: error.message,
    });
  }
});

module.exports = router;
