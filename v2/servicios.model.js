const { calcularPrecios } = require("../lib/utils/calculates");
const { Formato } = require("../lib/utils/formats");
const {
  excludeColumns,
  hasAllRequiredColumn,
} = require("../lib/utils/validates");

const table = "servicios";

const columnas = [
  "id_servicio",
  "total",
  "otros_impuestos",
  "is_credito",
  "fecha_limite_pago",
  "id_agente",
  "id_empresa",
];

const required = ["id_servicio", "total"];

const create = async (connection, servicio) => {
  hasAllRequiredColumn(table, required, servicio);
  excludeColumns(table, columnas, servicio);

  const precio = calcularPrecios(Formato.precio(servicio.total));

  const query = `
  INSERT INTO servicios (
    id_servicio,
    total,
    subtotal,
    impuestos,
    otros_impuestos,
    is_credito,
    fecha_limite_pago,
    id_agente,
    id_empresa
  )
  VALUES (?,?,?,?,?,?,?,?,?);`;

  const params = [
    servicio.id_servicio,
    precio.total,
    precio.subtotal,
    precio.impuestos,
    servicio.otros_impuestos || null,
    servicio.is_credito || null,
    servicio.fecha_limite_pago || null,
    servicio.id_agente || null,
    servicio.id_empresa || null,
  ];

  return await connection.execute(query, params);
};

const update = async (connection, servicio) => {
  excludeColumns(table, columnas, servicio);
  if (servicio.total) {
    const precio = calcularPrecios(Formato.precio(servicio.total));
    console.log(precio);
    servicio = {
      ...servicio,
      ...precio,
    };
  }

  console.log(servicio);

  const query = `
  UPDATE servicios
    SET
      total = ?,
      subtotal = ?,
      impuestos = ?,
      otros_impuestos = ?,
      is_credito = ?,
      fecha_limite_pago = ?,
      id_agente = ?,
      id_empresa = ?
    WHERE id_servicio = ?;`;
  throw new Error("por si acaso");

  return await connection.execute(query, params);
};

module.exports = { update, create };
