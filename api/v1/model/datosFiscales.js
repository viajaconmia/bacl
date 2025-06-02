const { executeQuery } = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");

const createDatosFiscales = async (datosFiscales) => {
  try {
    const id_datos_fiscales = `df-${uuidv4()}`;
    const query = `
      INSERT INTO datos_fiscales 
      (id_datos_fiscales, id_empresa, rfc, calle, estado, colonia, municipio, codigo_postal_fiscal, regimen_fiscal, razon_social) 
      VALUES (?,?,?,?,?,?,?,?,?,?)`;

    const params = [
      id_datos_fiscales,
      datosFiscales.id_empresa,
      datosFiscales.rfc,
      datosFiscales.calle,
      datosFiscales.estado,
      datosFiscales.colonia,
      datosFiscales.municipio,
      datosFiscales.codigo_postal_fiscal,
      datosFiscales.regimen_fiscal,
      datosFiscales.razon_social,
    ];

    const response = await executeQuery(query, params);
    return response;
  } catch (error) {
    throw error;
  }
};
const updateDatosFiscales = async (datosFiscales) => {
  try {
    const query = `
UPDATE datos_fiscales
SET
  rfc = ?, 
  calle = ?, 
  estado = ?, 
  colonia = ?, 
  municipio = ?, 
  codigo_postal_fiscal = ?, 
  regimen_fiscal = ?,
  razon_social = ?
WHERE id_empresa = ?;`;

    const params = [
      datosFiscales.rfc,
      datosFiscales.calle,
      datosFiscales.estado,
      datosFiscales.colonia,
      datosFiscales.municipio,
      datosFiscales.codigo_postal_fiscal,
      datosFiscales.regimen_fiscal,
      datosFiscales.razon_social,
      datosFiscales.id_empresa,
    ];

    const response = await executeQuery(query, params);
    return response;
  } catch (error) {
    throw error;
  }
};

const readDatosFiscales = async () => {
  try {
    const query = "SELECT * FROM datos_fiscales";
    const response = await executeQuery(query);
    return response;
  } catch (error) {
    throw error;
  }
};
const readDatosFiscalesById = async (id) => {
  try {
    const query =
      "select * from vw_datos_fiscales_detalle where id_datos_fiscales = ?";
    const response = await executeQuery(query, [id]);
    return response;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createDatosFiscales,
  readDatosFiscales,
  readDatosFiscalesById,
  updateDatosFiscales,
};
