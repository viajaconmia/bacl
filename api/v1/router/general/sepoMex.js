const express = require("express");
const router = express.Router();
const { executeQuery } =  require("../../../../config/db");

router.get("/buscar-codigo-postal", async (req, res) => {
  try {
    const { d_codigo } = req.query;
    if (!d_codigo) {
      return res.status(400).json({ error: "El parámetro 'd_codigo' es requerido" });
    }

    const query = "SELECT * FROM codigos_postales WHERE d_codigo = ?;";
    const params = [d_codigo];

    const response = await executeQuery(query, params);

    if (response.length === 0) {
      return res.status(404).json({ error: "Código postal no encontrado" });
    }

    res.json({ success: true, data: response }); // Devuelve la primera coincidencia
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor", details: error.message });
  }
});

module.exports = router;