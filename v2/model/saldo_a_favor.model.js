const db = require("../../config/db");
const { Calculo } = require("../../lib/utils/calculates");
const { Formato } = require("../../lib/utils/formats");
const ERROR = require("../constant/messages");
const { Validacion } = require("../../lib/utils/validates");
const PAGOS = require("./pagos.model");
const { SALDOS_A_FAVOR: schema } = require("./schema");
const FPS = require("./facturas_pagos_saldos.model");

const create = async (conn, saldo) => {
  Validacion.uuidfk(saldo.id_agente);
  if (saldo.saldo > saldo.monto) throw new Error(ERROR.SALDO.INVALID);
  saldo = {
    ...saldo,
    saldo: Calculo.precio({ total: saldo.saldo }).total,
    monto: Calculo.precio({ total: saldo.monto }).total,
  };
  return await db.insert(conn, schema, saldo);
};

const update = async (conn, saldo) => {
  Validacion.numberid(saldo.id_saldos);
  const precioFormat = {
    saldo: Calculo.precio({ total: saldo.saldo }).total,
    monto: Calculo.precio({ total: saldo.monto }).total,
  };
  saldo = {
    ...saldo,
    ...Object.entries(precioFormat)
      .filter(([_, v]) => !!v)
      .map(([k, v]) => ({ [k]: v }))
      .reduce((p, c) => ({ ...p, ...c }), {}),
  };
  return await db.update(conn, schema, saldo);
};

const getById = async (...ids) => {
  ids.forEach((id) => Validacion.numberid(id));
  const saldos = await db.getByIds(schema, ...ids);
  return saldos;
};

/*Este solo ejecuta el regreso del wallet, aun falta manejar lo de facturas y items y eso jaja*/
const return_wallet = async (conn, id, devolver) => {
  devolver = Formato.number(devolver);
  const isFacturada = await PAGOS.isFacturado(id);
  const { pago: p, monto_facturado, is_facturado, total_monto } = isFacturada;
  const isSaldo = !!p.id_saldo_a_favor;
  let saldo;

  if (Formato.number(p.saldo_aplicado ?? p.total) - devolver < 0)
    throw new Error(ERROR.SALDO.LIMITEXCEEDED);

  if (!isSaldo) {
    const [createSaldo, [response]] = await create(
      conn,
      Calculo.cleanEmpty({
        id_agente: p.id_agente ?? p.responsable_pago_agente,
        fecha_creacion: p.created_at,
        saldo: Formato.number(devolver),
        monto: Formato.number(p.total),
        metodo_pago: (p.metodo_de_pago || "").toLowerCase(),
        fecha_pago: p.fecha_pago ?? p.created_at,
        concepto: p.concepto,
        referencia: p.referencia,
        currency: p.currency,
        tipo_tarjeta: Formato.tipo_tarjeta(p.tipo_de_tarjeta),
        comentario: `Devolución de saldo, por reducción de pago en el servicio ${p.id_servicio}`,
        link_stripe: p.link_pago,
        is_facturable: !Boolean(is_facturado),
        ult_digits: p.last_digits,
        numero_autorizacion: p.autorizacion_stripe,
        banco_tarjeta: p.banco,
        is_facturado: Boolean(is_facturado),
        monto_facturado: monto_facturado || 0,
        is_devolucion: true,
      })
    );
    saldo = { ...createSaldo, id_saldos: response.insertId };
    if (Formato.number(monto_facturado) > 0) {
      FPS.updateByPago(conn, {
        id_pago: p.id_pago,
        id_saldo_a_favor: saldo.id_saldos,
      });
    }
  }

  if (isSaldo) {
    const [csaldo] = await getById(p.id_saldo_a_favor);
    await update(conn, {
      id_saldos: csaldo.id_saldos,
      saldo: Formato.number(csaldo.saldo) + devolver,
    });
    saldo = { ...csaldo };
  }

  await PAGOS.update(conn, {
    id_pago: p.id_pago,
    saldo_aplicado:
      (isSaldo ? Formato.number(p.saldo_aplicado) : Formato.number(p.total)) -
      devolver,
    ...(isSaldo ? {} : { id_saldo_a_favor: saldo.id_saldos }),
  });

  return [saldo, isFacturada];
};

module.exports = { update, create, return_wallet, getById };
