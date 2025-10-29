const controller = require("../controllers/user");
const validacion = require("../../v1/middleware/validateParams");
const { verificarPermiso } = require("../../../middleware/verifyPermission");
const router = require("express").Router();

router.patch("/active", controller.updateActive);
router.get("/roles", controller.getRoles);

module.exports = router;
