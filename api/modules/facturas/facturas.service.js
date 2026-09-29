const { CustomError } = require("../../../middleware/errorHandler");
const repository = require("./facturas.repository");

// Campos editables vía PATCH /factura/:id_factura.
const ALLOWED_FIELDS = new Set(["uuid_crp"]);

const MAX_LENGTHS = {
  uuid_crp: 50,
};

class FacturasService {
  /**
   * @param {string} id_factura
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<object>}
   */
  async getById(id_factura, conn = null) {
    if (!id_factura) {
      throw new CustomError("id_factura es requerido", 400, "VALIDATION_ERROR");
    }

    const factura = await repository.findById(id_factura, conn);

    if (!factura) {
      throw new CustomError(
        `Factura ${id_factura} no encontrada`,
        404,
        "FACTURA_NOT_FOUND",
      );
    }

    return factura;
  }

  async getAll(filters = {}, conn = null) {
    return repository.findAll(filters, conn);
  }

  /**
   * Update genérico y acotado por ALLOWED_FIELDS de los campos generales de
   * facturas (por ahora, solo uuid_crp).
   * @param {string} id_factura
   * @param {Record<string, unknown>} fields
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async editarCamposGenerales(id_factura, fields = {}, conn = null) {
    if (!id_factura) {
      throw new CustomError("id_factura es requerido", 400, "VALIDATION_ERROR");
    }

    const keys = Object.keys(fields).filter((k) => fields[k] !== undefined);

    if (keys.length === 0) {
      throw new CustomError(
        "No se enviaron campos para actualizar",
        400,
        "VALIDATION_ERROR",
      );
    }

    const camposInvalidos = keys.filter((k) => !ALLOWED_FIELDS.has(k));
    if (camposInvalidos.length > 0) {
      throw new CustomError(
        `Campo(s) no permitido(s) para actualizar: ${camposInvalidos.join(", ")}`,
        400,
        "VALIDATION_ERROR",
        { permitido: Array.from(ALLOWED_FIELDS) },
      );
    }

    const fieldsToUpdate = {};

    for (const key of keys) {
      const value = fields[key];
      const normalized = value === "" ? null : value;

      if (normalized !== null && typeof normalized !== "string") {
        throw new CustomError(`El campo ${key} debe ser texto`, 400, "VALIDATION_ERROR");
      }

      if (normalized !== null && normalized.length > MAX_LENGTHS[key]) {
        throw new CustomError(
          `El campo ${key} excede el máximo de ${MAX_LENGTHS[key]} caracteres`,
          400,
          "VALIDATION_ERROR",
        );
      }

      fieldsToUpdate[key] = normalized;
    }

    const affectedRows = await repository.updateFields(id_factura, fieldsToUpdate, conn);

    if (affectedRows === 0) {
      throw new CustomError(
        `Factura ${id_factura} no encontrada`,
        404,
        "FACTURA_NOT_FOUND",
      );
    }

    return { id_factura, ...fieldsToUpdate };
  }

  /**
   * Vincula un pago/saldo existente a una factura existente, repartiendo el
   * monto entre las reservas que cubre (items_pagos) hasta donde alcance el
   * saldo pendiente de la factura. No crea facturas, no edita `items`.
   * @param {object} body - { raw_id, uuid_factura }
   * @param {import('mysql2/promise').PoolConnection} conn
   * @returns {Promise<{id_factura: string, raw_id: string, monto_aplicado: number, items_facturados: number}>}
   */
  async vincularPago(body, conn) {
    const { raw_id, uuid_factura } = body || {};

    if (raw_id === undefined || raw_id === null || String(raw_id).trim() === "") {
      throw new CustomError("raw_id es requerido", 400, "VALIDATION_ERROR");
    }
    if (!uuid_factura) {
      throw new CustomError("uuid_factura es requerido", 400, "VALIDATION_ERROR");
    }

    const rawIdStr = String(raw_id).trim();
    const isPago = rawIdStr.toLowerCase().startsWith("pag-");
    const fkColumn = isPago ? "id_pago" : "id_saldo_a_favor";

    const pagoOrSaldo = isPago
      ? await repository.findPago(rawIdStr, conn)
      : await repository.findSaldo(rawIdStr, conn);

    if (!pagoOrSaldo) {
      throw new CustomError(
        `${isPago ? "Pago" : "Saldo"} no encontrado: ${rawIdStr}`,
        400,
        "PAGO_O_SALDO_NO_ENCONTRADO",
      );
    }

    const factura = await repository.findByUuidFacturaConSaldo(uuid_factura, conn);
    if (!factura) {
      throw new CustomError(
        `Factura no encontrada para uuid_factura: ${uuid_factura}`,
        404,
        "FACTURA_NOT_FOUND",
      );
    }

    const yaTieneReservas = await repository.tieneItemsFacturas(factura.id_factura, conn);
    if (yaTieneReservas) {
      throw new CustomError(
        `La factura ${factura.id_factura} ya tiene reservas asignadas — revisar antes de continuar`,
        409,
        "FACTURA_YA_TIENE_ITEMS",
      );
    }

    // Reparto de un pago/saldo entre las reservas que cubre, respetando
    // facturación parcial entre MÚLTIPLES facturas para el mismo pago.
    //
    // Por qué existe esto: un pago puede ser más grande que una sola factura
    // (ej. pago de $10,000 repartido en dos facturas de $5,000 y $3,000, en
    // dos llamadas distintas a este endpoint). `findItemsPagosPorPagos` ya
    // resuelve "monto pagado de la reserva (items_pagos) MENOS lo que esa
    // reserva ya tiene facturado en items_facturas (de CUALQUIER factura)" y
    // descarta las reservas ya facturadas al 100% — así, una segunda llamada
    // con el mismo pago nunca vuelve a ofrecer una reserva ya cubierta, ni
    // duplica el monto de una que quedó parcial. Ver el JSDoc de ese método
    // en facturas.repository.js para el detalle de la query.
    //
    // Aquí solo queda repartir "hasta donde alcance" el saldo pendiente de
    // ESTA factura: se llenan reservas completas en orden (más antigua
    // primero) hasta que el saldo no alcanza para la siguiente completa, esa
    // última se factura parcial, y ahí se detiene (no se tocan las que
    // quedan después). Reutilizable tal cual si se necesita este mismo
    // patrón de "facturación parcial por reserva" en otro flujo — la pieza
    // clave a copiar es `findItemsPagosPorPagos` + este loop.
    const idsPagos = isPago ? [rawIdStr] : await repository.findPagosPorSaldo(rawIdStr, conn);
    const items = idsPagos.length
      ? await repository.findItemsPagosPorPagos(idsPagos, conn)
      : [];

    const facturaSaldo = Number(factura.saldo);
    let saldoRestante = facturaSaldo;
    const itemsAFacturar = [];

    for (const item of items) {
      if (saldoRestante <= 0) break;
      const montoItem = Number(item.monto); // ya es "disponible", no el monto pagado original
      if (montoItem <= saldoRestante) {
        itemsAFacturar.push({ id_item: item.id_item, monto: montoItem });
        saldoRestante -= montoItem;
      } else {
        itemsAFacturar.push({ id_item: item.id_item, monto: saldoRestante });
        saldoRestante = 0;
        break;
      }
    }

    let montoAplicado = itemsAFacturar.reduce((acc, it) => acc + it.monto, 0);

    // Fallback: no había items_pagos que repartir (pago/saldo sin desglose por
    // reserva) — usar el monto base del pago/saldo, capado por lo que alcance
    // la factura, y no tocar items_facturas (no hay nada que repartir).
    if (itemsAFacturar.length === 0) {
      const montoBase = isPago ? Number(pagoOrSaldo.total) : Number(pagoOrSaldo.saldo);
      montoAplicado = Math.min(montoBase, facturaSaldo);
    }

    if (itemsAFacturar.length > 0) {
      await repository.insertItemsFacturasBatch(factura.id_factura, itemsAFacturar, conn);
    }

    await repository.insertFacturaPagoLink(
      { fkColumn, raw_id: rawIdStr, id_factura: factura.id_factura, monto: montoAplicado },
      conn,
    );

    return {
      id_factura: factura.id_factura,
      raw_id: rawIdStr,
      monto_aplicado: montoAplicado,
      items_facturados: itemsAFacturar.length,
    };
  }

