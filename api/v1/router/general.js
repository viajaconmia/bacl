const factura = require("./general/factura")
const stripe = require("./general/stripe")
const mia = require("./general/mia")
const otp = require("./general/otp");
const sepoMex = require("./general/sepoMex");
const router = require("express").Router()

router.use("/factura", factura)
router.use("/stripe", stripe)
router.use("/mia", mia)
router.use("/otp", otp);
router.use("/sepoMex", sepoMex);

module.exports = router