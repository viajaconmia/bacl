const { v4: uuidv4 } = require("uuid");
const { CustomError } = require("../../../middleware/errorHandler");
const defaultRepository = require("./cotizacionesIa.repository");
const defaultStorage = require("./cotizacionesIa.storage");
const {
  ESTADOS,
  TIPOS,
  validateCotizacion,
} = require("./cotizacionesIa.schema");

const ID_COTIZACION = /^cot-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_TTL_SECONDS = 300;
const MAX_LENGTH = 100;

const toPositiveInt = (value, name) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new CustomError(`'${name}' debe ser un entero mayor a 0`, 400, "VALIDATION_ERROR");
  }
  return number;
};

const assertIdCotizacion = (id) => {
  if (!ID_COTIZACION.test(String(id ?? ""))) {
    throw new CustomError("Id de cotización inválido", 400, "VALIDATION_ERROR");
  }
};

// La columna `tipos` guarda "flight,hotel"; la API lo expone como arreglo.
const splitTipos = (tipos) => (tipos ? String(tipos).split(",") : []);

class CotizacionesIaService {
  /**
   * Las dependencias se pueden inyectar para probar el servicio sin base de datos.
   * @param {{ repository?: object, storage?: object, runTransaction?: Function, idGenerator?: Function }} [deps]
   */
  constructor({ repository, storage, runTransaction, idGenerator } = {}) {
    this.repository = repository ?? defaultRepository;
    this.storage = storage ?? defaultStorage;
    this._runTransaction = runTransaction ?? null;
    this.idGenerator = idGenerator ?? (() => `cot-${uuidv4()}`);
  }

  // Se resuelve al usarse para no abrir el pool de la BD al importar el módulo.
  get runTransaction() {
    return this._runTransaction ?? require("../../../config/db").runTransaction;
  }

  /**
   * Crea la cotización con sus archivos en una sola transacción.
   * @param {object} body
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async create(body, conn = null) {
    const validation = validateCotizacion(body);
    if (!validation.ok) {
      throw new CustomError(
        "La cotización no es válida",
        400,
        "VALIDATION_ERROR",
        { issues: validation.issues },
      );
    }

    const { archivos, ...data } = validation.data;
    const id_cotizacion = this.idGenerator();
    const tipos = [...new Set(data.items.map((item) => item.type))].join(",");

    const persist = async (tx) => {
      await this.repository.insertCotizacion({ ...data, id_cotizacion, tipos }, tx);
      for (const archivo of archivos) {
        const idArchivo = await this.repository.insertArchivo(id_cotizacion, archivo, tx);
        await this.repository.updateUrlArchivo(
          idArchivo,
          `/v2/mia/cotizaciones-ia/${id_cotizacion}/archivos/${idArchivo}`,
          tx,
        );
      }
    };

    if (conn) await persist(conn);
    else await this.runTransaction(persist);

    return { id_cotizacion, estado: "nueva" };
  }

  /**
   * @param {{ estado?: string, tipo?: string, q?: string, page?: string|number, length?: string|number }} filters
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async getAll(filters = {}, conn = null) {
    const { estado, tipo, page, length } = filters;
    const q = typeof filters.q === "string" ? filters.q.trim() : "";

    if (estado && !ESTADOS.includes(estado)) {
      throw new CustomError(`'estado' debe ser uno de: ${ESTADOS.join(", ")}`, 400, "VALIDATION_ERROR");
    }
    if (tipo && !TIPOS.includes(tipo)) {
      throw new CustomError(`'tipo' debe ser uno de: ${TIPOS.join(", ")}`, 400, "VALIDATION_ERROR");
    }
    if ((page && !length) || (!page && length)) {
      throw new CustomError("Debes enviar 'page' y 'length' juntos para usar paginación", 400, "VALIDATION_ERROR");
    }

    const pagination = page && length
      ? {
          page: toPositiveInt(page, "page"),
          length: Math.min(toPositiveInt(length, "length"), MAX_LENGTH),
        }
      : {};

    const { rows, total, hasPagination } = await this.repository.findAll(
      { estado, tipo, q: q || undefined, ...pagination },
      conn,
    );

    return {
      rows: rows.map((row) => ({ ...row, tipos: splitTipos(row.tipos) })),
      total,
      hasPagination,
    };
  }

  /** @param {import('mysql2/promise').PoolConnection} [conn] */
  async getById(idCotizacion, conn = null) {
    assertIdCotizacion(idCotizacion);
    const cotizacion = await this.repository.findById(idCotizacion, conn);
    if (!cotizacion) {
      throw new CustomError("Cotización no encontrada", 404, "COTIZACION_NOT_FOUND");
    }
    const archivos = await this.repository.findArchivos(idCotizacion, conn);
    return { ...cotizacion, tipos: splitTipos(cotizacion.tipos), archivos };
  }

  /**
   * URL temporal para abrir un archivo original (el bucket es privado).
   * @param {import('mysql2/promise').PoolConnection} [conn]
   */
  async getArchivoUrl(idCotizacion, idArchivo, conn = null) {
    assertIdCotizacion(idCotizacion);
    const archivoId = toPositiveInt(idArchivo, "idArchivo");

    const archivo = await this.repository.findArchivo(idCotizacion, archivoId, conn);
    if (!archivo) {
      throw new CustomError("Archivo no encontrado", 404, "ARCHIVO_NOT_FOUND");
    }
    if (!archivo.storage_path) {
      throw new CustomError(
        "Este archivo no se pudo guardar al crear la cotización, no hay original para abrir",
        409,
        "ARCHIVO_SIN_ALMACENAMIENTO",
      );
    }

    const url = await this.storage.createSignedUrl(archivo.storage_path, SIGNED_URL_TTL_SECONDS);
    return { url, expiresIn: SIGNED_URL_TTL_SECONDS };
  }
}

module.exports = new CotizacionesIaService();
module.exports.CotizacionesIaService = CotizacionesIaService;
