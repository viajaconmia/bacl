const validates = require("../lib/utils/validates");
const { calcularPrecios } = require("../lib/utils/calculates");
const { Formato } = require("../lib/utils/formats");

const create = async (connection, servicio) => {
  const propiedades = Object.entries(servicio).map(([key, value]) => ({
    key,
    value,
  }));

  if (servicio.total == undefined)
    throw new Error("El precio no puede ir vacio al crear el servicio");

  validates.excludeColumns(table, columnas, servicio);

  servicio = {
    ...servicio,
    id_servicio: Formato.uuid(servicio.id_servicio, "ser-"),
  };

  validates.hasAllRequiredColumn(table, required, servicio);

  if (servicio.total !== undefined && servicio.total !== null)
    servicio = {
      ...servicio,
      ...calcularPrecios(Formato.precio(servicio.total)),
    };

  const query = `INSERT INTO servicios (${propiedades
    .map((p) => p.key)
    .join(",")}) VALUES (${propiedades.map((_) => "?").join(",")});`;

  await connection.execute(
    query,
    propiedades.map((p) => p.value)
  );

  return servicio;
};

const update = async (connection, servicio) => {
  const props = Object.entries(servicio)
    .filter(([key]) => key != "id_servicio")
    .map(([key, value]) => ({ key, value }));

  validates.excludeColumns(table, columnas, servicio);
  if (!servicio.id_servicio)
    throw new Error("No hay id_servicio para hacer el update");
  if (props.length == 0) throw new Error("Faltan propiedades para editar");

  servicio = Formato.if(servicio.total !== undefined);
  servicio = {
    ...servicio,
    ...calcularPrecios(Formato.precio(servicio.total)),
  };

  const query = `UPDATE servicios SET ${props
    .map((p) => p.key)
    .join(" = ?,")} = ? WHERE id_servicio = ?`;

  return await connection.execute(query, [
    ...props.map((p) => p.value),
    servicio.id_servicio,
  ]);
};

module.exports = { update, create };

/* OBJETOS PARA MANEJAR LOS FORMATOS Y VALIDACIONES DE LA TABLA */

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
