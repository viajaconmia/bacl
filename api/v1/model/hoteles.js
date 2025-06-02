const { executeQuery, executeTransaction } = require("../../../config/db");

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
    h.iva,
    h.ish,
    h.otros_impuestos,
    h.otros_impuestos_porcentaje,
    tc.id_tipo_cuarto,
    tc.nombre AS nombre_tipo_cuarto,
    t.id_tarifa,
    t.costo,
    t.precio,
    t.id_agente
  FROM tarifas t
    JOIN tipos_cuartos tc ON t.id_tipos_cuartos = tc.id_tipo_cuarto
    JOIN hoteles h ON t.id_hotel = h.id_hotel order by nombre_hotel, id_tipo_cuarto; `;

    const datos = await executeQuery(query);

    const agrupado = [];

    datos.forEach((item) => {
      let hotel = agrupado.find((h) => h.id_hotel === item.id_hotel);

      const tipoCuarto = {
        id_tipo_cuarto: item.id_tipo_cuarto,
        nombre_tipo_cuarto: item.nombre_tipo_cuarto,
        id_tarifa: item.id_tarifa,
        precio: item.precio,
        costo: item.costo,
        id_agente: item.id_agente,
      };

      if (!hotel) {
        agrupado.push({
          id_hotel: item.id_hotel,
          nombre_hotel: item.nombre_hotel,
          Estado: item.Estado,
          Ciudad_Zona: item.Ciudad_Zona,
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

    console.log(agrupado);

    console.log(agrupado);
    return agrupado;
  } catch (error) {
    throw error;
  }
};

const getHotelesWithTarifas = async () => {
  try {
    const query = "SELECT * FROM vw_hoteles_tarifas_pivot";
    const response = await executeQuery(query);
    return response;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getHotelesWithCuartos,
  getHotelesWithTarifas,
};
