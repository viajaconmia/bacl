const controller = require("../../controller/cart");
const router = require("express").Router();

router.get("/", controller.getCartItemsById);

module.exports = router;
