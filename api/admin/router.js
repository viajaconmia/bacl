const router = require("express").Router();
const { SECRET_KEY } = require("../../lib/constant");
const auth = require("./routes/auth");
const user = require("./routes/user");
const jwt = require("jsonwebtoken");

router.use((req, res, next) => {
  const token = req.cookies["access-token"];
  req.session = { user: null };
  if (token) {
    try {
      const session = jwt.verify(token, SECRET_KEY);
      req.session.user = session;
    } catch (error) {
      console.log(error);
      if (error.message == "jwt expired")
        error.message = "sesion expirada, inicia sesión nuevamente";
      res
        .status(500)
        .clearCookie("access-token")
        .json({
          message: error.message || "Error al salir",
          error,
          data: null,
        });
      return;
    }
  }
  next();
});

router.use("/auth", auth);
router.use("/user", user);

module.exports = router;
