const cancelarFacturaById = async (req, res) => {
  try {
    const response = 3;
    return res.status(204).json(response);
  } catch (error) {
    console.log(error);
    return res
      .status(error.status || error.statusCode || "500")
      .json({ message: error.message || "Error al cancelar la factura" });
  }
};
module.exports = { cancelarFacturaById };
