function verificarSaldos(arr) {
  const idsVistos = {};

  for (const obj of arr) {
    if (idsVistos[obj.id_saldos] === undefined) {
      idsVistos[obj.id_saldos] = Number(obj.saldo);
    } else if (idsVistos[obj.id_saldos] !== Number(obj.saldo)) {
      return false; // Saldo diferente
    }
  }
  return true; // Todo en orden
}

module.exports = { verificarSaldos };
