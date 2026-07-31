const { validate } = require("../../../../v4/utils/validate");
const { CustomError } = require("../../../../middleware/errorHandler");

const { crearPagosDesdeDispersionSchema } = require("./dispersionPagos.schema");
const repository = require("./dispersionPagos.repository");
const dispersionService = require("../dispersion.service");

class DispersionPagosService {
  /**
   * Crea un pago completo (pago_proveedores) por cada id_dispersion_pagos_proveedor
   * recibido. El monto_pagado siempre es el monto_solicitado de esa dispersión —
   * no es editable ni parcial. Pensado para correr dentro de runTransaction
   * (todo o nada: si algún id no existe o ya tiene pago, no se crea ninguno).
   * @param {object} payload - ver dispersionPagos.schema.js
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async crearPagosDesdeDispersion(payload, conn = null) {
    const data = validate(crearPagosDesdeDispersionSchema, payload);
    const ids = [...new Set(data.ids_dispersion)];

    const dispersionPorId = await dispersionService.getByIds(ids, conn);

    const existentes = await repository.findExistingByDispersionIds(ids, conn);
    if (existentes.length > 0) {
      throw new CustomError(
        `Ya existe un pago para la(s) dispersión(es): ${existentes.join(", ")}`,
        409,
        "PAGO_YA_EXISTE",
        { ids_con_pago: existentes },
      );
    }

    const fechaPago = new Date();

    const rows = ids.map((id) => {
      const dispersion = dispersionPorId.get(id);
      const monto = Number(dispersion.monto_solicitado);

      return [
        id,
        dispersion.id_solicitud_proveedor,
        dispersion.codigo_dispersion,
        monto,
        fechaPago,
        data.url_pdf,
        data.concepto ?? null,
        monto,
        monto,
      ];
    });

    const insertResult = await repository.insertPagos(rows, conn);

    return {
      ids_dispersion: ids,
      pagos_creados: Number(insertResult.affectedRows ?? 0),
      url_pdf: data.url_pdf,
    };
  }
}

module.exports = new DispersionPagosService();
