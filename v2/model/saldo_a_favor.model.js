const db = require("../../config/db");
const { Calculo } = require("../../lib/utils/calculates");
const { Formato } = require("../../lib/utils/formats");
const ERROR = require("../../lib/utils/messages");
const { Validacion } = require("../../lib/utils/validates");
const model = require("./db.model");
const { SALDOS_A_FAVOR: schema } = require("./schema");

const create = async (conn, saldo) => {
  Validacion.uuidfk(saldo.id_agente);
  if (saldo.saldo > saldo.monto) throw new Error(ERROR.SALDO.INVALID);
  saldo = {
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

const return_to_wallet = async (conn, id, devolver) => {
  const pago = await model.PAGO.getById(id);
  const [isFacturado, monto_facturado] = await model.PAGO.isFacturado(
    pago.id_pago
  );

  if (!pago.id_saldo_a_favor) {
    // Aqui verificamos que sea un pago directo
    Validacion.uuidfk(p.id_agente);

    const [saldo] = await model.SALDO.create(conn, {
      id_agente: p.id_agente,
      fecha_creacion: p.created_at,
      saldo: Formato.number(devolver),
      monto: Formato.number(p.total),
      metodo_pago: (p.metodo_de_pago || "").toLowerCase(),
      fecha_pago: p.fecha_pago,
      concepto: p.concepto,
      referencia: p.referencia,
      currency: p.currency,
      tipo_tarjeta: Formato.tipo_tarjeta(p.tipo_de_tarjeta),
      comentario: `Devolución de saldo, se realizo el dia: ${new Date().toISOString()}`,
      link_stripe: p.link_pago,
      is_facturable: !isFacturado,
      ult_digits: p.last_digits,
      numero_autorizacion: p.autorizacion_stripe,
      banco_tarjeta: p.banco,
      is_facturado: isFacturado,
      monto_facturado,
      is_devolucion: true,
    });
  }

  /**
   * Verificar poque creo que si fue pagado con wallet lo mejor es solo retornar un wallet no facturable, o no se
   */

  /**
   * 1.- extraer el pago ✅
   *
   * 2.- extraer el saldo a regresar del saldo ✅
   *
   * 3.- Verificar que no este facturado ✅
   *  3.1.- si esta facturado: facturable es false y is_facturado es true ✅
   *  3.2.- si no esta totalmente facturado: facturable es true y is_facturado es false ✅
   *
   * 4.- monto facturado es el saldo
   *
   * 5.- is devolucion es true
   *
   * 6.- en facturas poner en saldo a aplicar a items el valor del saldo regresado
   *
   * 7.- en facturas saldos y pagos asignar al id del pago el id del saldo
   *
   * 8.- en una funcion voy a pedir el numero de items, para en items y pagos poder splitear por el numero de items, extraer los items del pago para verificar si son menos o son mas y si son menos crearlos y si son mas debo poner en 0 el monto y dejar los que son
   *
   * 9.- En items debo colocar el monto facturado
   *
   * 10.- en items_facturas lo mismo que en items_pagos, debo agregar lo del spliteo de monto
   */
};

module.exports = { update, create };

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
