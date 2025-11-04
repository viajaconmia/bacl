const PAGOS = {
  GET_IS_FACTURADO: `
  SELECT 
    p.total, SUM(fps.monto) as monto_facturado
  FROM pagos p 
  LEFT JOIN facturas_pagos_y_saldos fps on fps.id_pago = p.id_pago
  WHERE p.id_pago = ?
  GROUP BY fps.id_pago;`,
};

module.exports = { PAGOS };
