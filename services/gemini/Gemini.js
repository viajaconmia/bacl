const { Orquestador } = require("./Orquestador");

const handleGeminiConnection = async (req, res) => {
  try {
    const { message, cola = [], historial = [] } = req.body;

    const lider = new Orquestador();
    const response = await lider.execute(message, cola, historial);

    // res.status(200).json({ message: "", data: response });
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
};

module.exports = { handleGeminiConnection };
