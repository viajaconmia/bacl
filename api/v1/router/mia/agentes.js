const middleware = require("../../middleware/validateParams");
const controller = require("../../controller/agentes");
const { executeQuery } = require("../../../../config/db");
const router = require("express").Router();

router.post("/", middleware.validateParams([]), controller.create);
router.get(
  "/viajeros-con-empresas",
  middleware.validateParams([]),
  controller.read
);
router.get(
  "/empresas-con-agentes",
  middleware.validateParams([]),
  controller.readAgentesCompanies
);
router.get(
  "/empresas-con-datos-fiscales",
  middleware.validateParams([]),
  controller.readEmpresasDatosFiscales
);
router.get("/agentes", middleware.validateParams([]), controller.readAgentes);
router.get("/get-agente-id/", controller.getAgenteId);

router.get("/empresas", async (req, res) => {
  try {
    const queryget = `
select * from empresas as e
INNER JOIN empresas_agentes as e_a ON e_a.id_empresa = e. id_empresa
WHERE e_a.id_agente = ?;`;
    const response = await executeQuery(queryget, [req.query.id]);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error server", details: error });
  }
});
router.get("/all", async (req, res) => {
  try {
    const { query } = req;
    const { filterType = "Creacion" } = query;
    let conditions = [];
    let values = [];
    let type_filters = {
      "Check-in": "created_at",
      "Check-out": "created_at",
      Transaccion: "created_at",
      Creacion: "created_at",
    };

    if (query.startDate && query.endDate) {
      conditions.push(`${type_filters[filterType]} BETWEEN ? AND ?`);
      values.push(query.startDate, query.endDate);
    } else if (query.startDate) {
      conditions.push(`${type_filters[filterType]} >= ?`);
      values.push(query.startDate);
    } else if (query.endDate) {
      conditions.push(`${type_filters[filterType]} <= ?`);
      values.push(query.endDate);
    }

    if (query.startCantidad && query.endCantidad) {
      conditions.push(`a.saldo BETWEEN ? AND ?`);
      values.push(query.startCantidad, query.endCantidad);
    } else if (query.startCantidad) {
      conditions.push(`a.saldo >= ?`);
      values.push(query.startCantidad);
    } else if (query.endCantidad) {
      conditions.push(`a.saldo <= ?`);
      values.push(query.endCantidad);
    }

    if (query.vendedor) {
      conditions.push(`vendedor LIKE ?`);
      values.push(`%${query.vendedor.split(" ").join("%")}%`);
    }
    if (query.notas) {
      conditions.push(`notas LIKE ?`);
      values.push(`%${query.notas.split(" ").join("%")}%`);
    }
    if (query.estado_credito) {
      conditions.push(`tiene_credito_consolidado = ?`);
      values.push(query.estado_credito == "Activo" ? 1 : 0);
    }
    if (query.telefono) {
      conditions.push(`telefono LIKE ?`);
      values.push(`%${query.telefono.toString().split(" ").join("%")}%`);
    }
    if (query.correo) {
      conditions.push(`correo LIKE ?`);
      values.push(`%${query.correo.toString().split(" ").join("%")}%`);
    }
    if (query.client) {
      conditions.push(`nombre_agente_completo LIKE ? OR id_agente LIKE ?`);
      values.push(`%${query.client.split(" ").join("%")}%`);
      values.push(`%${query.client.split("").join("%")}%`);
    }

    const queryget = `
SELECT * FROM agente_details
${conditions.length ? " WHERE " + conditions.join(" AND ") : ""}
ORDER BY created_at desc`;
    const response = await executeQuery(queryget, values);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error server", details: error });
  }
});

