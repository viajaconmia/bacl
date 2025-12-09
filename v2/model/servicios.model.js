/**
 * Service model for managing service records in the database
 * @module servicios.model
 */

const { Calculo } = require("../../lib/utils/calculates");
const { Validacion } = require("../../lib/utils/validates");
const db = require("../../config/db");
const { SERVICIOS: schema } = require("./schema");

/**
 * Creates a new service record with generated UUID and calculated pricing
 * @async
 * @function create
 * @param {Object} conn - Database connection object
 * @param {Object} servicio - Service object to create
 * @param {string} [servicio.id_servicio] - Unique service identifier (auto-generated with "ser-" prefix)
 * @param {number} servicio.subtotal - Service subtotal amount
 * @param {number} servicio.impuestos - Tax amount
 * @param {number} servicio.otros_impuestos - Additional taxes
 * @param {number} servicio.total - Total amount (calculated)
 * @param {boolean} servicio.is_credito - Whether service is on credit
 * @param {boolean} servicio.is_cotizacion - Whether service is on credit
 * @param {string} servicio.fecha_limite_pago - Payment deadline date
 * @param {string} servicio.id_agente - Agent identifier
 * @param {string} servicio.id_empresa - Company identifier
 * @returns {Promise<Object>} Created service record with generated id
 */
const create = async (conn, servicio) => {
  servicio = Calculo.uuid(servicio, "id_servicio", "ser-");
  servicio = Calculo.precio(servicio);
  return await db.insert(conn, schema, servicio);
};

/**
 * Updates an existing service record with validation and pricing recalculation
 * @async
 * @function update
 * @param {Object} conn - Database connection object
 * @param {Object} servicio - Service object to update
 * @param {string} servicio.id_servicio - Unique service identifier (required for validation)
 * @param {number} [servicio.subtotal] - Service subtotal amount
 * @param {number} [servicio.impuestos] - Tax amount
 * @param {number} [servicio.otros_impuestos] - Additional taxes
 * @param {number} [servicio.total] - Total amount (recalculated)
 * @param {boolean} [servicio.is_credito] - Whether service is on credit
 * @param {string} [servicio.fecha_limite_pago] - Payment deadline date
 * @param {string} [servicio.id_agente] - Agent identifier
 * @param {string} [servicio.id_empresa] - Company identifier
 * @returns {Promise<Object>} Updated service record
 * @throws {Error} If id_servicio validation fails
 */
const update = async (conn, servicio) => {
  Validacion.uuid(servicio.id_servicio);
  servicio = Calculo.precio(servicio);
  return await db.update(conn, schema, servicio);
};

module.exports = { update, create };
