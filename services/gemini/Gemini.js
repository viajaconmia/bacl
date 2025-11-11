const { Orquestador } = require("./Orquestador");

const handleGeminiConnection = async (req, res) => {
  try {
    const { message, pila, historial } = req.body;

    const lider = new Orquestador();

    const response = await lider.execute(message, pila, historial);

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
};

module.exports = { handleGeminiConnection };
