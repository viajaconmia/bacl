const router = require("express").Router()
const controller = require("../../controller/hoteles")

router.get("/", controller.readGroupByHotel)
router.get("/hotelesWithTarifa", controller.readHotelesWithTarifa)


router.post("/Agregar-hotel",controller.AgregarHotel);
router.get("/Consultar-hoteles",controller.consultaHoteles);
router.patch("/Editar-hotel",controller.actualizaHotel)
router.patch("/Eliminar-hotel",controller.eliminaHotelLogico);
router.get("/Consultar-precio-sencilla/:id_hotel",controller.consultaPrecioSencilla);
router.get("/Consultar-precio-doble/:id_hotel",controller.consultaPrecioDoble);
router.get("/Filtra-hoteles/:opc",controller.filtra_hoteles);
router.get("/Consultar-tarifas-por-hotel/:id_hotel",controller.getTarifasByIdHotel);
router.get("/Paginacion",controller.paginacion);
router.get("/Consulta-Hoteles-por-termino",controller.BuscaHotelesPorTermino);
router.get("/Filtra-hotel-tarifas-por-nombre",controller.get_hotel_tarifas_by_nombre);
router.patch("/Actualiza-tarifa",controller.actualizarTarifa);
router.patch("/Eliminar-tarifa-preferencial",controller.eliminarLogicaTarifa);
router.post("/Filtro-avanzado",controller.filtroAvanzado)
module.exports = router;