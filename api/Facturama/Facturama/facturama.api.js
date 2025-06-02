const axios = require('axios');
// const { valuesFacturama } = require("../../../config/auth")

let valuesFacturama = {
  token: "cHJ1ZWJhbm9rdG9zOnBydWViYXNub2t0b3M=",
  useragent: "pruebanoktos",
  url: "https://apisandbox.facturama.mx/",
};

let headers = {
  headers: {
    'User-Agent': valuesFacturama.useragent,
    'Authorization': `Basic ${valuesFacturama.token}`,
  }
}

const facturama = () => {

  const settings = {
    url: valuesFacturama.url,
  };

  // Función para hacer una solicitud GET
  const retrieve = async (path, id) => {
    try {
      const response = await axios.get(`${settings.url}${path}/${id}`, headers);
      return response.data;
    } catch (error) {
      // console.error(`Error retrieving data from ${path}:`, error);
      throw error;
    }
  };

  // Función para hacer una solicitud GET con parámetros
  const list = async (path) => {
    try {
      const response = await axios.get(`${settings.url}${path}`, headers);
      return response.data;
    } catch (error) {
      // console.error(`Error listing data from ${path}:`, error);
      throw error;
    }
  };
  const listWithParam = async (path, param) => {
    try {
      const response = await axios.get(`${settings.url}${path}?${param}`, headers);
      return response.data;
    } catch (error) {
      // console.error(`Error listing data from ${path}:`, error);
      throw error;
    }
  };

  // Función para hacer una solicitud POST con datos
  const postSyncWithData = async (path, data) => {
    try {
      const response = await axios.post(`${settings.url}${path}`, data, {
        headers: {
          ...headers.headers,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      // console.error(`Error posting data to ${path}:`, error);
      throw error;
    }
  };
  const postSyncWithParams = async (path, params, data = {}) => {
    try {
      const response = await axios.post(`${settings.url}${path}?${params}`, data, {
        headers: {
          ...headers.headers,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      // console.error(`Error posting data to ${path}:`, error);
      throw error;
    }
  };

  // Función para hacer una solicitud PUT con datos
  const putSyncWithData = async (path, data) => {
    try {
      const response = await axios.put(`${settings.url}${path}`, data, {
        headers: {
          ...headers.headers,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      // console.error(`Error putting data to ${path}:`, error);
      throw error;
    }
  };

  // Función para hacer una solicitud DELETE
  const deleteSyncWithParam = async (path, param) => {
    try {
      const response = await axios.delete(`${settings.url}${path}/${param}`, headers);
      return response.data;
    } catch (error) {
      // console.error(`Error deleting data from ${path}:`, error);
      throw error;
    }
  };

  // Exportando las funciones del objeto Facturama
  return {
    Clients: {
      Get: (id) => retrieve('client', id),
      List: () => list('client'),
      Create: (data) => postSyncWithData('client', data),
      Remove: (id) => deleteSyncWithParam('client', id),
      Update: (id, data) => putSyncWithData(`client/${id}`, data),
    },
    Products: {
      Get: (id) => retrieve('product', id),
      List: () => list('product'),
      Create: (data) => postSyncWithData('product', data),
      Remove: (id) => deleteSyncWithParam('product', id),
      Update: (id, data) => putSyncWithData(`product/${id}`, data),
    },
    BranchOffice: {
      Get: (id) => retrieve('branchOffice', id),
      List: () => list('branchOffice'),
      Create: (data) => postSyncWithData('branchOffice', data),
      Remove: (id) => deleteSyncWithParam('branchOffice', id),
      Update: (id, data) => putSyncWithData(`branchOffice/${id}`, data),
    },
    Cfdi: {
      Get: (id) => retrieve('cfdi', id),
      Create3: (data) => postSyncWithData('3/cfdis', data),
      Send: (param) => postSyncWithParams('cfdi', param),
      Cancel: (params) => deleteSyncWithParam('cfdi', params),
      Download: (format, type, id) => retrieve(`cfdi/${format}/${type}`, id),
      List: (rfc) => listWithParam("cfdi", `type=issued&keyword=${rfc}`)
    },
  };
};

// Exportamos el objeto Facturama
module.exports = facturama();
