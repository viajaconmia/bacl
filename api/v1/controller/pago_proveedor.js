const {
  executeSP,
  executeQuery,
  executeTransaction,
} = require("../../../config/db");
const { STORED_PROCEDURE } = require("../../../lib/constant/stored_procedures");

const createSolicitud = async (req, res) => {
  try {
    const { solicitud } = req.body;
    const {
      monto_a_pagar,
      paymentMethod,
      comments,
      date,
      paymentType,
      selectedCard,
      id_hospedaje,
    } = solicitud;

    let response;
    if (paymentType != "credit") {
      if (paymentMethod == "transfer") {
        const parametros = [
          monto_a_pagar, //Monto a pagar
          "transfer", //Metodo de pago
          null, //Tarjeta seleccionada
          "Operaciones", //Usuario solicitante
          "Operaciones", //Usuario generador
          comments, //comentarios
          id_hospedaje, //id hospedaje
          date, //fecha solicitud
        ];
        response = await executeSP(
          STORED_PROCEDURE.POST.SOLICITUD_PAGO_PROVEEDOR,
          parametros
        );
      }
    }
    res.status(200).json({
      message: "Agregado con exito el objeto",
      ok: true,
      data: solicitud,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const getSolicitudes = async (req, res) => {
  try {
    const response = await executeSP(
      STORED_PROCEDURE.GET.SOLICITUD_PAGO_PROVEEDOR
    );

    const ids_solicitudes = response.map(
      (reserva) => reserva.id_solicitud_proveedor
    );

    const pagosRaw = await executeQuery(
      `select * from pagos_solicitudes as ps LEFT JOIN pagos_proveedor as pp ON pp.id_pago_proveedor = ps.id_pago_proveedor WHERE ps.id_solicitud_proveedor IN (${ids_solicitudes
        .map((_) => "?")
        .join(",")});`,
      [...ids_solicitudes]
    );

    const pagos = pagosRaw.reduce((previus, current) => {
      if (!(String(current.id_solicitud_proveedor) in previus)) {
        previus[String(current.id_solicitud_proveedor)] = [];
      }
      previus[current.id_solicitud_proveedor].push(current);
      return previus;
    }, {});

    const facturasRaw = await executeQuery(
      `select * from facturas_solicitudes as fs LEFT JOIN facturas_pago_proveedor as fpp ON fpp.id_factura_proveedor = fs.id_factura_proveedor WHERE fs.id_solicitud_proveedor IN (${ids_solicitudes
        .map((_) => "?")
        .join(",")});`,
      [...ids_solicitudes]
    );

    const facturas = facturasRaw.reduce((previus, current) => {
      if (!(String(current.id_solicitud_proveedor) in previus)) {
        previus[String(current.id_solicitud_proveedor)] = [];
      }
      previus[current.id_solicitud_proveedor].push(current);
      return previus;
    }, {});

    const formatedResponse = response.map((solicitud) => ({
      ...solicitud,
      solicitud_proveedor: {
        id_solicitud_proveedor: solicitud.id_solicitud_proveedor,
        fecha_solicitud: string,
        monto_solicitado: string,
        saldo: string,
        forma_pago_solicitada: "credit" | "transfer" | "card" | "link" | string,
        id_tarjeta_solicitada: string | null,
        usuario_solicitante: string | null,
        usuario_generador: string | null,
        comentarios: solicitud.comentarios,
        estado_solicitud: solicitud.estado_solicitud,
        estado_facturacion: solicitud.estado_facturacion,
      },
      pagos: pagos[String(solicitud.id_solicitud_proveedor)],
      facturas: facturas[String(solicitud.id_solicitud_proveedor)],
    }));

    res.status(200).json({
      message: "Registros obtenidos con exito",
      ok: true,
      data: formatedResponse,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

module.exports = {
  createSolicitud,
  getSolicitudes,
};
