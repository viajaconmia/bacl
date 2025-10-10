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

const excludeColumns = (tabla, columnas, objeto) => {
  const notColumns = Object.keys(objeto).filter(
    (key) => !columnas.includes(key)
  );
  if (notColumns.length > 0)
    throw new Error(
      `Tienes propiedades que no existen en ${tabla}: ${notColumns.join(", ")}
      \n
      Recuerda que las propiedades permitidas son: ${columnas.join(",\n")}`
    );
};

module.exports = { verificarSaldos, excludeColumns };
