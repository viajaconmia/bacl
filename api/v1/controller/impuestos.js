let model = require("../model/impuestos")

const read = async (req, res) => {
  try {
    let impuestos = await model.getImpuestos()
    res.status(200).json(impuestos)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error', details: error })
  }
}

module.exports = {
  read
}
