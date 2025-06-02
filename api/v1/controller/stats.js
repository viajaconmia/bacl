const model = require("../model/stats")

const getCardStats = async (req, res) => {
  try {
    const { month, year, id_user } = req.query
    let response = await model.getStats(month, year, id_user)
    res.status(200).json({ message: "Get succesfully", data: response })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error', details: error.message })
  }
}
const getCardStatsPerMonth = async (req, res) => {
  try {
    const { year, id_user } = req.query
    let response = await model.getStatsPerMonth(year, id_user)
    res.status(200).json(response)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error', details: error.message })
  }
}

module.exports = {
  getCardStats,
  getCardStatsPerMonth
}