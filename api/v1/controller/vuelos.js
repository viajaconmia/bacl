const { executeQuery } = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");

const crearVuelo = async (req, res) => {
  try {
    let { faltante, saldos, vuelos, reserva, id_agente } = req.body;
    if (vuelos.length == 0) throw new Error("No se encontraron vuelos");
    if (!id_agente) throw new Error("No existe agente");

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

    const id_viaje_aereo = `vue-${uuidv4()}`;

    const viaje_aereo = {
      id_viaje_aereo,
      // id_booking:
      // id_servicio:
      codigo_confirmation: reserva.codigo,
      trip_type: vuelos.map((vuelo) => [
        vuelo.tipo.includes("vuelta"),
        vuelo.tipo.includes("escala"),
      ]),
      status: reserva.status,
      payment_status: "confirmado",
      total_passengers: 1,
      // total:
    };

    const vuelosToCreate = vuelos.map((vuelo, index) => ({
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
      has_stops: vuelos.length > 1,
      stop_count: index + 1,
      stops: vuelos.length,
      seat_number: vuelo.asiento,
      seat_location: vuelo.ubicacion_asiento,
      rate_type: vuelo.tipo_tarifa,
      comentarios: vuelo.comentarios,
      fly_type: vuelo.tipo,
    }));

    res
      .status(200)
      .json({ message: "Reservación creada con exito", data: vuelosToCreate });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};

module.exports = {
  crearVuelo,
};