//extrae saldos por cada agente
router.get("/all-with-active-facturable-saldos", async (req, res) => {
  try {
    const { query } = req;
    const { filterType = "Creacion" } = query;
    let conditions = [];
    let values = [];
    let type_filters = {
      "Check-in": "a.created_at",
      "Check-out": "a.created_at",
      Transaccion: "a.created_at",
      Creacion: "a.created_at",
    };

    // Aplicar todos los filtros (igual que en el endpoint /all)
    if (query.startDate && query.endDate) {
      conditions.push(`${type_filters[filterType]} BETWEEN ? AND ?`);
      values.push(query.startDate, query.endDate);
    } else if (query.startDate) {
      conditions.push(`${type_filters[filterType]} >= ?`);
      values.push(query.startDate);
    } else if (query.endDate) {
      conditions.push(`${type_filters[filterType]} <= ?`);
      values.push(query.endDate);
    }

    if (query.startCantidad && query.endCantidad) {
      conditions.push(`a.saldo BETWEEN ? AND ?`);
      values.push(query.startCantidad, query.endCantidad);
    } else if (query.startCantidad) {
      conditions.push(`a.saldo >= ?`);
      values.push(query.startCantidad);
    } else if (query.endCantidad) {
      conditions.push(`a.saldo <= ?`);
      values.push(query.endCantidad);
    }

    if (query.vendedor) {
      conditions.push(`a.vendedor LIKE ?`);
      values.push(`%${query.vendedor.split(" ").join("%")}%`);
    }
    if (query.notas) {
      conditions.push(`a.notas LIKE ?`);
      values.push(`%${query.notas.split(" ").join("%")}%`);
    }
    if (query.estado_credito) {
      conditions.push(`a.tiene_credito_consolidado = ?`);
      values.push(query.estado_credito == "Activo" ? 1 : 0);
    }
    if (query.telefono) {
      conditions.push(`a.telefono LIKE ?`);
      values.push(`%${query.telefono.toString().split(" ").join("%")}%`);
    }
    if (query.correo) {
      conditions.push(`a.correo LIKE ?`);
      values.push(`%${query.correo.toString().split(" ").join("%")}%`);
    }
    if (query.client) {
      conditions.push(`(a.nombre_agente_completo LIKE ? OR a.id_agente LIKE ?)`);
      values.push(`%${query.client.split(" ").join("%")}%`);
      values.push(`%${query.client.split("").join("%")}%`);
    }

    // Configurar el typeCast para manejar correctamente el JSON
    const config = {
      sql: `
        SELECT 
          a.*,
          (
            SELECT JSON_ARRAYAGG(
              JSON_OBJECT(
                'id_saldos', sf.id_saldos,
                'fecha_creacion', sf.fecha_creacion,
                'saldo', sf.saldo,
                'monto', sf.monto,
                'metodo_pago', sf.metodo_pago,
                'fecha_pago', sf.fecha_pago,
                'concepto', sf.concepto,
                'referencia', sf.referencia,
                'currency', sf.currency,
                'tipo_tarjeta', sf.tipo_tarjeta,
                'ult_digits', sf.ult_digits,
                'comentario', sf.comentario,
                'link_stripe', sf.link_stripe,
                'is_facturable', sf.is_facturable,
                'is_descuento', sf.is_descuento,
                'comprobante', sf.comprobante,
                'activo', sf.activo,
                'numero_autorizacion', sf.numero_autorizacion,
                'banco_tarjeta', sf.banco_tarjeta,
                'is_facturado', sf.is_facturado
              )
            )
            FROM saldos_a_favor sf
            WHERE sf.id_agente = a.id_agente 
              AND sf.activo = 1 
              AND sf.is_facturable = 1
          ) AS saldos_facturables
        FROM agente_details a
        ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""}
        ORDER BY a.created_at DESC
      `,
      values: values,
      typeCast: function(field, next) {
        if (field.type === 'JSON') {
          return field.string(); // Devuelve el JSON como string
        }
        return next();
      }
    };

    console.log("Ejecutando query:", config.sql);
    console.log("Con valores:", config.values);

    const agentes = await executeQuery(config);
    
    // Procesar los resultados
    const agentesConSaldos = agentes.map(agente => {
      try {
        let saldos = [];
        
        // Verificar si saldos_facturables es un string (necesita parseo) o ya es un objeto
        if (agente.saldos_facturables) {
          if (typeof agente.saldos_facturables === 'string') {
            saldos = JSON.parse(agente.saldos_facturables);
          } else if (Array.isArray(agente.saldos_facturables)) {
            saldos = agente.saldos_facturables;
          }
          
          // Asegurar que los booleanos sean correctos
          saldos = saldos.map(saldo => ({
            ...saldo,
            is_facturable: Boolean(saldo.is_facturable),
            is_descuento: Boolean(saldo.is_descuento),
            activo: Boolean(saldo.activo)
          }));
        }
        
        return {
          ...agente,
          tiene_credito_consolidado: Boolean(agente.tiene_credito_consolidado),
          saldos_facturables: saldos
        };
      } catch (error) {
        console.error("Error procesando agente", agente.id_agente, error);
        return {
          ...agente,
          tiene_credito_consolidado: Boolean(agente.tiene_credito_consolidado),
          saldos_facturables: []
        };
      }
    });

    res.status(200).json(agentesConSaldos);
  } catch (error) {
    console.error("Error en /all-with-active-facturable-saldos:", error);
    res.status(500).json({ 
      message: "Error en el servidor", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

//Extrae los datos del agente por id
router.get("/id", async (req, res) => {
  try {
    const query = `select vw_details_agente.*, 
agentes.tiene_credito_consolidado, 
agentes.saldo ,
ad.wallet
from agentes 
JOIN vw_details_agente ON vw_details_agente.id_agente = agentes.id_agente 
join agente_details ad on ad.id_agente = agentes.id_agente
WHERE vw_details_agente.id_agente = ?;`;
    
    const response = await executeQuery(query, [req.query.id]);
    res.status(200).json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error server", details: error });
  }
});
/**
 * Endpoint para actualizar datos de empresas, viajeros y agentes.
 * Método: PUT
 * Ruta: /api/actualizar-datos (o la que prefieras)
 * Body esperado: {
 * "empresas": { "id_empresa_valor": { "campo1": valor1, ... } },
 * "viajero": { "id_viajero_valor": { "campo1": valor1, ... } },
 * "agente": { "id_agente_valor": { "campo1": valor1, ... } }
 * }
 */
router.put("/", async (req, res) => {
  const dataToUpdate = req.body;
  console.log(req.body);
  const results = {
    empresas: {},
    viajero: {},
    agente: {},
  };
  let operationsSuccessful = true; // Para rastrear si todas las operaciones fueron exitosas

  try {
    // Mapeo de claves del JSON a nombres de tabla y claves primarias
    const tableMapping = {
      empresas: { tableName: "empresas", idColumn: "id_empresa" },
      viajero: { tableName: "viajeros", idColumn: "id_viajero" },
      agente: { tableName: "agentes", idColumn: "id_agente" },
    };

    // Columnas permitidas para cada tabla (basado en tu JSON de ejemplo y la lista de columnas)
    // ¡Asegúrate de que estas listas sean correctas y completas según tus necesidades!
    const allowedColumns = {
      empresas: ["tiene_credito", "monto_credito"],
      viajeros: [
        "numero_pasaporte",
        "nacionalidad",
        "telefono",
        "fecha_nacimiento",
        "numero_empleado",
      ],
      agentes: ["tiene_credito_consolidado", "saldo", "vendedor", "notas"],
    };

    for (const sectionKey in dataToUpdate) {
      // "empresas", "viajero", "agente"
      if (
        tableMapping[sectionKey] &&
        dataToUpdate[sectionKey] &&
        Object.keys(dataToUpdate[sectionKey]).length > 0
      ) {
        const { tableName, idColumn } = tableMapping[sectionKey];
        const sectionData = dataToUpdate[sectionKey];

        for (const idValue in sectionData) {
          // "emp-...", "via-...", "..."
          const recordUpdates = sectionData[idValue];
          const fieldsToUpdate = [];
          const valuesToUpdate = [];

          // Construir la parte SET de la consulta dinámicamente
          for (const field in recordUpdates) {
            // Validar que el campo esté permitido para la tabla actual
            if (
              allowedColumns[tableName] &&
              allowedColumns[tableName].includes(field)
            ) {
              fieldsToUpdate.push(`${field} = ?`);
              valuesToUpdate.push(recordUpdates[field]);
            } else {
              console.warn(
                `Campo '${field}' no permitido o no definido para la tabla '${tableName}' y será ignorado para el ID '${idValue}'.`
              );
            }
          }

          // Considera añadir 'updated_at = NOW()' o tu equivalente si no es manejado por la BD
          // if (fieldsToUpdate.length > 0) {
          //    fieldsToUpdate.push(`updated_at = CURRENT_TIMESTAMP`); // Ajusta CURRENT_TIMESTAMP según tu BD
          // }

          if (fieldsToUpdate.length > 0) {
            const sqlQuery = `UPDATE ${tableName} SET ${fieldsToUpdate.join(
              ", "
            )} WHERE ${idColumn} = ?`;
            const queryParams = [...valuesToUpdate, idValue];

            console.log(
              `Ejecutando Query: ${sqlQuery} con Params: ${JSON.stringify(
                queryParams
              )}`
            );

            // Usamos tu función executeQuery
            const updateResult = await executeQuery(sqlQuery, queryParams);

            // La estructura de 'updateResult' dependerá de lo que devuelva tu 'executeQuery'
            // Asumimos que puede devolver algo como { affectedRows: X, changedRows: Y } o similar
            // Si 'executeQuery' no devuelve esto, ajusta la asignación de 'results'
            results[sectionKey][idValue] = {
              status:
                updateResult && updateResult.affectedRows > 0
                  ? "actualizado"
                  : "sin cambios o no encontrado",
              details: updateResult, // Guarda lo que devuelva executeQuery
            };
            if (!(updateResult && updateResult.affectedRows > 0)) {
              console.warn(
                `Ninguna fila afectada para ${tableName} con ${idColumn} = ${idValue}. El registro podría no existir o los valores eran los mismos.`
              );
            }
          } else {
            console.log(
              `No hay campos válidos para actualizar en la tabla '${tableName}' para el ID '${idValue}'.`
            );
            results[sectionKey][idValue] = {
              status: "ignorado",
              message: "No hay campos válidos para actualizar.",
            };
          }
        }
      }
    }

    res.status(200).json({
      message: "Proceso de actualización completado 👍",
      summary: results,
    });
  } catch (error) {
    console.error("Error en el endpoint /actualizar-datos:", error); // Usar console.error para errores
    res.status(500).json({
      message: "Error en el servidor al actualizar datos 😔",
      details: error.message,
    });
  }
});

router.get(
  "/agentes-with-viajeros-details",
  controller.get_agente_with_viajeros_details
);

module.exports = router;
