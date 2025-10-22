const { Formato } = require("./formats");
const ERROR = require("./messages");

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

class Validacion {
  constructor() {}

  static requiredColumns(columns, objeto) {
    const cols = Array.isArray(objeto) ? objeto : Object.keys(objeto);
    const emptyRequired = columns.filter((key) => !cols.includes(key));
    if (emptyRequired.length > 0)
      throw new Error(`Faltan las propiedades: ${emptyRequired.join(", ")}`);
  }

  static columnsFromDB(columnas, objeto) {
    const notColumns = Array.isArray(objeto)
      ? objeto.filter((key) => !columnas.includes(key))
      : Object.keys(objeto).filter((key) => !columnas.includes(key));
    if (notColumns.length > 0)
      throw new Error(
        `No se encontraron las siguientes propiedades: ${notColumns.join(", ")}`
      );
  }

  static uuid(uuid) {
    if (uuid == undefined || uuid == null) throw new Error(ERROR.ID.EMPTY);
    if (typeof uuid !== "string") throw new Error(ERROR.ID.TYPE);
    if (!(uuid.length >= 36 && uuid.length <= 40))
      throw new Error(ERROR.ID.TYPE);
  }

  static uuidfk(fk) {
    if (fk == undefined || fk == null) throw new Error(ERROR.FK.EMPTY);
    if (typeof fk !== "string") throw new Error(ERROR.FK.TYPE);
    if (!(fk.length >= 36 && fk.length <= 40)) throw new Error(ERROR.FK.TYPE);
  }

  static number(n) {
    if ((typeof n == "string" && isNaN(n)) || n === "")
      throw new Error(ERROR.NUMBER.TYPE);
    if (typeof n != "string" && typeof n != "number")
      throw new Error(ERROR.NUMBER.TYPE);
  }

  static precio(precio) {
    if (precio < 0) throw new Error(ERROR.PRICE.INVALID);
  }

  static numberid(number) {
    number = Formato.number(number);
    if (number < 0) throw new Error(Error.NUMBER.INVALID);
  }
}

module.exports = { verificarSaldos, Validacion };
