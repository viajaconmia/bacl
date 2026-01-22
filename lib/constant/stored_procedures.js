const STORED_PROCEDURE = {
  POST: {
    SOLICITUD_PAGO_PROVEEDOR: "crear_solicitud_pago",
    SOLICITUD_CON_PAGO_PROVEEDOR: "",
    SALDO_A_FAVOR_INSERTAR: "insertar_saldo_a_favor",
  },
  GET: {
    SOLICITUD_PAGO_PROVEEDOR: "get_solicitudes_pago", 
    OBTENER_AGENTE_POR_CORREO: "buscar_agente",
    OBTENR_PAGOS_PROVEEDOR:"sp_obtener_pagos_proveedor",
  },
  PATCH: {
    ACTUALIZA_SALDO_A_FAVOR: "sp_actualizar_saldo_favor",
  },
}; 

module.exports = { STORED_PROCEDURE };
