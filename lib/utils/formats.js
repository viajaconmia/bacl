const { v4: uuidv4 } = require("uuid");
const { excludeColumns, Validacion } = require("./validates");

const formateoViajeAereo = (faltante, reserva, saldos, flys, viaje_aereo) => {
  faltante = Number(faltante);
  reserva = {
    ...reserva,
    costo: Number(reserva.costo),
    precio: Number(reserva.precio),
  };
  saldos = saldos.map((saldo) => ({
    ...saldo,
    saldo: Number(saldo.saldo),
    monto: Number(saldo.monto),
    restante: Number(saldo.restante),
    saldo_usado: Number(saldo.saldo_usado),
  }));

  const tipo_vuelo = flys.map((vuelo) => [
    vuelo.tipo.includes("vuelta"),
    vuelo.tipo.includes("escala"),
  ]);

  const indiceVueloIdaDestino = flys.findLastIndex((vuelo) =>
    vuelo.tipo.includes("ida escala")
  );
  const indiceVueloRegresoOrigen = flys.findIndex((vuelo) =>
    vuelo.tipo.includes("vuelta")
  );
  const indiceVueloRegresoDestino = flys.findLastIndex((vuelo) =>
    vuelo.tipo.includes("vuelta escala")
  );

  const id_servicio = viaje_aereo ? viaje_aereo.id_servicio : `ser-${uuidv4()}`;
  const id_booking = viaje_aereo ? viaje_aereo.id_booking : `boo-${uuidv4()}`;
  const id_viaje_aereo = viaje_aereo
    ? viaje_aereo.id_viaje_aereo
    : `vue-${uuidv4()}`;

  return {
    indiceVueloRegresoOrigen,
    id_booking,
    id_servicio,
    faltante,
    reserva,
    saldos,
    vuelos: flys.map((vuelo, index) => ({
      ...vuelo,
      id_viaje_aereo,
      id_viajero: reserva.viajero.id_viajero,
      flight_number: vuelo.folio,
      airline: vuelo.aerolinea.nombre,
      airline_code: vuelo.aerolinea.id,
      airline_code: vuelo.aerolinea.id,
      departure: {
        airport: vuelo.origen.nombre,
        airport_code: vuelo.origen.id,
        city: vuelo.origen.ciudad || "",
        country: vuelo.origen.pais || "",
        date: vuelo.check_in.split("T")[0],
        time: vuelo.check_in.split("T")[1],
      },
      arrival: {
        airport: vuelo.destino.nombre,
        airport_code: vuelo.destino.id,
        city: vuelo.destino.ciudad || "",
        country: vuelo.destino.pais || "",
        date: vuelo.check_out.split("T")[0],
        time: vuelo.check_out.split("T")[1],
      },
      has_stops: flys.length > 1,
      stop_count: index + 1,
      stops: flys.length,
      seat_number: vuelo.asiento,
      seat_location: vuelo.ubicacion_asiento,
      rate_type: vuelo.tipo_tarifa,
      comentarios: vuelo.comentarios || null,
      fly_type: vuelo.tipo,
    })),
    viaje_aereo: {
      id_viaje_aereo,
      id_booking,
      id_servicio,
      codigo_confirmation: reserva.codigo,
      trip_type: `${
        tipo_vuelo.some(([vuelta, _]) => !!vuelta) ? "REDONDO" : "SENCILLO"
      }${tipo_vuelo.some(([_, escala]) => !!escala) ? " CON ESCALA" : ""}`,
      status: reserva.status,
      ida: {
        origen: {
          aeropuerto: flys[0].origen.nombre || null,
          ciudad: flys[0].origen.ciudad || null,
        },
        destino: {
          aeropuerto:
            flys[indiceVueloIdaDestino >= 0 ? indiceVueloIdaDestino : 0].destino
              .nombre,
          ciudad:
            flys[indiceVueloIdaDestino >= 0 ? indiceVueloIdaDestino : 0].destino
              .ciudad,
        },
      },
      regreso:
        indiceVueloRegresoOrigen > 0
          ? {
              origen: {
                aeropuerto:
                  flys[indiceVueloRegresoOrigen].origen.nombre || null,
                ciudad: flys[indiceVueloRegresoOrigen].origen.ciudad || null,
              },
              destino: {
                aeropuerto:
                  flys[
                    indiceVueloRegresoDestino > 0
                      ? indiceVueloRegresoDestino
                      : indiceVueloRegresoOrigen
                  ].destino.nombre,
                ciudad:
                  flys[
                    indiceVueloRegresoDestino > 0
                      ? indiceVueloRegresoDestino
                      : indiceVueloRegresoOrigen
                  ].destino.ciudad,
              },
            }
          : null,
      payment_status: "pagado",
      total_passengers: 1,
      total: reserva.precio.toFixed(2),
    },
  };
};

class Formato {
  constructor() {}

  static propiedades = (columnas, object, field) => {
    Validacion.columnsFromDB(columnas, object);
    const list = Formato.propsList(object);
    return field ? list.filter((obj) => obj.key != field) : list;
  };

  static propsList = (object) =>
    Object.entries(object).map(([key, value]) => ({
      key,
      value,
    }));

  static precio(precio) {
    Validacion.number(precio);
    const formatPrecio =
      typeof precio == "string"
        ? Number(Number(precio).toFixed(2))
        : Number(precio.toFixed(2));

    Validacion.precio(formatPrecio);
    return formatPrecio;
  }
  static uuid(id, prefijo = "") {
    if (id == undefined) return `${prefijo}${uuidv4()}`;
    Validacion.uuid(id);
    return id;
  }
  static number(n) {
    Validacion.number(n);
    const formatNumber =
      typeof n == "string"
        ? Number(Number(n).toFixed(2))
        : Number(n.toFixed(2));
    return formatNumber;
  }

  static tipo_tarjeta(type) {
    if (type == "credit") return "credito";
    if (type == "debit") return "debito";
    if (type == "credito" || type == "debito") return type;
    return null;
  }
  static fechaSQL(date) {
    Validacion.date(date);
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

module.exports = { formateoViajeAereo, Formato };
