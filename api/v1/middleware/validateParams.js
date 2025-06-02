const validateParams = (requiredParams) => {

  return (req, res, next) => {

    const missingParams = requiredParams.filter(param => !req.body[param]);
    if (missingParams.length > 0) {
      console.log("required params: ", requiredParams)
      console.log("params: ", req.body)
      return res.status(400).json({ error: 'Faltan parametros requeridos', details: { missingParams } })
    }

    next()
  }
}
const validateParamsQuery = (requiredParams) => {

  return (req, res, next) => {

    const missingParams = requiredParams.filter(param => !req.query[param]);
    if (missingParams.length > 0) {
      console.log("required params: ", requiredParams)
      console.log("params: ", req.query)
      return res.status(400).json({ error: 'Faltan parametros requeridos', details: { missingParams } })
    }

    next()
  }
};

module.exports = {
  validateParams,
  validateParamsQuery
}