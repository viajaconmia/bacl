const { executeQuery, executeTransaction } = require("../../../config/db");
const { getLatLngFromCP } = require("../../../lib/utils/geo");

const getHotelesWithCuartos = async () => {
  try {
    const query = `
  SELECT 
    h.id_hotel,
    h.nombre AS nombre_hotel,
    h.Estado,
    h.Ciudad_Zona,
    h.URLImagenHotel,
    h.URLImagenHotelQ,
    h.URLImagenHotelQQ,
    h.direccion,
    h.iva,
    h.ish,
    h.otros_impuestos,
    h.latitud,
    h.longitud,
    h.otros_impuestos_porcentaje,
    tc.id_tipo_cuarto,
    tc.nombre AS nombre_tipo_cuarto,
    t.tipo_desayuno,
    t.comentario_desayuno,
    t.precio_desayuno,
    t.id_tarifa,
    t.costo,
    t.precio,
    t.id_agente,
    t.incluye_desayuno
  FROM tarifas t
    JOIN tipos_cuartos tc ON t.id_tipos_cuartos = tc.id_tipo_cuarto
    JOIN hoteles h ON t.id_hotel = h.id_hotel order by nombre_hotel, id_tipo_cuarto; `;

    const datos = await executeQuery(query);

    const agrupado = [];

    datos.forEach((item) => {
      let hotel = agrupado.find((h) => h.id_hotel === item.id_hotel);

      const tipoCuarto = {
        id_tipo_cuarto: item.id_tipo_cuarto,
        tipo_desayuno: item.tipo_desayuno,
        comentario_desayuno: item.comentario_desayuno,
        precio_desayuno: item.precio_desayuno,
        nombre_tipo_cuarto: item.nombre_tipo_cuarto,
        id_tarifa: item.id_tarifa,
        precio: item.precio,
        costo: item.costo,
        id_agente: item.id_agente,
        incluye_desayuno: item.incluye_desayuno,
      };

      if (!hotel) {
        agrupado.push({
          id_hotel: item.id_hotel,
          nombre_hotel: item.nombre_hotel,
          Estado: item.Estado,
          direccion: item.direccion,
          Ciudad_Zona: item.Ciudad_Zona,
          geo: { latitud: item.latitud, longitud: item.longitud },
          impuestos: [
            { name: "iva", porcentaje: item.iva },
            { name: "ish", porcentaje: item.ish },
            { name: "otros_impuestos", monto: item.otros_impuestos },
            {
              name: "otros_impuestos_porcentaje",
              porcentaje: item.otros_impuestos_porcentaje,
            },
          ],
          imagenes: [
            item.URLImagenHotel,
            item.URLImagenHotelQ,
            item.URLImagenHotelQQ,
          ],
          tipos_cuartos: [tipoCuarto],
        });
      } else {
        hotel.tipos_cuartos.push(tipoCuarto);
      }
    });
    return agrupado;
  } catch (error) {
    throw error;
  }
};

const getHotelesWithTarifas = async () => {
  try {
    const query = "SELECT * FROM vw_hoteles_tarifas_pivot;";
    const response = await executeQuery(query);
    return response;
  } catch (error) {
    throw error;
  }
};

const getHotelesWithTarifasClient = async () => {
  try {
    const query = "select * from vw_hoteles_tarifas_completa where Activo = 1;";
    const response = await executeQuery(query);
    return response;
  } catch (error) {
    throw error;
  }
};

const insertarPrioridadHotel = async ({
  id_agente,
  id_hotel,
  zona,
  priority,
}) => {
  const hotelExiste = await executeQuery(
    `SELECT id_hotel FROM hoteles WHERE id_hotel = ? LIMIT 1`,
    [id_hotel],
  );

  if (!hotelExiste.length) {
    const err = new Error("Hotel no encontrado");
    err.code = "HOTEL_NOT_FOUND";
    throw err;
  }

  await executeQuery(
    `INSERT INTO client_hotel_priority (id_agente, id_hotel, zona, priority) VALUES (?, ?, ?, ?)`,
    [id_agente, id_hotel, zona, priority],
  );
};

