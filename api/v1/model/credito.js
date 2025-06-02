const { executeQuery } = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");

const createAgenteCredito = async (datosCredito) => {
    try {
        const id_datos_fiscales = `df-${uuidv4()}`;
        const query = `
        UPDATE agentes
        SET tiene_credito_consolidado = 1,
            monto_credito = 50000
        WHERE id_agente = 'ce57342e-03e9-440f-b12f-16497f23b8bb';`;

        const params = [
            datosCredito.monto_credito
        ];

        const response = await executeQuery(query, params);
        return response;
    } catch (error) {
        throw error;
    }
};

const readAgenteCredito = async () => {
    try {
        const query = "SELECT tiene_credito_consolidado, monto_credito FROM agentes WHERE id_agente = ?";
        const params = [id_agente];
        const response = await executeQuery(query, params);
        console.log(response);
        return response;
    } catch (error) {
        throw error;
    }
};

module.exports = {
    createAgenteCredito,
    readAgenteCredito
};