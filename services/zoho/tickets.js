const { getAccessToken } = require("./config");

/**
 * Crea un ticket en Zoho Desk usando la API de tickets.
 *
 * @async
 * @param {Object} options - Opciones para crear el ticket.
 * @param {string} [options.subject="Sin Asunto"] - Asunto del ticket.
 * @param {string} [options.description=""] - Descripción o cuerpo del ticket.
 * @param {string|number} options.departmentId - ID del departamento al que pertenece el ticket. (Requerido)
 * @param {string|number} options.contactId - ID del contacto asociado al ticket. (Requerido)
 * @param {string} [options.priority="High"] - Prioridad del ticket (p. ej. "Low", "Medium", "High").
 * @param {string} [options.status="Open"] - Estado inicial del ticket (p. ej. "Open", "Closed").
 *
 * @returns {Promise<Object>} Promesa que se resuelve con el objeto JSON devuelto por la API de Zoho Desk.
 *
 * @throws {Error} Lanza un error si faltan departmentId o contactId, o si ocurre un fallo durante la petición (p. ej. error de red o respuesta no JSON).
 *
 * @example
 * // Uso:
 * await createTicketZoho({
 *   subject: "Problema con el pedido",
 *   description: "El cliente reporta que no llegó el paquete.",
 *   departmentId: 123456,
 *   contactId: 654321,
 *   priority: "High",
 *   status: "Open"
 * });
 */

const createTicketZoho = async ({
  subject = "Sin Asunto",
  description = "",
  departmentId,
  contactId,
  priority = "High",
  status = "Open",
  email = null,
}) => {
  try {
    if (!departmentId || !(contactId || email)) {
      throw new Error("departmentId y (contactId o email) son obligatorios");
    }

    const ticket_info = {
      subject,
      description,
      departmentId,
      contactId,
      priority,
      status,
      // channel: "Email",
      email,
    };

    const access_token = await getAccessToken();

    let response = await fetch("https://desk.zoho.com/api/v1/tickets", {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${access_token}`,
      },
      body: JSON.stringify(ticket_info),
    });

    let data = await response.json();

    return data;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

async function getTicketZoho(ticketId) {
  if (!ticketId) throw new Error("Falta el id del ticket");

  let accessToken = await getAccessToken();
  const url = `https://desk.zoho.com/api/v1/tickets/${ticketId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const ticketData = await response.json();

    return ticketData;
  } catch (error) {
    console.error("Error al obtener el ticket:", error);
    throw error;
  }
}

module.exports = {
  createTicketZoho,
  getTicketZoho,
};
