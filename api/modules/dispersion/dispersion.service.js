const { validate } = require("../../../v4/utils/validate");
const { generateDispersionId } = require("../../../v4/utils/id");
const { CustomError } = require("../../../middleware/errorHandler");
const { sendEmail } = require("../../../services/email");

const { createDispersionSchema } = require("./dispersion.schema");
const { buildDispersionEmail } = require("./dispersion.email");
const repository = require("./dispersion.repository");

const solicitudesService = require("../pagoProveedores/solicitudes/pagoProveedoresSolicitudes.service");
const reservasService = require("../pagoProveedores/reservas/pagoProveedoresReservas.service");
const cuentasService = require("../proveedores/cuentas/proveedoresCuentas.service");

const MAX_INTENTOS_CODIGO = 5;

class DispersionService {
  async #generarCodigoUnico(conn) {
    for (let i = 0; i < MAX_INTENTOS_CODIGO; i++) {
      const codigo = generateDispersionId();
      const existe = await repository.existsByCodigo(codigo, conn);
      if (!existe) return codigo;
    }
    throw new CustomError(
      "No se pudo generar un código de dispersión único, intenta de nuevo",
      500,
      "DISPERSION_ID_COLLISION",
    );
  }

  /**
   * Crea una dispersión: valida montos contra saldo_dispersion, inserta en
   * dispersion_pagos_proveedor y marca las solicitudes como DISPERSION.
   * Pensado para correr dentro de runTransaction.
   * @param {object} payload - body de la request (ver dispersion.schema.js)
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async createDispersion(payload, conn = null) {
    const data = validate(createDispersionSchema, payload);

    const solicitudMap = new Map(data.solicitudes.map((s) => [s.id_solicitud_proveedor, s]));
    const ids = [...solicitudMap.keys()];

    const saldos = await solicitudesService.getSaldosDispersion(ids, conn);

    for (const id of ids) {
      const { monto_dispersar } = solicitudMap.get(id);
      const { saldo_dispersion } = saldos.get(id);
      if (monto_dispersar > saldo_dispersion) {
        throw new CustomError(
          `El monto a dispersar (${monto_dispersar}) de la solicitud ${id} excede el saldo disponible (${saldo_dispersion})`,
          400,
          "MONTO_EXCEDE_SALDO",
          { id_solicitud_proveedor: id, monto_dispersar, saldo_dispersion },
        );
      }
    }

    const idDispersion = await this.#generarCodigoUnico(conn);

    const rows = ids.map((id) => {
      const s = solicitudMap.get(id);
      return [id, s.monto_dispersar, s.monto_dispersar, 0, idDispersion, s.fecha_pago ?? null, s.id_proveedor_cuenta];
    });

    const insertResult = await repository.insertDispersiones(rows, conn);
    await solicitudesService.marcarEnDispersion(ids, conn);

    const firstInsertId = Number(insertResult.insertId ?? 0);
    const insertedCount = Number(insertResult.affectedRows ?? 0);
    const idPagos =
      firstInsertId > 0 && insertedCount > 0
        ? Array.from({ length: insertedCount }, (_, i) => String(firstInsertId + i))
        : [];

    const solicitudesProcesadas = ids.map((id, index) => {
      const s = solicitudMap.get(id);
      const { saldo_dispersion } = saldos.get(id);
      return {
        id_pago: idPagos[index] ?? null,
        id_solicitud_proveedor: id,
        id_proveedor_cuenta: s.id_proveedor_cuenta,
        monto_dispersar: s.monto_dispersar,
        saldo_dispersion_db: saldo_dispersion,
        fecha_pago: s.fecha_pago ?? null,
        id_solicitud: s.id_solicitud ?? null,
        id_proveedor: s.id_proveedor ?? null,
        clave_proveedor: s.clave_proveedor ?? null,
        cuenta_de_deposito: s.cuenta_de_deposito ?? null,
        tipo_cuenta: s.tipo_cuenta ?? null,
        costo_proveedor: s.costo_proveedor ?? null,
        codigo_hotel: s.codigo_hotel ?? null,
      };
    });

    return {
      id_dispersion: idDispersion,
      referencia_numerica: data.referencia_numerica ?? null,
      motivo_pago: data.motivo_pago ?? null,
      layoutUrl: data.layoutUrl ?? null,
      ids,
      id_pagos: idPagos,
      solicitudes_procesadas: solicitudesProcesadas,
    };
  }

  /**
   * Efecto secundario post-commit: arma y envía el correo de aviso.
   * Nunca lanza — cualquier falla (datos de reservas/cuentas o el envío en sí)
   * degrada a `false`, la dispersión ya quedó comprometida en DB.
   * @param {object} result - lo que devuelve createDispersion
   * @returns {Promise<boolean>} correo_enviado
   */
  async notifyDispersionCreated(result) {
    try {
      const { rows: reservas } = await reservasService.getAll({ ids: result.ids });

      const idsCuentas = [
        ...new Set(result.solicitudes_procesadas.map((s) => s.id_proveedor_cuenta).filter(Boolean)),
      ];
      const cuentas = await cuentasService.getByIds(idsCuentas);

      const { subject, html } = buildDispersionEmail({
        idDispersion: result.id_dispersion,
        solicitudesProcesadas: result.solicitudes_procesadas,
        reservas,
        cuentas,
      });

      const destinatario =
        process.env.NODE_ENV === "production" ? "fin-cxp@noktos.com" : "luis.castaneda@noktos.com";

      await sendEmail(destinatario, { subject, html });
      return true;
    } catch (error) {
      console.error("Error enviando correo de dispersión:", error?.message);
      return false;
    }
  }
}

module.exports = new DispersionService();
