const router = require("express").Router();
const auth = require("./routes/auth");

router.use("/auth", auth);

module.exports = router;
