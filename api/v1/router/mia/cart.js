const controller = require("../../controller/cart");
const router = require("express").Router();

router.get("/", controller.getCartItemsById);
router.post("/", controller.createCartItem);
router.delete("/", controller.deleteCartItem);
router.patch("/", controller.setSelectedCartItem);

module.exports = router;
