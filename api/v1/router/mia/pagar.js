// const middleware = require("../../middleware/validateParams");
const router = require("express").Router();
const { validate: isUuid } = require("uuid");
const { executeQuery } = require("../../../../config/db");

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

module.exports = router;
