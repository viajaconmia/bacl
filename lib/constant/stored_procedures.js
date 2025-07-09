const STORED_PROCEDURE = {
  POST: {
    SOLICITUD_PAGO_PROVEEDOR: "crear_solicitud_pago",
    SOLICITUD_CON_PAGO_PROVEEDOR: "",
    SALDO_A_FAVOR_INSERTAR: "insertar_saldo_a_favor",
  },
  GET: {
    SOLICITUD_PAGO_PROVEEDOR: "get_solicitudes_pago",
  },
};

module.exports = { STORED_PROCEDURE };
