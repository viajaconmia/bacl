const controller = require("../controllers/user");
const validacion = require("../../v1/middleware/validateParams");
const { verificarPermiso } = require("../../../middleware/verifyPermission");
const router = require("express").Router();

router.patch("/active", controller.updateActive);
router.get("/roles", controller.getRoles);
router.patch(
  "/permission",
  verificarPermiso("vista(admin):actualizacion(permisos-usuario)"),
  controller.updateUserPermission
);
router.patch("/role", controller.updateUserRole);

module.exports = router;
