const router = require("express").Router();
const controller = require("../../controller/reservasClient");

router.get("/get_reservasClient_by_id_agente", controller.get_reservasClient_by_id_agente);
router.post("/filtro_solicitudes_y_reservas", controller.filtro_solicitudes_y_reservas);
router.post("/todas_las_reservas", controller.get_all_facturas);

module.exports = router;