  /**
   * Quita el vínculo de un pago/saldo con una factura (solo
   * facturas_pagos_y_saldos). facturas.saldo se recalcula solo vía trigger.
   * NO toca items_facturas a propósito — si quedó algo ahí de esa factura,
   * es responsabilidad de quien llame limpiarlo aparte (ej. con
   * desasociarReservaFactura, v1).
   * @param {object} body - { raw_id, id_factura }
   * @param {import('mysql2/promise').PoolConnection} conn
   * @returns {Promise<{id_factura: string, raw_id: string, desvinculado: boolean}>}
   */
  async desvincularPago(body, conn) {
    const { raw_id, id_factura } = body || {};

    if (raw_id === undefined || raw_id === null || String(raw_id).trim() === "") {
      throw new CustomError("raw_id es requerido", 400, "VALIDATION_ERROR");
    }
    if (!id_factura) {
      throw new CustomError("id_factura es requerido", 400, "VALIDATION_ERROR");
    }

    const rawIdStr = String(raw_id).trim();
    const isPago = rawIdStr.toLowerCase().startsWith("pag-");
    const fkColumn = isPago ? "id_pago" : "id_saldo_a_favor";

    const affectedRows = await repository.deleteFacturaPagoLink(
      { fkColumn, raw_id: rawIdStr, id_factura },
      conn,
    );

    if (affectedRows === 0) {
      throw new CustomError(
        `No se encontró vínculo entre ${rawIdStr} y la factura ${id_factura}`,
        404,
        "VINCULO_NO_ENCONTRADO",
      );
    }

    return { id_factura, raw_id: rawIdStr, desvinculado: true };
  }
}

module.exports = new FacturasService();
