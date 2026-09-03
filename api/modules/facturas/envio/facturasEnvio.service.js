const { CustomError } = require("../../../../middleware/errorHandler");
const facturama = require("../../../Facturama/Facturama/facturama.api");
const facturasService = require("../facturas.service");
const repository = require("./facturasEnvio.repository");

class FacturasEnvioService {
  /**
   * @param {{ id_factura: string, correo_destino: string }} data
   * @param {{ id: string, name?: string }} user
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async enviarCorreo({ id_factura, correo_destino }, user, conn = null) {
    if (!id_factura) {
      throw new CustomError("id_factura es requerido", 400, "VALIDATION_ERROR");
    }
    if (!correo_destino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo_destino)) {
      throw new CustomError("correo_destino inválido", 400, "VALIDATION_ERROR");
    }
    if (!user?.id) {
      throw new CustomError(
        "Usuario no autenticado, por favor vuelve a iniciar sesión",
        401,
        "UNAUTHORIZED",
      );
    }

    const factura = await facturasService.getById(id_factura, conn);
    if (!factura.id_facturama) {
      throw new CustomError(
        "La factura no tiene folio de Facturama asociado",
        400,
        "FACTURAMA_ID_MISSING",
      );
    }

    let envio;
    try {
      envio = await facturama.Cfdi.Send(
        `cfdiId=${factura.id_facturama}&email=${encodeURIComponent(correo_destino)}&cfdiType=issued`,
      );
    } catch (error) {
      const message =
        error?.response?.data?.Message ||
        error.message ||
        "Error al enviar el correo en Facturama";
      throw new CustomError(
        message,
        error?.response?.status ?? 502,
        "FACTURAMA_SEND_ERROR",
      );
    }

    await repository.insert(
      { id_factura, correo_destino, id_usuario: user.id },
      conn,
    );

    return { facturama: envio };
  }

  /**
   * @param {string} id_factura
   * @param {{ page?: number|string|null, length?: number|string|null }} pagination
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async getHistorialByFactura(id_factura, { page, length } = {}, conn = null) {
    if (!id_factura) {
      throw new CustomError("id_factura es requerido", 400, "VALIDATION_ERROR");
    }

    return repository.findByFactura(id_factura, { page, length }, conn);
  }
}

module.exports = new FacturasEnvioService();
