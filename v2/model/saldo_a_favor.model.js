const db = require("../../config/db");
const { Calculo, now } = require("../../lib/utils/calculates");
const { Formato } = require("../../lib/utils/formats");
const ERROR = require("../../lib/utils/messages");
const { Validacion } = require("../../lib/utils/validates");
const PAGOS = require("./pagos.model");
const { SALDOS_A_FAVOR: schema } = require("./schema");

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

/*Este solo ejecuta el regreso del wallet, aun falta manejar lo de facturas y items y eso jaja*/
const return_wallet = async (conn, id, devolver) => {
  devolver = Formato.number(devolver);
  const isFacturada = await PAGOS.isFacturado(id);
  const { pago: p, monto_facturado, is_facturado } = isFacturada;
  const isSaldo = !!p.id_saldo_a_favor;
  const [saldo, [response]] = await create(
    conn,
    Calculo.cleanEmpty({
      id_agente: p.id_agente ?? p.responsable_pago_agente,
      fecha_creacion: isSaldo ? now() : p.created_at,
      saldo: Formato.number(devolver),
      monto: Formato.number(isSaldo ? devolver : p.total),
      metodo_pago: (isSaldo ? "wallet" : p.metodo_de_pago || "").toLowerCase(),
      fecha_pago: isSaldo ? now() : p.fecha_pago ?? p.created_at,
      concepto: isSaldo
        ? `Devolución de pago por reserva: ${p.id_servicio}`
        : p.concepto,
      referencia: isSaldo ? " " : p.referencia,
      currency: isSaldo ? "mxn" : p.currency,
      tipo_tarjeta: isSaldo ? null : Formato.tipo_tarjeta(p.tipo_de_tarjeta),
      comentario: isSaldo
        ? `Devolución realizada por un pago de wallet, el id del pago es: ${p.id_pago}`
        : `Devolución de saldo, por reducción de pago en el servicio ${p.id_servicio}`,
      link_stripe: isSaldo ? null : p.link_pago,
      is_facturable: isSaldo ? false : !is_facturado,
      ult_digits: isSaldo ? null : p.last_digits,
      numero_autorizacion: isSaldo ? null : p.autorizacion_stripe,
      banco_tarjeta: isSaldo ? null : p.banco,
      is_facturado: isSaldo ? false : is_facturado,
      monto_facturado: isSaldo ? 0 : monto_facturado || 0,
      is_devolucion: true,
    })
  );
  console.log(response);
  const id_saldo = response.insertId;
  if (!isSaldo) {
    await PAGOS.update(conn, {
      id_pago: p.id_pago,
      saldo_aplicado: devolver,
      id_saldo_a_favor: id_saldo,
    });
  }

  return [{ ...saldo, id_saldo }, isFacturada];
};

module.exports = { update, create, return_wallet };

/* Para cada caso se debera ver que afecta la facturación y si ya esta pagado y si son varios (menos en pago directo que solo hay uno)
caso 1.- Pago directo
caso 2.- Pago con saldos (varios)
caso 3.- Pago con credito
caso 4.- Pago con credito ya pagado  */

/* Caso 1.- 
Duplicar un wallet con su valor
agregar al wallet la diferencia que se regreso que es el saldo restante
Verificar si esta facturado y al saldo agregarle si es facturable y si esta facturado
Cambiar el valor del pago agregando saldo usado y el id_saldo
Cambiar los items conectados a ese pago disminuyendo y spliteando el valor actual del pago y quitando el valor de los que se dejaron de usar updateando a 0
editar los items que se quedaron en 0 y desactivarlos
editar los items que estan bien y updatear su nuevo total y el is_facturado si esta facturado igual el monto facturado

Verificar si esta facturado el pago 
si esta facturado regresar a la factura la diferencia en saldo x aplicar items
en items_facturas borrar los no ocupados con monto 0, actualizar valor de facturación al nuevo, tomando como limite el monto de la factura menos el saldo por aplicar o algo asi, verificar logica
guardar en facturas pagos y saldos el id saldo  */
