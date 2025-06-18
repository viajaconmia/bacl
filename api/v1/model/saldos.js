const { executeQuery, executeTransaction } = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");

const createSaldo = async (saldo) => {
  try {
    const id_saldo = `sal-${uuidv4()}`;

    // Insertar el saldo en la tabla "saldos"
    const query =
      "INSERT INTO saldos (id_saldo, id_agente, id_proveedor, monto, restante, moneda, forma_pago, fecha_procesamiento, referencia, id_hospedaje, charge_id, transaction_id, motivo, comentarios,estado_link, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";
    const params = [
      id_saldo,
      saldo.id_agente,
      saldo.id_proveedor,
      saldo.monto,
      saldo.monto,
      saldo.moneda,
      saldo.forma_pago,
      saldo.fecha_procesamiento,
      saldo.referencia,
      saldo.id_hospedaje,
      saldo.charge_id,
      saldo.transaction_id,
      saldo.motivo,
      saldo.comentarios,
      saldo?.estado_link || null,
      "pending",
    ];
    await executeQuery(query, params);

    return {
      success: true,
      id_saldo: id_saldo
    };
  } catch (error) {
    throw error;
  }
};

const readSaldos = async () => {
  try {
    const query = "select * from saldos s left join agentes a on s.id_agente = a.id_agente;";
    const response = executeQuery(query);
    return response;
  } catch (error) {
    throw error;
  }
};


module.exports = {
  createSaldo,
  readSaldos,
};
