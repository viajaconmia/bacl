const router = require("express").Router();
const auth = require("./routes/auth");
const user = require("./routes/user");

router.use("/auth", auth);
router.use("/user", user);

module.exports = router;
