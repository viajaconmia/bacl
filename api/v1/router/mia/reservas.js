// front/api/v1/router/mia/reservas.js
const router = require("express").Router();
const { executeQuery } = require("../../../../config/db");
const controller = require("../../controller/reservas");
const middleware = require("../../middleware/validateParams");
const controller_v2 = require("../../../../v2/controller/reservas.controller");
const v2 = require("../../../../v2/controller/booking.controller");
const { error } = require("winston");

router.get("/v2/cupon", async (req, res) => {
  try {
    const { id } = req.query;
    const response = await v2.getCupon(id);
    res.status(200).json({ message: "done", data: response });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || error.status || 500)
      .json({ message: error.message, error: error.message });
  }
});

/**
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 */

const requiredParamsToCreate = [];
router.get("/detallesConexion", controller.getDetallesConexionReservas);
router.put("/nuevo-editar-reserva", controller_v2.editar_reserva_definitivo);
router.put("/cancelar", controller_v2.cancelarBooking);

/*router.put(
  "/",
  //middleware.validateParams(requiredParamsToCreate),
  // controller.updateReserva //se vovio el original era updateReserva
  controller.updateReserva2
);*/
router.post(
  "/operaciones",
  middleware.validateParams(requiredParamsToCreate),
  controller.createFromOperaciones,
);

router.put("/validacion_codigo", controller.validateCodigo);

router.post(
  "/",
  middleware.validateParams(requiredParamsToCreate),
  controller.create,
);
router.get("/", controller.read);
router.get("/agente", controller.readById);
router.get("/all", controller.readAll);
router.get("/allFacturacion", controller.readAllFacturacion);
router.get("/id", controller.readOnlyById);
router.put("/items", controller.actualizarPrecioVenta);
router.get("/items", controller.getItemsFromBooking);
router.get("/reservasConItems", controller.getReservasWithIAtemsByidAgente);
router.get(
  "/reservasConItemsSinPagar",
  controller.getReservasWithItemsSinPagarByAgente,
);

router.get("/detalles_reservas", controller.detalles_reservas);
router.get("/verificar-empalme", controller.verificarEmpalmeHotel);
router.get("/v2/verificar-empalme", controller.verificarEmpalmeHotel2);
router.get("/verificar-traslape", controller.checkTraslapes);
router.get("/services", controller_v2.obtener);
router.get("/services/cliente", controller_v2.obtenerCliente);
router.get("/cotizaciones", async (req, res) => {
  try {
    const { servicio } = req.query;
    console.log(servicio);
    const response = await executeQuery(
      `SELECT * FROM vw_solicitud_cotizaciones ${
        servicio ? "WHERE id_servicio = ?" : ""
      }`,
      servicio ? [servicio] : [],
    );

    const split_services = response.reduce((acc, curr) => {
      acc = {
        ...acc,
        [curr.id_servicio]: acc[curr.id_servicio]
          ? [...acc[curr.id_servicio], curr]
          : [curr],
      };
      return acc;
    }, {});

    const agrupado = Object.values(split_services).map((arr) => ({
      data: arr,
      types: arr.reduce((acc, curr) => {
        if (!curr?.objeto_gemini?.type) {
          curr.objeto_gemini = { type: "hotel" };
        }
        acc = {
          ...acc,
          [curr.objeto_gemini.type]: acc[curr.objeto_gemini.type]
            ? acc[curr.objeto_gemini.type] + 1
            : 1,
        };
        return acc;
      }, {}),
    }));
    res.status(200).json({ message: "done", data: agrupado });
  } catch (error) {
    console.log(error.message);
    return res.status(error.statusCode || 500).json({
      error: error.details,
      message: error.message,
      data: null,
    });
  }
});

router.get("/cupon/vuelo", async (req, res) => {
  try {
    const { id_viaje_aereo } = req.query;

    if (!id_viaje_aereo) {
      return res.status(400).json({ error: "id_viaje_aereo es requerido" });
    }

    const [reservaData] = await executeQuery(
      `SELECT vw.*, va.ciudad_origen, va.ciudad_destino, vw.id_confirmacion as codigo_confirmacion
       FROM vw_details_booking vw 
       INNER JOIN viajes_aereos va ON va.id_viaje_aereo = vw.id_relacion 
       WHERE vw.id_relacion = ?`,
      [id_viaje_aereo],
      // ["jiuhgyktfrhdfgyuhjikolp"],
    );

    if (!reservaData) {
      return res.status(404).json({ error: "Vuelo no encontrado" });
    }

    const vuelos = await executeQuery(
      `SELECT * FROM vuelos WHERE id_viaje_aereo = ?`,
      [id_viaje_aereo],
    );

    res.status(200).json({
      message: "ok",
      data: {
        ...reservaData,
        vuelos,
      },
    });
  } catch (error) {
    console.error("Error en /cupon/vuelo:", error);
    res.status(500).json({
      ok: false,
      error: error.message || "Error obteniendo cupón de vuelo",
    });
  }
});

