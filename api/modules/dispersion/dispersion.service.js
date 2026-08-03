const { validate, validateArrayIds } = require("../../../v4/utils/validate");
const { generateDispersionId } = require("../../../v4/utils/id");
const { CustomError } = require("../../../middleware/errorHandler");
const { sendEmail } = require("../../../services/email");

const { createDispersionSchema } = require("./dispersion.schema");
const { buildDispersionEmail } = require("./dispersion.email");
const repository = require("./dispersion.repository");

const solicitudesService = require("../pagoProveedores/solicitudes/pagoProveedoresSolicitudes.service");
const reservasService = require("../pagoProveedores/reservas/pagoProveedoresReservas.service");
const cuentasService = require("../proveedores/cuentas/proveedoresCuentas.service");
const dispersionPagosRepository = require("./pagos/dispersionPagos.repository");

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
   * Lista dispersiones y agrega, por cada id_solicitud_proveedor, la info de
   * la solicitud correspondiente (sin facturas). Merge plano por fila: en
   * colisión de nombres (monto_solicitado, saldo) gana el valor de dispersión.
   * @param {object} [filters={}] - ver dispersion.repository.js#findAll
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<{ rows: object[], total: number|null, hasPagination: boolean }>}
   */
  async getAll(filters = {}, conn = null) {
    const page = filters.page !== undefined ? Number(filters.page) : undefined;
    const length = filters.length !== undefined ? Number(filters.length) : undefined;

    if (page !== undefined && (!Number.isFinite(page) || page < 1)) {
      throw new CustomError("page debe ser un número mayor a 0", 400, "VALIDATION_ERROR");
    }
    if (length !== undefined && (!Number.isFinite(length) || length < 1)) {
      throw new CustomError("length debe ser un número mayor a 0", 400, "VALIDATION_ERROR");
    }

    const { rows, total, hasPagination } = await repository.findAll(filters, conn);
    if (rows.length === 0) {
      return { rows: [], total, hasPagination };
    }

    const ids = [...new Set(rows.map((r) => r.id_solicitud_proveedor))];
    const idsCuentas = [...new Set(rows.map((r) => r.id_proveedor_cuenta).filter(Boolean))];

    const [{ rows: solicitudes }, cuentas] = await Promise.all([
      reservasService.getAll({ ids }, conn),
      idsCuentas.length > 0 ? cuentasService.getByIds(idsCuentas, conn) : Promise.resolve([]),
    ]);

    const solicitudPorId = new Map(solicitudes.map((s) => [s.id_solicitud_proveedor, s]));
    const cuentaPorId = new Map(cuentas.map((c) => [Number(c.id), c]));

    const merged = rows.map((row) => ({
      ...solicitudPorId.get(row.id_solicitud_proveedor),
      ...row,
      cuenta: cuentaPorId.get(Number(row.id_proveedor_cuenta)) ?? null,
    }));

    return { rows: merged, total, hasPagination };
  }

  /**
   * Trae filas de dispersion_pagos_proveedor por su propio PK. Lanza si falta alguna.
   * @param {number[]} ids - id_dispersion_pagos_proveedor
   * @param {import('mysql2/promise').PoolConnection} [conn]
   * @returns {Promise<Map<number, object>>}
   */
  async getByIds(ids, conn = null) {
    validateArrayIds(ids);

    const rows = await repository.findByIds(ids, conn);
    const dispersionPorId = new Map(rows.map((r) => [Number(r.id_dispersion_pagos_proveedor), r]));

    const faltantes = ids.filter((id) => !dispersionPorId.has(id));
    if (faltantes.length > 0) {
      throw new CustomError(
        "No se encontró una o más dispersiones en dispersion_pagos_proveedor",
        400,
        "DISPERSION_NOT_FOUND",
        { faltantes },
      );
    }

    return dispersionPorId;
  }

  /**
   * Elimina todas las filas de dispersion_pagos_proveedor asociadas a un
   * codigo_dispersion. No toca solicitudes_pago_proveedor.estado_solicitud
   * (queda como 'DISPERSION', se acepta la inconsistencia). Bloquea el
   * borrado si alguna fila ya tiene un pago creado. Pensado para correr
   * dentro de runTransaction.
   * @param {string} codigo - codigo_dispersion
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async eliminarPorCodigo(codigo, conn = null) {
    if (!codigo || typeof codigo !== "string" || !codigo.trim()) {
      throw new CustomError("codigo_dispersion es obligatorio", 400, "VALIDATION_ERROR");
    }

    const rows = await repository.findByCodigo(codigo, conn);
    if (rows.length === 0) {
      throw new CustomError("No se encontró ninguna dispersión con ese código", 404, "DISPERSION_NOT_FOUND");
    }

    const ids = rows.map((r) => r.id_dispersion_pagos_proveedor);

    const existentes = await dispersionPagosRepository.findExistingByDispersionIds(ids, conn);
    if (existentes.length > 0) {
      throw new CustomError(
        "No se puede eliminar: ya existen pagos creados para esta dispersión",
        409,
        "PAGO_YA_EXISTE",
        { ids_con_pago: existentes },
      );
    }

    const result = await repository.deleteByIds(ids, conn);

    return { codigo_dispersion: codigo, ids_eliminados: ids, eliminados: result.affectedRows };
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
