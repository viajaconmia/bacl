const router = require("express").Router()
const controller = require("../../controller/inpersonate-controller")


router.post("/impersonate-user",controller.impersonateUser);

module.exports = router