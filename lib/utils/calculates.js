const { Formato } = require("./formats");

const now = () =>
  new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" })
  );

function sumarDias(fecha, dias) {
  const nuevaFecha = new Date(fecha);
  nuevaFecha.setDate(nuevaFecha.getDate() + dias);
  return nuevaFecha;
}
function sumarHoras(fecha, horas) {
  const nuevaFecha = new Date(fecha);
  nuevaFecha.setHours(nuevaFecha.getHours() + horas);
  return nuevaFecha;
}
function calcularNoches(checkIn, checkOut) {
  // Convertir a objetos Date
  const fechaInicio = new Date(checkIn);
  const fechaFin = new Date(checkOut);

  // Validar que sean fechas válidas
  if (isNaN(fechaInicio) || isNaN(fechaFin)) {
    throw new Error("Fechas inválidas");
  }

  // Calcular diferencia en milisegundos
  const diferenciaMs = fechaFin - fechaInicio;

  // Convertir milisegundos a días (1 día = 1000ms * 60s * 60m * 24h)
  const noches = diferenciaMs / (1000 * 60 * 60 * 24);

  return noches;
}
function calcularPrecios(basePrice) {
  const impuestos = (basePrice - basePrice / 1.16).toFixed(2);
  const subtotal = (basePrice / 1.16).toFixed(2);

  return {
    impuestos: impuestos,
    subtotal: subtotal,
    total: basePrice.toFixed(2),
  };
}

class Calculo {
  constructor() {}
  /**
   *
   * @param {*} objeto
   * @returns
   */
  static precio(objeto) {
    const precio = objeto.total;
    if (precio !== undefined) {
      objeto = {
        ...objeto,
        ...calcularPrecios(Formato.precio(precio)),
      };
    }
    return objeto;
  }

  static uuid = (obj, field, prefijo = "") => {
    return {
      ...obj,
      [field]: Formato.uuid(obj[field], prefijo),
    };
  };

  static cleanEmpty = (obj) => {
    const list = Formato.propsList(obj);
    const filterList = list.filter((item) => item.value !== undefined);
    let res = {};
    filterList.forEach((item) => {
      res = { ...res, [item.key]: item.value };
    });
    return res;
  };

  static redondear = (number) => Number(number.toFixed(2));

static cambian_noches = (noches) => {
  // Ensure 'current' and 'before' exist and are numbers
  const currentNoches = Number(noches?.current ?? 0);
  const beforeNoches = Number(noches?.before ?? 0);

  const delta_noches = currentNoches - beforeNoches;
  const cambian_noches = delta_noches !== 0;

  // ALWAYS return both values
  return { cambian_noches, delta_noches };
}
static cambia_precio_de_venta = (venta) => {
  // Ensure 'total' exists and is a number
  const currentTotal = Number(venta?.current?.total ?? 0);
  const beforeTotal = Number(venta?.before?.total ?? 0);

  const delta_precio_venta = currentTotal - beforeTotal;
  const cambia_precio_de_venta = delta_precio_venta !== 0;

  // ALWAYS return both values
  return { cambia_precio_de_venta, delta_precio_venta };
}
}

module.exports = {
  calcularNoches,
  calcularPrecios,
  sumarDias,
  sumarHoras,
  Calculo,
  now,
};
