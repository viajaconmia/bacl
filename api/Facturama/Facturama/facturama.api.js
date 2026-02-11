// services/facturama.js
const axios = require("axios");
const { valuesFacturama } = require("../../../config/auth");

const headers = {
  headers: {
    "User-Agent": valuesFacturama.useragent,
    Authorization: `Basic ${valuesFacturama.token}`,
  },
};

const facturama = () => {
  const settings = { url: valuesFacturama.url };

  const retrieve = async (path, id, type) => {
    const response = await axios.get(
      `${settings.url}${path}/${id}${type ? `?type=${type}` : ""}`,
      headers,
    );
    return response.data;
  };

  const list = async (path) => {
    const response = await axios.get(`${settings.url}${path}`, headers);
    return response.data;
  };

  const listWithParam = async (path, param) => {
    const response = await axios.get(
      `${settings.url}${path}?${param}`,
      headers,
    );
    return response.data;
  };

  const postSyncWithData = async (req, path, data) => {
    req?.context?.logStep?.("▶️ postSyncWithData", path);

    const response = await axios.post(`${settings.url}${path}`, data, {
      headers: {
        ...headers.headers,
        "Content-Type": "application/json",
      },
    });

    return response; // 👈 regresas el response completo como ya lo haces
  };

  const postSyncWithParams = async (path, params, data = {}) => {
    const response = await axios.post(
      `${settings.url}${path}?${params}`,
      data,
      {
        headers: { ...headers.headers, "Content-Type": "application/json" },
      },
    );
    return response.data;
  };

  const putSyncWithData = async (path, data) => {
    const response = await axios.put(`${settings.url}${path}`, data, {
      headers: { ...headers.headers, "Content-Type": "application/json" },
    });
    return response.data;
  };

  const deleteSyncWithParam = async (path, param) => {
    const response = await axios.delete(
      `${settings.url}${path}/${param}`,
      headers,
    );
    return response.data;
  };

  return {
    Cfdi: {
      Get: (id, type) => retrieve("cfdi", id, type),
      Create3: (data, req) => postSyncWithData(req, "3/cfdis", data),
      Send: (param) => postSyncWithParams("cfdi", param),
      Cancel: (params) => deleteSyncWithParam("cfdi", params),
      Download: (format, type, id) => retrieve(`cfdi/${format}/${type}`, id),
      List: (rfc) => listWithParam("cfdi", `type=issued&keyword=${rfc}`),
      ListByDates: (dateStart, dateEnd) =>
        listWithParam("cfdi", `dateStart=${dateStart}&dateEnd=${dateEnd}`),
    },

    // 👇 ADDENDA / ADDENDAS
    Addenda: {
      Create: (req, addendaType, data) =>
        postSyncWithData(
          req,
          `Addendas?addendaType=${encodeURIComponent(addendaType)}`,
          data,
        ),
    },

    Clients: {
      Get: (id) => retrieve("client", id),
      List: () => list("client"),
      Create: (data, req) => postSyncWithData(req, "client", data),
      Remove: (id) => deleteSyncWithParam("client", id),
      Update: (id, data) => putSyncWithData(`client/${id}`, data),
    },

    BranchOffice: {
      Get: (id) => retrieve("branchOffice", id),
      List: () => list("branchOffice"),
      Create: (data, req) => postSyncWithData(req, "branchOffice", data),
      Remove: (id) => deleteSyncWithParam("branchOffice", id),
      Update: (id, data) => putSyncWithData(`branchOffice/${id}`, data),
    },
  };
};

module.exports = facturama();
