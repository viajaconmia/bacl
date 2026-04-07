const axios = require("axios");

async function getLatLngFromCP(cp) {
  try {
    if (!cp) return null;

    const url = `https://nominatim.openstreetmap.org/search`;

    const { data } = await axios.get(url, {
      params: {
        postalcode: cp,
        country: "Mexico",
        format: "json",
        limit: 1,
      },
      headers: {
        "User-Agent": "mi-app-node", // obligatorio para OSM
      },
    });

    if (!data || data.length === 0) return null;

    return {
      lat: Number(data[0].lat),
      lng: Number(data[0].lon),
    };
  } catch (error) {
    console.error("Error obteniendo coordenadas:", error.message);
    return null;
  }
}

module.exports = { getLatLngFromCP };
