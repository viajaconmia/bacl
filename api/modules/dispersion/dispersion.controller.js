const { runTransaction } = require("../../../config/db");
const dispersionService = require("./dispersion.service");

const create = async (req, res) => {
  try {
    const result = await runTransaction((conn) =>
      dispersionService.createDispersion(req.body, conn),
    );
    const correo_enviado =
      await dispersionService.notifyDispersionCreated(result);

    return res.status(200).json({
      data: { ...result, correo_enviado },
      metadata: null,
      message: "Dispersión creada y registros guardados correctamente",
    });
  } catch (error) {
    console.error("Error en dispersion.create:", error);
    return res.status(error.statusCode ?? 500).json({
      error: error.message,
      details: error.details,
    });
  }
};

const getAll = async (req, res) => {
  const {
    codigo_dispersion,
    fecha_pago_inicio,
    fecha_pago_fin,
    id_proveedor_cuenta,
    id_solicitud_proveedor,
    saldo_cero = true,
    page,
    length,
  } = req.query;

  try {
    const ids = id_solicitud_proveedor
      ? String(id_solicitud_proveedor)
          .split(",")
          .map((id) => Number(id.trim()))
      : undefined;

    const { rows, total, hasPagination } = await dispersionService.getAll({
      codigo_dispersion,
      fecha_pago_inicio,
      fecha_pago_fin,
      id_proveedor_cuenta,
      saldo_cero,
      ids,
      page,
      length,
    });

    return res.status(200).json({
      message: "Dispersiones obtenidas correctamente",
      data: rows,
      metadata: hasPagination ? { total } : null,
    });
  } catch (error) {
    console.error("Error en dispersion.getAll:", error);
    return res.status(error.statusCode ?? 500).json({
      error: error.message,
      details: error.details,
    });
  }
};

const eliminar = async (req, res) => {
  const { codigo_dispersion } = req.params;

  try {
    const result = await runTransaction((conn) =>
      dispersionService.eliminarPorCodigo(codigo_dispersion, conn),
    );

    return res.status(200).json({
      data: result,
      metadata: null,
      message: "Dispersión eliminada correctamente",
    });
  } catch (error) {
    console.error("Error en dispersion.eliminar:", error);
    return res.status(error.statusCode ?? 500).json({
      error: error.message,
      details: error.details,
    });
  }
};

module.exports = { create, getAll, eliminar };
