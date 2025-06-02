



const createTicket = async (body) => {
    console.log("Datos del ticket recibidos:", body);
    
    const accessToken = await refreshZohoAccessToken();
    if (!accessToken) {
        throw new Error("No se pudo obtener el token de acceso.");
    }

    const url = "https://desk.zoho.com/api/v1/tickets";
    
    const ticketData = {
        "subject": "PRUEBA TICKETS MIA",
        "departmentId": "603403000018558029",
        "contactId": "603403000000819002",
        "description": "hola",
        "priority": "High",
        "status": "Open",
        "layoutId": "603403000018566830",
        "customFields": {
            "NUMERO DE CLIENTE": "1",
            "HOTELES": "hotel1",
            "CHECK IN": "2024-03-03",
            "CHECK OUT": "2024-03-03",
            "DESTINO": "destino",
            "VIAJERO": "viajero",
            "Noches": "2",
            "PRESUPUESTO": "6 a 9 noktos",
            "Obsevaciones": "-",
            "EXTRAS": "-",
            "SENCILLAS": "1"
        }
    };

    const headers = {
        "Authorization": `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json"
    };

    const options = {
        method: "POST",
        headers: headers,
        body: JSON.stringify(ticketData)
    };

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error en la API de Zoho (Status: ${response.status}): ${errorText}`);
        }

        const responseData = await response.json();
        console.log("Ticket creado exitosamente:", responseData);
        return responseData;
    } catch (error) {
        console.error("Error al crear ticket:", error);
        throw error; // Propagar error para manejo externo
    }
};

const refreshZohoAccessToken = async () => {
    const clientId = "1000.VWW4O1DYCB6AA7IM2TT6IAFUW1MUAH";
    const clientSecret = "f002746e115557785792fd5312a00f8cc943059268";
    const refreshToken = "1000.f436e0e847cf4ce631c2fd356551c801.15eda19fe7e501c621abcd40bb1c3ab4";

    const url = "https://accounts.zoho.com/oauth/v2/token";
    const payload = {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
    };

    const options = {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(payload).toString()
    };

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error al refrescar el token (Status: ${response.status}): ${errorText}`);
        }

        const text = await response.text();
        if (!text) {
            throw new Error("Respuesta vacía al refrescar el token.");
        }

        const data = JSON.parse(text);
        console.log("Nuevo access token:", data.access_token);
        return data.access_token;
    } catch (error) {
        console.error("Error al refrescar el token:", error);
        throw error;
    }
};

module.exports = { createTicket, refreshZohoAccessToken };