router.get("/cupon/auto", async (req, res) => {
  console.log("entro al endpoint de cupon de autos", req.query);
  const inicio = performance.now();

  try {
    const { id_renta_autos } = req.query;

    if (!id_renta_autos) {
      return res.status(400).json({
        message: "id_renta_autos es requerido",
        data: null,
      });
    }

    const [data] = await executeQuery(
      `
        SELECT
          ra.nombre_proveedor,
          ra.codigo_renta_carro AS codigo_confirmation,
          ra.id_conductor_principal,

          COALESCE(
            NULLIF(TRIM(ra.conductor_principal), ''),
            NULLIF(
              TRIM(
                CONCAT_WS(
                  ' ',
                  v.primer_nombre,
                  v.segundo_nombre,
                  v.apellido_paterno,
                  v.apellido_materno
                )
              ),
              ''
            )
          ) AS conductor_principal,

          ra.conductores_adicionales,

          COALESCE(
            NULLIF(TRIM(ra.descripcion_auto), ''),
            NULLIF(TRIM(ra.tipo_auto), '')
          ) AS tipo_auto,

          ra.transmission,

          ra.lugar_recoger_auto,
          ra.hora_recoger_auto,
          ra.id_sucursal_recoger_auto,

          ra.hora_dejar_auto,
          ra.lugar_dejar_auto,
          ra.id_sucursal_dejar_auto,

          ra.dias,
          ra.seguro_incluido,
          ra.additional_driver,

          b.check_in,
          b.check_out,

          sr.nombre AS nombre_sucursal_recoger,

          CONCAT_WS(
            ', ',
            NULLIF(TRIM(sr.direccion), ''),
            NULLIF(TRIM(sr.codigo_postal), ''),
            NULLIF(TRIM(sr.ciudad), ''),
            NULLIF(TRIM(sr.pais), '')
          ) AS direccion_recoger,

          sd.nombre AS nombre_sucursal_dejar,

          CONCAT_WS(
            ', ',
            NULLIF(TRIM(sd.direccion), ''),
            NULLIF(TRIM(sd.codigo_postal), ''),
            NULLIF(TRIM(sd.ciudad), ''),
            NULLIF(TRIM(sd.pais), '')
          ) AS direccion_dejar,

          'renta_carros' AS type,

          COALESCE(
            NULLIF(
              TRIM(
                CONCAT_WS(
                  ' ',
                  v.primer_nombre,
                  v.segundo_nombre,
                  v.apellido_paterno,
                  v.apellido_materno
                )
              ),
              ''
            ),
            NULLIF(TRIM(ra.conductor_principal), '')
          ) AS viajero

        FROM renta_autos AS ra

        LEFT JOIN viajeros AS v
          ON v.id_viajero = ra.id_conductor_principal

        LEFT JOIN sucursales AS sr
          ON sr.id_sucursal = ra.id_sucursal_recoger_auto

        LEFT JOIN sucursales AS sd
          ON sd.id_sucursal = ra.id_sucursal_dejar_auto

        LEFT JOIN bookings AS b
          ON b.id_booking = ra.id_booking

        WHERE ra.id_renta_autos = ?
        LIMIT 1
      `,
      [id_renta_autos],
    );

    if (!data) {
      return res.status(404).json({
        message: "No se encontró la renta de auto",
        data: null,
      });
    }

    const tiempo = performance.now() - inicio;

    console.log(
      `[GET /v1/cupon/autos] ${id_renta_autos}: ${tiempo.toFixed(2)} ms`,
    );

    res.setHeader(
      "Server-Timing",
      `endpoint;dur=${tiempo.toFixed(2)};desc="Cupón renta de auto"`,
    );

    return res.status(200).json({
      message: "done",
      data,
      tiempo_ms: Number(tiempo.toFixed(2)),
    });
  } catch (error) {
    const tiempo = performance.now() - inicio;

    console.error(
      `[GET /v1/cupon/autos] Error después de ${tiempo.toFixed(2)} ms`,
      error,
    );

    return res.status(500).json({
      message: "Sucedió un error al obtener el cupón",
      error: error.message,
      data: null,
    });
  }
});

// Router solo hace te envia a la ruta del controller

router.get("/ejecutarSP", controller.ejecutarSpGenerarReservas);
router.get("/headerReservas", controller.getHeaderReservas);
router.get("/detallesReservas", controller.getHeaderDetallesReservas);
router.get("/historicoPeriodo", controller.getHistoricoPeriodo);
module.exports = router;
