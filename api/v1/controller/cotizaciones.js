const { executeQuery } = require("../../../config/db");

const getCorreosProcesados = async (req, res) => {
  let { page, length } = req.query;

  page = page ? Number(page) : null;
  length = length ? Number(length) : null;

  if (page !== null && (!Number.isInteger(page) || page < 1)) {
    return res.status(400).json({ message: "El parámetro 'page' debe ser un entero mayor a 0" });
  }
  if (length !== null && (!Number.isInteger(length) || length < 1)) {
    return res.status(400).json({ message: "El parámetro 'length' debe ser un entero mayor a 0" });
  }
  if ((page && !length) || (!page && length)) {
    return res.status(400).json({ message: "Debes enviar 'page' y 'length' juntos para usar paginación" });
  }

  const hasPagination = page && length;
  const offset = hasPagination ? (page - 1) * length : null;

  const where = [];
  const params = [];

  /* =========================
     FILTROS
  ==========================*/

  // ID correo
  if (req.query.id_correo) {
    where.push(`cp.id_correo LIKE CONCAT('%', ?, '%')`);
    params.push(req.query.id_correo);
  }

  // Thread ID
  if (req.query.thread_id) {
    where.push(`cp.thread_id LIKE CONCAT('%', ?, '%')`);
    params.push(req.query.thread_id);
  }

  // Subject
  if (req.query.subject) {
    where.push(`cp.subject LIKE CONCAT('%', ?, '%')`);
    params.push(req.query.subject);
  }

  // From email
  if (req.query.from_email) {
    where.push(`cp.from_email LIKE CONCAT('%', ?, '%')`);
    params.push(req.query.from_email);
  }

  // Status
  if (req.query.status) {
    where.push(`cp.status = ?`);
    params.push(req.query.status);
  }

  // Procesado (0 o 1)
  if (req.query.procesado !== undefined) {
    const procesadoVal = Number(req.query.procesado);
    if (![0, 1].includes(procesadoVal)) {
      return res.status(400).json({ message: "El parámetro 'procesado' debe ser 0 o 1" });
    }
    where.push(`cp.procesado = ?`);
    params.push(procesadoVal);
  }

  /* =========================
     FILTRO DE FECHA DINÁMICO
  ==========================*/
  const { startDate, endDate, filterType } = req.query;

  if (startDate || endDate) {
    let column = "created_at";

    if (filterType) {
      const type = filterType.toLowerCase();
      if (type === "procesado") column = "fecha_procesado";
      if (type === "updated") column = "updated_at";
      if (type === "created") column = "created_at";
    }

    if (startDate && endDate) {
      where.push(`cp.${column} >= ? AND cp.${column} <= ?`);
      params.push(startDate + " 00:00:00", endDate + " 23:59:59");
    } else if (startDate) {
      where.push(`cp.${column} >= ?`);
      params.push(startDate + " 00:00:00");
    } else {
      where.push(`cp.${column} <= ?`);
      params.push(endDate + " 23:59:59");
    }
  }

  const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sqlTotal = `
    SELECT COUNT(*) AS total
    FROM correos_procesados cp
    ${whereSQL}
  `;

  const sqlData = `
    SELECT cp.*
    FROM correos_procesados cp
    ${whereSQL}
    ORDER BY cp.created_at DESC
    ${hasPagination ? `LIMIT ${length} OFFSET ${offset}` : ""}
  `;

  try {
    const [data, totalResult] = await Promise.all([
      executeQuery(sqlData, [...params]),
      executeQuery(sqlTotal, [...params]),
    ]);

    const [{ total }] = totalResult;

    res.status(200).json({
      message: "ok",
      data,
      metadata: { page, length, total },
    });
  } catch (error) {
    console.error("[cotizaciones] getCorreosProcesados error:", error);
    res
      .status(error.statusCode || error.status || 500)
      .json({ error, message: error.message || "Error al obtener los correos procesados" });
  }
};

module.exports = { getCorreosProcesados };
