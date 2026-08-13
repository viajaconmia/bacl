const service = require("./reservasComisionables.service");

const listar = async (req, res) => {
  const { page, length } = req.query;
  try {
    const { rows, total, hasPagination } = await service.getAll({
      page,
      length,
    });
    return res.status(200).json({
      message: "Comisionables obtenidos correctamente",
      data: rows,
      metadata: hasPagination ? { total } : null,
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({ error: error.message });
  }
};

const cobrar = async (req, res) => {
  const { id_booking } = req.params;
  try {
    const data = await service.marcarComisionCobrada(id_booking);
    return res.status(200).json({
      message: "Comisión marcada como cobrada",
      data,
      metadata: null,
    });
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({ error: error.message });
  }
};

module.exports = { listar, cobrar };
