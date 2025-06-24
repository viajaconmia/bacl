//este router es para endpoints de utillidades
const router = require("express").Router();
const controller = require("../../controller/utils");

//EJEMPLO DE USO:
// GET /utils/cargar-archivos/:ruta?filename=mi.png&filetype=image/png
router.get("/cargar-archivos/:ruta", controller.cargarArchivos);

module.exports = router;