const { executeSP } = require("../../../config/db");
const model = require("../model/stats");

const getCardStats = async (req, res) => {
  const { month, year, id_user } = req.query;
  try {
    const response = await executeSP("sp_stats_pago", [id_user, year, month]);
    // console.log ("😒😒",response);
    if (!response || response.length === 0) {
      return res
        .status(404)
        .json({ message: "No se encontraron datos para esta busqueda" });
    }
    res
      .status(200)
      .json({ message: "Stats halladas con exito", data: response });
  } catch (error) { 
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};
const getCardStatsPerMonth = async (req, res) => {
  try {
    const { year, id_user, mes } = req.query;
    let response = await model.getStatsPerMonth(year, id_user, mes);
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

module.exports = {
  getCardStats,
  getCardStatsPerMonth,
};
