const { getByEmail } = require("./contacts");
const { executeQuery } = require("../../config/db");

const subirTicketSolicitudZoho = async ({ id }) => {
  if (!id) throw new Error("Falta el id del cliente");

  const [agente] = await executeQuery(
    `SELECT * FROM agente_details WHERE id_agente = ?`,
    [id]
  );

  if (!agente) throw new Error("No se encontró el agente");

  if (!agente.email) throw new Error("No se encontró el email del agente");

  // const { page } = req.query;
  // await createTicketZoho({
  //   // email: "luisacast.29@gmail.com",
  //   contactId: "603403000000819002",
  //   departmentId: DEPARTMENTS.IA,
  //   subject: "PRUEBA",
  //   description: "Creacion de ticket desde API",
  // });
  // const ticket = await getTicketZoho("603403000036487303");
  // console.log("Ticket de prueba obtenido:", ticket);
  // const contacts = await createContact({
  //   email: "luisacast.29@gmail.com",
  //   firstName: "Angel",
  //   lastName: "Castañon",
  // });

  return agente;

  // let user;
  // user = await getByEmail(email);
  // if (!user) user = await createContact({email, firstName:"", lastName:"Desconocido"});
};

module.exports = {
  subirTicketSolicitudZoho,
};
