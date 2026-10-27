const { CustomError } = require("../../../middleware/errorHandler");

const BUCKET = () => process.env.COTIZACIONES_BUCKET || "cotizaciones-mia";

class CotizacionesIaStorage {
  /**
   * URL temporal de un archivo del bucket privado de Supabase Storage.
   * El cliente de Supabase se resuelve al usarse para no abrirlo al importar el módulo.
   * @returns {Promise<string>}
   */
  async createSignedUrl(storagePath, expiresIn = 300) {
    const bucket = BUCKET();
    let result;
    try {
      const { supabase } = require("../../../config/auth");
      result = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, expiresIn);
    } catch (error) {
      // El motivo interno (puede traer hosts o rutas) se queda en el log del servidor.
      console.error("cotizaciones-ia: fallo al conectar con Storage:", error.message);
      throw new CustomError(
        "No se pudo conectar con el almacenamiento de archivos",
        502,
        "STORAGE_ERROR",
        { bucket },
      );
    }

    const { data, error } = result;
    if (error || !data?.signedUrl) {
      console.error(
        "cotizaciones-ia: no se generó la URL firmada:",
        error?.message ?? "respuesta sin URL firmada",
      );
      throw new CustomError(
        `No se pudo generar el enlace del archivo. Verifica que exista el bucket privado "${bucket}" y que el archivo esté en él`,
        502,
        "STORAGE_ERROR",
        { bucket },
      );
    }
    return data.signedUrl;
  }
}

module.exports = new CotizacionesIaStorage();
module.exports.CotizacionesIaStorage = CotizacionesIaStorage;
