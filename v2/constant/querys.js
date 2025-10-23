const PAGOS = {
  GET_IS_FACTURADO: `SELECT * FROM vw_reporte_pagos_facturados WHERE id_pago = ?`,
};

module.exports = { PAGOS };
