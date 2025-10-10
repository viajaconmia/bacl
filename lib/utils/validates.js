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

const hasAllRequiredColumn = (tabla, required, objeto) => {
  const cols = Array.isArray(objeto) ? objeto : Object.keys(objeto);
  const emptyRequired = required.filter((key) => !cols.includes(key));

  if (emptyRequired.length > 0)
    throw new Error(
      `En la tabla ${tabla} son requeridas las propiedades: ${emptyRequired.join(
        ", "
      )}`
    );
};

const excludeColumns = (tabla, columnas, objeto) => {
  const notColumns = Array.isArray(objeto)
    ? objeto.filter((key) => !columnas.includes(key))
    : Object.keys(objeto).filter((key) => !columnas.includes(key));
  if (notColumns.length > 0)
    throw new Error(
      `Debes revisar tus propiedades: ${tabla}: ${notColumns.join(", ")}
      \n
      Recuerda que las propiedades permitidas son: \n${columnas.join(",\n")}`
    );
};

module.exports = { verificarSaldos, excludeColumns, hasAllRequiredColumn };
