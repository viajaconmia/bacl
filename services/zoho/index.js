const { getByEmail, createContact } = require("./contacts");
const { executeQuery } = require("../../config/db");
const { DEPARTMENTS } = require("../../lib/constant");
const { createTicketZoho } = require("./tickets");

const subirTicketSolicitudZoho = async ({ id, servicio }) => {
  if (!id) throw new Error("Falta el id del cliente");

  const [agente] = await executeQuery(
    `SELECT * FROM agente_details WHERE id_agente = ?`,
    [id]
  );

  if (!agente) throw new Error("No se encontró el agente");
  if (!agente.correo) throw new Error("No se encontró el email del agente");

  let user;
  user = await getByEmail(agente.correo);
  console.log(user);
  if (!user)
    user = await createContact({
      email: agente.correo,
      firstName:
        [agente.primer_nombre, agente.segundo_nombre]
          .filter(Boolean)
          .join(" ")
          .replaceAll("  ", " ")
          .trim() || "",
      lastName:
        [agente.apellido_paterno, agente.apellido_materno]
          .filter(Boolean)
          .join(" ")
          .replaceAll("  ", " ")
          .trim() || "",
    });

  await createTicketZoho({
    contactId: user.id,
    departmentId: DEPARTMENTS.IA,
    subject:
      "prueba" ||
      `SPRUEBAAAAAAAAAAAA: solicitud de cotización - Agente: ${agente.nombre}`,
    description: `<a href="http://localhost:3000/dashboard/solicitudes/cotizaciones?service=${servicio}">http://localhost:3000/dashboard/solicitudes/cotizaciones?service=${servicio}</a>`,
  });
  return user;
};

module.exports = {
  subirTicketSolicitudZoho,
};
