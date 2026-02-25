const { executeQuery, executeSP } = require("../../config/db");
const { CustomError } = require("../../middleware/errorHandler");

// id => id_booking
const getCupon = async (id) => {
  try {
    if (!id) {
      throw new CustomError("El id_solicitud es requerido", 400);
    }
    const [reserva] = await executeQuery(
      `SELECT * FROM vw_new_reservas_client WHERE id_solicitud = ? and estado <> "Cancelada"`,
      [id],
    );
    if (!reserva) {
      throw new CustomError("Esta reserva no existe o fue cancelada", 404);
    }
    if (!reserva.id_booking || reserva.id_hospedaje) {
      const [result] = await executeSP("sp_get_solicitud_by_id", [id]);
      return { ...result, type: "hotel" };
    }
    if (reserva.id_viaje_aereo) {
      const [result, vuelos] = await Promise.all([
        executeQuery(
          `SELECT b.total, v.primer_nombre, v.segundo_nombre, v.apellido_paterno, v.apellido_materno, va.id_viaje_aereo, va.ciudad_origen as origen, va.ciudad_destino as destino, va.trip_type as tipo, va.codigo_confirmacion FROM viajes_aereos va
          left join viajeros v on va.id_viajero = v.id_viajero
          left join bookings b on b.id_booking = va.id_booking
          WHERE va.id_viaje_aereo = ?`,
          [reserva.id_viaje_aereo],
        ),
        executeQuery(
          `select eq_mano, eq_personal, eq_documentado, id_vuelo, flight_number, airline, departure_airport, departure_city, departure_date, departure_time, arrival_airport, arrival_city, arrival_date, arrival_time, stop_count as parada, seat_number, fly_type, comentarios, rate_type from vuelos where id_viaje_aereo = ?`,
          [reserva.id_viaje_aereo],
        ),
      ]);
      const {
        primer_nombre,
        segundo_nombre,
        apellido_paterno,
        apellido_materno,
        ...rest
      } = result[0];
      return {
        ...rest,
        vuelos,
        id_solicitud: id,
        type: "vuelo",
        viajero: [
          primer_nombre,
          segundo_nombre,
          apellido_paterno,
          apellido_materno,
        ]
          .filter(Boolean)
          .join(" "),
      };
    }
    if (reserva.id_renta_autos) {
      const [result] = await executeQuery(
        `select v.primer_nombre, v.segundo_nombre, v.apellido_paterno, v.apellido_materno, ra.nombre_proveedor, ra.codigo_renta_carro as codigo_confirmation, ra.id_conductor_principal, ra.conductor_principal, ra.conductores_adicionales, ra.descripcion_auto as tipo_auto, ra.transmission, ra.lugar_recoger_auto,
ra.hora_recoger_auto, ra.id_sucursal_recoger_auto, ra.hora_dejar_auto, ra.lugar_dejar_auto, ra.id_sucursal_dejar_auto, ra.dias, ra.seguro_incluido, ra.additional_driver,
b.check_in, b.check_out,
sr.nombre as nombre_sucursal_recoger, concat(sr.direccion, " ", sr.codigo_postal, ", ", sr.ciudad, ", ", sr.pais) as direccion_recoger,
sd.nombre as nombre_sucursal_dejar, concat(sd.direccion, " ", sd.codigo_postal, ", ", sd.ciudad, ", ", sd.pais) as direccion_dejar
from renta_autos ra 
left join viajeros v on v.id_viajero = ra.id_conductor_principal
left join sucursales sr on ra.id_sucursal_recoger_auto = sr.id_sucursal
left join sucursales sd on ra.id_sucursal_dejar_auto = sd.id_sucursal
left join bookings b on b.id_booking = ra.id_booking where ra.id_renta_autos = ?`,
        [reserva.id_renta_autos],
      );
      const {
        primer_nombre,
        segundo_nombre,
        apellido_paterno,
        apellido_materno,
        ...rest
      } = result;
      return {
        ...rest,
        type: "renta_carros",
        viajero: [
          primer_nombre,
          segundo_nombre,
          apellido_paterno,
          apellido_materno,
        ]
          .filter(Boolean)
          .join(" "),
      };
    }
    return null;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getCupon,
};
