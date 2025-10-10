const servicio = {
  id_servicio: "ser-00051f67-b62b-4ed6-9c31-8aaf4120a452",
  total: "1177.40",
  subtotal: "989.02",
  impuestos: "188.38",
  otros_impuestos: null,
  is_credito: 1,
  fecha_limite_pago: null,
  created_at: "2025-08-19T22:00:44.000Z",
  updated_at: "2025-08-19T22:00:44.000Z",
  id_agente: "5a4a5999-57ca-449d-bfac-115f0862c502",
  id_empresa: null,
};

const columnas = [
  "id_servicio",
  "total",
  "subtotal",
  "impuestos",
  "otros_impuestos",
  "is_credito",
  "fecha_limite_pago",
  "created_at",
  "updated_at",
  // "id_agente",
  "id_empresa",
];

const update = async (connection, servicioPrueba) => {
  excludeColumns(columnas, servicio);
  throw new Error("lanzando error por cualquier cosa");
};

module.exports = { update };
