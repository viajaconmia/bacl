const { getAccessToken } = require("./config");

const createContact = async ({ email, firstName = "", lastName }) => {
  try {
    if (!email || !lastName)
      throw new Error("email y lastName son obligatorios");

    const contact = { email, firstName, lastName };

    const access_token = await getAccessToken();

    let response = await fetch("https://desk.zoho.com/api/v1/contacts", {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${access_token}`,
      },
      body: JSON.stringify(contact),
    });
    if (response.status === 204) {
      return "creado con exito, no hay contenido";
    }
    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }
    let data = await response.json();

    //Se supone que el id es data.id
    return data;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getByEmail = async (email) => {
  try {
    if (!email) throw new Error("email es obligatorio");

    let continuar = true;
    let iteracion = 0;
    while (continuar) {
      const contactos = await getContactsPerPage(iteracion);
      if (contactos.length === 0) {
        continuar = false;
      }
      if (contactos.some((contact) => contact.email === email)) {
        return contactos.find((contact) => contact.email === email);
      }
      iteracion++;
    }
    return null;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getContactsPerPage = async (page = 0) => {
  try {
    const access_token = await getAccessToken();
    const limit = 100;
    const from = page * limit;

    let response = await fetch(
      `https://desk.zoho.com/api/v1/contacts?from=${from}&limit=${limit}`,
      {
        method: "GET",
        headers: {
          Authorization: `Zoho-oauthtoken ${access_token}`,
        },
      }
    );
    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }
    if (response.status === 204) {
      return [];
    }
    let data = await response.json();

    return data.data;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getContacts = async () => {
  try {
    let continuar = true;
    let iteracion = 0;
    let contacts = [];
    while (continuar) {
      const contactos = await getContactsPerPage(iteracion);
      if (contactos.length === 0) {
        continuar = false;
      }
      contacts.push(...contactos);
      iteracion++;
    }
    return contacts;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createContact,
  getContacts,
  getContactsPerPage,
  getByEmail,
};