const actualizarPrioridadHotel = async (id, campos) => {
  const permitidos = ["zona", "priority", "is_allowed"];
  const sets = [];
  const params = [];

  for (const campo of permitidos) {
    if (campos[campo] !== undefined) {
      sets.push(`${campo} = ?`);
      params.push(campos[campo]);
    }
  }

  if (!sets.length) {
    const err = new Error("Sin campos para actualizar");
    err.code = "NO_FIELDS";
    throw err;
  }

  params.push(id);
  const result = await executeQuery(
    `UPDATE client_hotel_priority SET ${sets.join(", ")} WHERE id = ?`,
    params,
  );

  if (result.affectedRows === 0) {
    const err = new Error("Registro no encontrado");
    err.code = "NOT_FOUND";
    throw err;
  }
};

const buscarHotelesConFiltros = async ({
  ciudad,
  hotel,
  cp,
  lat,
  lng,
  id_hotel,
}) => {
  if (id_hotel) {
    return await executeQuery(
      `SELECT
        vw.id_hotel as id,
        vw.nombre AS hotel,
        vw.precio_sencilla AS total,
        ROUND(vw.precio_sencilla / 1.16, 2) AS subtotal,
        IF(vw.desayuno_sencilla = 1, 1, 0) AS desayuno,
        vw.direccion,
        NULL AS distancia
      FROM vw_hoteles_tarifas_completa vw
      INNER JOIN hoteles h ON h.id_hotel = vw.id_hotel
      WHERE vw.id_hotel = ?
      LIMIT 1`,
      [id_hotel],
    );
  }

  const where = [];
  const whereParams = [];
  const orderParams = [];
  const distanceParams = [];

  let orderBy = "vw.precio_sencilla ASC";

  if (hotel) {
    where.push(`
      (
        vw.nombre LIKE CONCAT('%', ?, '%')
        OR chp.zona = (
          SELECT chp2.zona
          FROM client_hotel_priority chp2
          INNER JOIN hoteles h2 ON h2.id_hotel = chp2.id_hotel
          WHERE h2.nombre LIKE CONCAT('%', ?, '%')
          LIMIT 1
        )
      )
    `);
    whereParams.push(hotel, hotel);
    orderBy = `
      CASE WHEN vw.nombre LIKE CONCAT('%', ?, '%') THEN 0 ELSE 1 END,
      vw.precio_sencilla ASC
    `;
    orderParams.push(hotel);
  }

  let latFinal = lat;
  let lngFinal = lng;

  if (cp && (!lat || !lng)) {
    const coords = await getLatLngFromCP(cp);
    if (coords) {
      latFinal = coords.lat;
      lngFinal = coords.lng;
    }
  }

  let distanciaSelect = "NULL AS distancia";

  if (latFinal && lngFinal) {
    distanciaSelect = `
      ST_Distance_Sphere(h.ubicacion, ST_SRID(POINT(?, ?), 4326)) AS distancia
    `;
    distanceParams.push(Number(lngFinal), Number(latFinal));
    orderBy = `
      ST_Distance_Sphere(h.ubicacion, ST_SRID(POINT(${Number(lngFinal)}, ${Number(latFinal)}), 4326)) ASC
    `;
  }

  if (ciudad) {
    where.push(`chp.zona LIKE ?`);
    whereParams.push(`%${ciudad.toUpperCase().split(" ").join("%")}%`);
    if (!latFinal && !lngFinal && !hotel) {
      orderBy = `chp.priority ASC`;
    }
  }

  const whereSQL = where.length
    ? `WHERE chp.is_allowed = 1 AND (${where.join(" OR ")})`
    : "";

  const query = `
    SELECT
      vw.id_hotel as id,
      vw.nombre AS hotel,
      vw.precio_sencilla AS total,
      ROUND(vw.precio_sencilla / 1.16, 2) AS subtotal,
      IF(vw.desayuno_sencilla = 1, 1, 0) AS desayuno,
      vw.direccion,
      chp.zona,
      chp.priority,
      ${distanciaSelect}
    FROM vw_hoteles_tarifas_completa vw
    INNER JOIN client_hotel_priority chp ON chp.id_hotel = vw.id_hotel
    INNER JOIN hoteles h ON h.id_hotel = vw.id_hotel
    ${whereSQL}
    ORDER BY ${orderBy}
    LIMIT 20
  `;

  const finalParams = [
    ...distanceParams,
    ...whereParams,
    ...(latFinal && lngFinal ? [] : orderParams),
  ];

  return await executeQuery(query, finalParams);
};

module.exports = {
  getHotelesWithCuartos,
  getHotelesWithTarifas,
  getHotelesWithTarifasClient,
  insertarPrioridadHotel,
  actualizarPrioridadHotel,
  buscarHotelesConFiltros,
};
