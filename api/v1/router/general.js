const factura = require("./general/factura");
const stripe = require("./general/stripe");
const mia = require("./general/mia");
const otp = require("./general/otp");
const sepoMex = require("./general/sepoMex");
const { SECRET_KEY } = require("../../../lib/constant");
const { v4: uuidv4 } = require("uuid");
const { executeQuery } = require("../../../config/db");
const jwt = require("jsonwebtoken");
const router = require("express").Router();

router.use("/factura", factura);
router.use("/stripe", stripe);
router.use("/mia", mia);
router.use("/otp", otp);
router.use("/sepoMex", sepoMex);
router.get("/:id", async (req, res) => {
  try {
    const jti = uuidv4();
    const token = jwt.sign({ jti }, SECRET_KEY, {
      expiresIn: "15s",
    });
    console.log("creado");
    await executeQuery(`INSERT INTO sign_jwt (jti) VALUES (?)`, [jti]);
    res.status(200).json({ message: "", data: token });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Intenta mas tarde", data: null, error: null });
  }
});

module.exports = router;
