const controller = require("../controllers/auth");
const validacion = require("../../v1/middleware/validateParams");
const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("../../../lib/constant");
const { verificarPermiso } = require("../../../middleware/verifyPermission");
const router = require("express").Router();

//Midleware para manejar la sessión
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

router.get("/verify-session", controller.verifySession);

router.get(
  "/usuarios",
  // verificarPermiso("usuarios.get"),
  controller.getUsuariosAdmin
);

router.get("/permisos", controller.getPermisos);

router.post(
  "/signup",
  validacion.validateParams(["username", "password", "email"]),
  controller.signUp
);
router.post(
  "/login",
  validacion.validateParams(["password", "email"]),
  controller.logIn
);
router.post("/logout", controller.logOut);

module.exports = router;
