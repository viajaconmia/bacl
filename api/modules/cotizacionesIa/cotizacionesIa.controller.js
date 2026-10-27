const service = require("./cotizacionesIa.service");
const { CustomError } = require("../../../middleware/errorHandler");

// Respuesta de error con la forma estándar de bacl: { message, data, error: { code, message, details } }.
// Un error inesperado (p. ej. de la BD) no filtra su mensaje al cliente.
const sendError = (res, error) => {
  if (error instanceof CustomError) {
    return res.status(error.statusCode).json({
      message: error.message,
      data: null,
      error: { code: error.errorCode, message: error.message, details: error.details },
    });
  }
  console.error("Error en cotizaciones-ia:", error);
  const message = "Ocurrió un error inesperado";
  return res.status(500).json({
    message,
    data: null,
    error: { code: "INTERNAL_SERVER_ERROR", message },
  });
};

const create = async (req, res) => {
  try {
    const data = await service.create(req.body ?? {});
    return res.status(201).json({
      message: "Cotización creada correctamente",
      data,
      metadata: null,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const getAll = async (req, res) => {
  try {
    const { estado, tipo, q, page, length } = req.query;
    const { rows, total, hasPagination } = await service.getAll({
      estado,
      tipo,
      q,
      page,
      length,
    });
    return res.status(200).json({
      message: "Cotizaciones obtenidas correctamente",
      data: rows,
      metadata: hasPagination ? { total } : null,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id);
    return res.status(200).json({
      message: "Cotización obtenida correctamente",
      data,
      metadata: null,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const getArchivoUrl = async (req, res) => {
  try {
    const data = await service.getArchivoUrl(req.params.id, req.params.idArchivo);
    return res.status(200).json({
      message: "Enlace del archivo generado correctamente",
      data,
      metadata: null,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

module.exports = { create, getAll, getById, getArchivoUrl };
