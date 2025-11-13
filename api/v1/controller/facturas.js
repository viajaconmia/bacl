const {
  executeSP,
  runTransaction,
  executeSP2,
  executeQuery,
} = require("../../../config/db");
const model = require("../model/facturas");
const { v4: uuidv4 } = require("uuid");
const { get } = require("../router/mia/reservasClient");
const { ShortError } = require("../../../middleware/errorHandler");

const create = async (req, res) => {
  try {
    const response = await model.createFactura(req.body, req);
    res.status(201).json({
      message: "Factura creado correctamente",
      data: response,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: error.message || "Error create from v1/mia/factura - GET",
      details: error.response?.data || error.details.data || error,
    });
  }
};

const isFacturada = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await model.isFacturada(id);
    res.status(200).json({
      ok: true,
      message: "Consulta exitosa",
      data: { facturada: response },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      error: error.message || error,
      details: error || null,
    });
  }
};

const createCombinada = async (req, res) => {
  req.context.logStep(
    "createCombinada",
    "Inicio del proceso de creación de factura combinada"
  );
  try {
    const resp = await model.createFacturaCombinada(req, req.body);
    req.context.logStep("resultado del model.createFacturaCombinada");
    console.log(resp);
    return res.status(201).json(resp.data.data);
  } catch (error) {
    console.log("ERROR MANEJADO")
    console.log(error.response);
    res.status(500).json({
      error: "Error en el servidor",
      details: error.message || error,
      otherDetails: error.response?.data || null,
    });
  }
};
// const createEmi = async (req, res) => {
//   req.context.logStep(
//     "createCombinada",
//     "Inicio del proceso de creación de factura combinada"
//   );
//   try {
//     const resp = await model.crearFacturaEmi(req, req.body);
//     req.context.logStep("resultado del model.createFacturaCombinada");
//     console.log(resp);
//     return res.status(201).json(resp.data.data);
//   } catch (error) {
//     console.log("ESTE ES EL ERRORRRRRRRRRrrr", error);
//     res.status(400).json({
//       error: "Error en el servidor",
//       details: error.message || error,
//       otherDetails: error || error.response?.data || null,
//     });
//   }
// };

const readConsultas = async (req, res) => {
  try {
    const { user_id } = req.query;
    let solicitudes = await model.getFacturasConsultas(user_id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const readAllConsultas = async (req, res) => {
  try {
    let solicitudes = await model.getAllFacturasConsultas();
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const getfacturasPagoPendiente = async (req, res) => {
  try {
    let solicitudes = await model.getAllFacturasPagosPendientes();
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const readDetailsFactura = async (req, res) => {
  try {
    const { id_factura } = req.query;
    let facturas = await model.getDetailsFactura(id_factura);
    res.status(200).json(facturas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const readAllFacturas = async (req, res) => {
  try {
    const facturas = await model.getAllFacturas();
    res.status(200).json(facturas);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error en el servidor", details: error });
  }
};
const deleteFacturas = async (req, res) => {
  try {
    let solicitudes = await model.deleteFacturas(req.params.id);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const crearFacturaDesdeCarga = async (req, res) => {
  req.context.logStep(
    "crearFacturaDesdeCarga",
    "Iniciando creación de factura desde carga"
  );
  const {
    fecha_emision,
    estado,
    usuario_creador,
    id_agente,
    total,
    subtotal,
    impuestos,
    saldo,
    rfc,
    id_empresa,
    uuid_factura,
    rfc_emisor,
    url_pdf,
    url_xml,
    items,
    fecha_vencimiento
  } = req.body;
  const id_factura = "fac-" + uuidv4();

  try {
    console.log("😒😒😒😒😒", req.body);
    const response = await executeSP("sp_inserta_factura_desde_carga", [
      id_factura,
      fecha_emision,
      estado,
      usuario_creador,
      id_agente,
      total,
      subtotal,
      impuestos,
      saldo,
      rfc,
      id_empresa,
      uuid_factura,
      rfc_emisor,
      url_pdf,
      url_xml,
      items,
      fecha_vencimiento
    ]);

    if (!response) {
      req.context.logStep(
        "crearFacturaDesdeCarga:",
        "Error al crear factura desde carga"
      );
      throw new Error("No se pudo crear la factura desde carga");
    } else {
      console.log(id_factura, response, items);
      res.status(201).json({
        message: "Factura creada correctamente desde carga",
        data: { id_factura, ...response },
      });
    }
  } catch (error) {
    req.context.logStep("Error en crearFacturaDesdeCarga:", error);
    res.status(500).json({
      error: "Error al crear factura desde carga",
      details: error.message || error,
      otherDetails: error.response?.data || null,
    });
  }
};

const asignarFacturaItems = async (req, res) => {
  const { id_factura, items } = req.body;
  console.log("body", req.body);

  // Asegura que items sea un array
  let itemsArray = items;
  if (typeof items === "string") {
    try {
      itemsArray = JSON.parse(items);
    } catch (e) {
      return res.status(400).json({
        error: "El campo 'items' no es un JSON válido",
        details: e.message,
      });
    }
  }

  try {
    const updateitems = `UPDATE items
    SET id_factura  = ?,
        is_facturado = 1
    WHERE id_item = ?;`;
    const updateFactura = `  UPDATE facturas
  SET saldo =  ?
  WHERE id_factura = ?;`;

    const saldo_factura = await executeQuery(
      `select saldo from facturas where id_factura = ?;`,
      [id_factura]
    );
    let suma_total_items = 0;
    for (const item of itemsArray) {
      // Asegura que item.total sea un número válido
      const totalItem = Number(item.total) || 0;
      suma_total_items += totalItem;
      await executeQuery(updateitems, [id_factura, item.id_item]);
    }
    const nuevo_saldo = saldo_factura[0].saldo - suma_total_items;
    if (nuevo_saldo < 0) {
      throw new ShortError("El saldo de la factura no puede ser negativo", 400);
    } else {
      await executeQuery(updateFactura, [nuevo_saldo, id_factura]);
    }

    return res.status(200).json({
      message: "Items asignados correctamente a la factura",
      data: "Factura asociada: " + id_factura,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error al asignar items a la factura",
      details: error.message || error,
      otherDetails: error.response?.data || null,
    });
  }
};

// const asignarFacturaPagos = async (req, res) => {
//   try {
//     const { id_factura: facturasRaw, ejemplo_saldos: saldosRaw } =
//       req.body || {};
//     if (
//       !facturasRaw ||
//       (Array.isArray(facturasRaw) && facturasRaw.length === 0)
//     ) {
//       return res.status(400).json({
//         error: "Debes enviar 'id_factura' con 1+ elementos (array o string).",
//       });
//     }

//     // --- Normalizar arrays ---
//     const facturasOrden = Array.isArray(facturasRaw)
//       ? facturasRaw
//       : [facturasRaw];

//     let items = saldosRaw;
//     if (!items) {
//       return res
//         .status(400)
//         .json({ error: "Falta 'ejemplo_saldos' en el payload." });
//     }
//     if (typeof items === "string") {
//       try {
//         items = JSON.parse(items);
//       } catch (e) {
//         return res.status(400).json({
//           error: "El campo 'ejemplo_saldos' no es un JSON válido",
//           details: e.message,
//         });
//       }
//     }
//     if (!Array.isArray(items)) items = [items];

//     // --- Traer saldos actuales de las facturas, conservando ORDEN ---
//     const facturas = [];
//     for (const idf of facturasOrden) {
//       const r = await executeQuery(
//         "SELECT id_factura, saldo FROM facturas WHERE id_factura = ?;",
//         [idf]
//       );
//       if (!r?.length) {
//         return res.status(404).json({ error: `Factura no encontrada: ${idf}` });
//       }
//       facturas.push({
//         id_factura: r[0].id_factura,
//         saldo: Number(r[0].saldo) || 0,
//       });
//     }

//     // --- Consultar en bloque la vista para obtener saldo disponible por raw_id ---
//     const rawIds = [...new Set(items.map((it) => String(it.id_saldo)))];
//     const placeholders = rawIds.length>1 ? rawIds.map(() => "?").join(","):rawIds[0];
//     const viewRows = rawIds.length
//       ? await executeQuery(
//           `SELECT raw_id, saldo FROM vw_pagos_prepago_facturables WHERE raw_id IN (${placeholders});`,
//           rawIds
//         )
//       : [];
//     console.log(rawIds,"pagoeeefeeee222eees")
//     console.log(placeholders,"pagoeeeees")
//     const disponiblePorRawId = new Map();
//     for (const row of viewRows || []) {
//       const rid = String(row.raw_id);
//       const disp = Number(row.saldo);
//       if (Number.isFinite(disp)) disponiblePorRawId.set(rid, Math.max(0, disp));
//     }

//     // --- Construir "pagos" a aplicar, usando SIEMPRE el saldo de la vista como tope ---
//     // Si un id_saldo no aparece en la vista => disponible = 0 (se ignora)
//     const creditos = items
//       .map((it) => {
//         const raw = String(it.id_saldo);
//         const disponible = disponiblePorRawId.has(raw)
//         ? Number(disponiblePorRawId.get(raw))
//         : 0;
//         console.log(disponible,"pagos")
//         const isSaldoFavor = /^\d+$/.test(raw); // num puro => saldo a favor
//         return { raw_id: raw, disponible, restante: disponible, isSaldoFavor };
//       })
//       .filter((c) => c.disponible > 0);
//     console.log(creditos)
//     if (creditos.length === 0) {
//       return res.status(400).json({
//         error: "No hay saldo disponible para aplicar (según la vista).",
//         detalle: {
//           solicitados: items.map((i) => ({ id_saldo: i.id_saldo })),
//           encontrados_en_vista: viewRows.length,
//         },
//       });
//     }

//     // --- Aplicación secuencial: consumir factura[0] hasta 0, luego factura[1], etc. ---
//     const appliedByFactura = new Map(); // id_factura -> suma aplicada
//     const appliedByCredito = new Map(); // raw_id     -> suma aplicada

//     let idxFactura = 0;

//     for (const cred of creditos) {
//       while (cred.restante > 0 && idxFactura < facturas.length) {
//         // Saltar facturas agotadas
//         while (
//           idxFactura < facturas.length &&
//           facturas[idxFactura].saldo <= 0
//         ) {
//           idxFactura++;
//         }
//         if (idxFactura >= facturas.length) break;

//         const f = facturas[idxFactura];
//         const aplicar = Math.min(f.saldo, cred.restante);

//         if (aplicar <= 0) {
//           idxFactura++;
//           continue;
//         }

//         // Insertar en tabla puente con columnas correctas
//         //   - isSaldoFavor => id_saldo_a_favor (= raw_id num), id_pago = NULL
//         //   - no saldo a favor => id_pago (= raw_id string), id_saldo_a_favor = NULL
//         const insertSQL = `
//           INSERT INTO facturas_pagos_y_saldos (id_pago, id_saldo_a_favor, id_factura, monto)
//           VALUES (?, ?, ?, ?);
//         `;
//         const id_pago = cred.isSaldoFavor ? null : cred.raw_id;
//         const id_saldo_a_favor = cred.isSaldoFavor ? cred.raw_id : null;

//         await executeQuery(insertSQL, [
//           id_pago,
//           id_saldo_a_favor,
//           f.id_factura,
//           aplicar,
//         ]);

//         // Actualizar saldos en memoria
//         f.saldo -= aplicar;
//         cred.restante -= aplicar;

//         // Acumular totales para respuesta
//         appliedByFactura.set(
//           f.id_factura,
//           (appliedByFactura.get(f.id_factura) || 0) + aplicar
//         );
//         appliedByCredito.set(
//           cred.raw_id,
//           (appliedByCredito.get(cred.raw_id) || 0) + aplicar
//         );

//         if (f.saldo <= 0) idxFactura++;
//       }
//     }

//     // --- Persistir nuevos saldos de facturas ---
//     for (const f of facturas) {
//       await executeQuery(
//         "UPDATE facturas SET saldo = ? WHERE id_factura = ?;",
//         [f.saldo, f.id_factura]
//       );
//     }

//     // --- Preparar respuesta ---
//     const detalleFacturas = facturas.map((f) => ({
//       id_factura: f.id_factura,
//       aplicado: appliedByFactura.get(f.id_factura) || 0,
//       saldo_final: f.saldo,
//     }));

//     const detalleCreditos = creditos.map((c) => ({
//       raw_id: c.raw_id,
//       tipo: c.isSaldoFavor ? "saldo_a_favor" : "pago",
//       disponible: c.disponible,
//       aplicado: appliedByCredito.get(c.raw_id) || 0,
//       sin_aplicar: Math.max(
//         0,
//         c.disponible - (appliedByCredito.get(c.raw_id) || 0)
//       ),
//     }));

//     const totalSinAplicar = detalleCreditos.reduce(
//       (s, p) => s + p.sin_aplicar,
//       0
//     );

//         //---------------------------------------------------------------------
// // Agregar pagos a saldos y ajustar saldos

//     // Opción 1: usando concatenación
    
//     const transaccion = `tra-${uuidv4()}`;
    
//     const consultas_facturas = `SELECT id_hospedaje FROM items WHERE id_factura in '${facturas.id_factura}'`;
//     const query_pagos = `
//               INSERT INTO pagos (
//                 id_pago, id_servicio, id_saldo_a_favor, id_agente,
//                 metodo_de_pago, fecha_pago, concepto, referencia,
//                 currency, tipo_de_tarjeta, link_pago, last_digits, total,saldo_aplicado,transaccion,monto_transaccion
//               ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);
//             `;
    

//     console.log(viewRows)
//     // Imprimir en consola
//     console.log(facturas,"envios");
//     console.log((consultas_facturas));


//     return res.status(200).json({
//       message:
//         "Pagos/Saldos aplicados secuencialmente a las facturas usando saldo de la vista.",
//       orden_facturas: facturasOrden,
//       facturas: detalleFacturas,
//       creditos: detalleCreditos,
//       total_sin_aplicar: totalSinAplicar,
//     });




//   } catch (error) {
//     console.error("Error en asignarFacturaPagos:", error);
//     return res.status(500).json({
//       error: "Error al asignar pagos a las facturas",
//       details: error?.message || String(error),
//     });
//   }

// };

// const asignarFacturaPagos = async (req, res) => {
//   // Helper para IDs si no usas uuidv4()
//   const newId = (pfx) =>
//     `${pfx}-${Date.now().toString(36)}-${Math.random()
//       .toString(36)
//       .slice(2, 10)}`;

//   try {
//     const {
//       id_factura: facturasRaw,
//       ejemplo_saldos: saldosRaw,
//       id_agente = null,
//       metodo_de_pago = "aplicacion_saldo",
//       currency = "MXN",
//       tipo_de_tarjeta = null,
//       link_pago = null,
//       last_digits = null,
//       referencia = null,
//       concepto = "Aplicación a facturas",
//     } = req.body || {};

//     if (!facturasRaw || (Array.isArray(facturasRaw) && facturasRaw.length === 0)) {
//       return res.status(400).json({
//         error: "Debes enviar 'id_factura' con 1+ elementos (array o string).",
//       });
//     }

//     // --- Normalizar arrays ---
//     const facturasOrden = Array.isArray(facturasRaw) ? facturasRaw : [facturasRaw];

//     let itemsEntrada = saldosRaw;
//     if (!itemsEntrada) {
//       return res.status(400).json({ error: "Falta 'ejemplo_saldos' en el payload." });
//     }
//     if (typeof itemsEntrada === "string") {
//       try {
//         itemsEntrada = JSON.parse(itemsEntrada);
//       } catch (e) {
//         return res.status(400).json({
//           error: "El campo 'ejemplo_saldos' no es un JSON válido",
//           details: e.message,
//         });
//       }
//     }
//     if (!Array.isArray(itemsEntrada)) itemsEntrada = [itemsEntrada];

//     // --- Traer saldos actuales de las facturas, conservando ORDEN ---
//     const facturas = [];
//     for (const idf of facturasOrden) {
//       const r = await executeQuery(
//         "SELECT id_factura, saldo FROM facturas WHERE id_factura = ?;",
//         [idf]
//       );
//       if (!r?.length) {
//         return res.status(404).json({ error: `Factura no encontrada: ${idf}` });
//       }
//       facturas.push({
//         id_factura: r[0].id_factura,
//         saldo: Number(r[0].saldo) || 0,
//       });
//     }

//     // --- Consultar en bloque la vista para obtener saldo disponible por raw_id ---
//     const rawIds = [...new Set(itemsEntrada.map((it) => String(it.id_saldo)))];
//     const placeholdersRaw = rawIds.map(() => "?").join(",");
//     const viewRows = rawIds.length
//       ? await executeQuery(
//           `SELECT raw_id, saldo FROM vw_pagos_prepago_facturables WHERE raw_id IN (${placeholdersRaw});`,
//           rawIds
//         )
//       : [];

//     const disponiblePorRawId = new Map();
//     for (const row of viewRows || []) {
//       const rid = String(row.raw_id);
//       const disp = Number(row.saldo);
//       if (Number.isFinite(disp)) disponiblePorRawId.set(rid, Math.max(0, disp));
//     }

//     // --- Construir créditos (topados por la vista) ---
//     const creditos = itemsEntrada
//       .map((it) => {
//         const raw = String(it.id_saldo);
//         const disponible = disponiblePorRawId.has(raw)
//           ? Number(disponiblePorRawId.get(raw))
//           : 0;
//         const isSaldoFavor = /^\d+$/.test(raw); // num puro => saldo a favor
//         return { raw_id: raw, disponible, restante: disponible, isSaldoFavor };
//       })
//       .filter((c) => c.disponible > 0);

//     if (creditos.length === 0) {
//       return res.status(400).json({
//         error: "No hay saldo disponible para aplicar (según la vista).",
//         detalle: {
//           solicitados: itemsEntrada.map((i) => ({ id_saldo: i.id_saldo })),
//           encontrados_en_vista: viewRows.length,
//         },
//       });
//     }


//     // --- Aplicación secuencial a facturas (resumen por factura y por crédito) ---
//     const appliedByFactura = new Map(); // id_factura -> suma aplicada
//     const appliedByCredito = new Map(); // raw_id     -> suma aplicada

//     let idxFactura = 0;

//     for (const cred of creditos) {
//       while (cred.restante > 0 && idxFactura < facturas.length) {
//         // Saltar facturas agotadas
//         while (idxFactura < facturas.length && facturas[idxFactura].saldo <= 0) {
//           idxFactura++;
//         }
//         if (idxFactura >= facturas.length) break;

//         const f = facturas[idxFactura];
//         const aplicar = Math.min(f.saldo, cred.restante);

//         if (aplicar <= 0) {
//           idxFactura++;
//           continue;
//         }

//         // Vincular crédito-factura a nivel puente (trazabilidad)
//         await executeQuery(
//           `INSERT INTO facturas_pagos_y_saldos (id_pago, id_saldo_a_favor, id_factura, monto)
//            VALUES (?, ?, ?, ?);`,
//           [cred.isSaldoFavor ? null : cred.raw_id, cred.isSaldoFavor ? cred.raw_id : null, f.id_factura, aplicar]
//         );

//         // Actualizar saldos en memoria
//         f.saldo -= aplicar;
//         cred.restante -= aplicar;

//         // Acumular totales para respuesta
//         appliedByFactura.set(f.id_factura, (appliedByFactura.get(f.id_factura) || 0) + aplicar);
//         appliedByCredito.set(cred.raw_id, (appliedByCredito.get(cred.raw_id) || 0) + aplicar);

//         if (f.saldo <= 0) idxFactura++;
//       }
//     }

//     // --- Persistir nuevos saldos de facturas ---
//     for (const f of facturas) {
//       await executeQuery("UPDATE facturas SET saldo = ? WHERE id_factura = ?;", [
//         f.saldo,
//         f.id_factura,
//       ]);
//     }

//     // === (A) OBTENER ITEMS DE LAS FACTURAS (ordenables para repartir por ítem) ===
//     const placeholdersFact = facturasOrden.map(() => "?").join(",");
//     const itemsDeFacturas = await executeQuery(
//       `SELECT id_item, id_factura, saldo
//        FROM items
//        WHERE id_factura IN (${placeholdersFact})
//        ORDER BY id_factura ASC, id_item ASC;`,
//       facturasOrden
//     );

//     const itemsHosp = await executeQuery(
//       `SELECT id_factura, id_hospedaje
//       FROM items
//       WHERE id_factura IN (${placeholdersFact})`,
//       facturasOrden
//     );

//     const hospedajesPorFactura = new Map();
//     for (const row of itemsHosp) {
//       if (!row?.id_hospedaje) continue;
//       const k = String(row.id_factura);
//       if (!hospedajesPorFactura.has(k)) hospedajesPorFactura.set(k, new Set());
//       hospedajesPorFactura.get(k).add(String(row.id_hospedaje));
//     }


// // 2) Lista de hospedajes únicos
// const allHospedajes = [...new Set(
//   [].concat(...[...hospedajesPorFactura.values()].map(s => [...s]))
// )];

// let servicioPorHosp = new Map();
// if (allHospedajes.length) {
//   const phH = allHospedajes.map(() => "?").join(",");
//   const reservasRows = await executeQuery(
//     `SELECT id_hospedaje, id_servicio
//      FROM vw_reservas_client
//      WHERE id_hospedaje IN (${phH});`,
//     allHospedajes
//   );
//   for (const r of reservasRows || []) {
//     if (r?.id_hospedaje) {
//       servicioPorHosp.set(String(r.id_hospedaje), r.id_servicio ?? null);
//     }
//   }
// }

// // 3) Reducimos a: factura -> (primer) id_servicio disponible
// const servicioPorFactura = new Map();
// for (const [idF, setHosp] of hospedajesPorFactura.entries()) {
//   let elegido = null;
//   for (const h of setHosp) {
//     if (servicioPorHosp.has(h)) {
//       elegido = servicioPorHosp.get(h);
//       if (elegido != null) break;
//     }
//   }
//   servicioPorFactura.set(idF, elegido); // puede ser null si no hay
// }

//     // Estructura: saldos pendientes por ítem (para repartir créditos a nivel ítem)
//     const itemPendiente = itemsDeFacturas.map((it) => ({
//       id_item: it.id_item,
//       id_factura: it.id_factura,
//       pendiente: Number(it.saldo) || 0,
//     }));

//     // === (B) CREAR REGISTROS EN "pagos" POR CADA raw_id CON APLICACIÓN > 0 ===
//     const transaccion = `tra-${uuidv4()}`;
//     const pagosCreados = new Map(); // raw_id -> id_pago

//     for (const cred of creditos) {
//       const aplicado = appliedByCredito.get(cred.raw_id) || 0;
//       if (aplicado <= 0) continue;

//       const id_pago = newId("pago");
//       pagosCreados.set(cred.raw_id, id_pago);

//       // Insert en pagos (saldo_aplicado = aplicado total de ese raw_id)
//       await executeQuery(
//         `INSERT INTO pagos (
//           id_pago, id_servicio, id_saldo_a_favor, id_agente,
//           metodo_de_pago, fecha_pago, concepto, referencia,
//           currency, tipo_de_tarjeta, link_pago, last_digits, total, saldo_aplicado, transaccion, monto_transaccion
//         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);`,
//         [
//           id_pago,                      // id_pago
//           null,                         // id_servicio
//           cred.isSaldoFavor ? cred.raw_id : null, // id_saldo_a_favor
//           id_agente,                    // id_agente
//           metodo_de_pago,               // metodo_de_pago
//           new Date(),                   // fecha_pago
//           concepto,                     // concepto
//           transaccion,                  // referencia
//           currency,                     // currency
//           tipo_de_tarjeta,              // tipo_de_tarjeta
//           link_pago,                    // link_pago
//           last_digits,                  // last_digits
//           aplicado,                     // total
//           aplicado,                     // saldo_aplicado
//           transaccion,                  // transaccion
//           aplicado,                     // monto_transaccion
//         ]
//       );
//     }

//     // === (C) DISTRIBUIR A NIVEL ÍTEM Y LLENAR items_pagos ===
//     // Para cada crédito (raw_id), repartimos lo aplicado entre los items pendientes
//     const valuesIP = [];
//     const paramsIP = [];

//     for (const cred of creditos) {
//       const aplicado = appliedByCredito.get(cred.raw_id) || 0;
//       if (aplicado <= 0) continue;

//       let porAplicar = aplicado;
//       const id_pago = pagosCreados.get(cred.raw_id); // ya insertado arriba

//       for (const it of itemPendiente) {
//         if (porAplicar <= 0) break;
//         if (it.pendiente <= 0) continue;

//         const m = Math.min(it.pendiente, porAplicar);
//         // push (id_item, id_pago, monto)
//         valuesIP.push("(?, ?, ?)");
//         paramsIP.push(it.id_item, id_pago, m);

//         it.pendiente -= m;
//         porAplicar -= m;
//       }
//     }

//     if (valuesIP.length > 0) {
//       const sqlIP = `INSERT INTO items_pagos (id_item, id_pago, monto) VALUES ${valuesIP.join(",")};`;
//       await executeQuery(sqlIP, paramsIP);
//     }

//     // === (D) ACTUALIZAR saldos_a_favor (solo si el raw_id es numérico) ===
//     for (const cred of creditos) {
//       if (!cred.isSaldoFavor) continue;
//       const aplicado = appliedByCredito.get(cred.raw_id) || 0;
//       const disponible = cred.disponible || 0;
//       const restante = Math.max(0, disponible - aplicado);
//       const saldo_actual = restante;

//       await executeQuery(
//         `UPDATE saldos_a_favor
//          SET saldo = ?,
//              activo = CASE WHEN (?) <= 0 THEN 0 ELSE 1 END
//          WHERE id_saldos = ?;`,
//         [saldo_actual, saldo_actual, cred.raw_id]
//       );
//     }

//     // === (E) OPCIONAL: obtener objetos completos de saldos por los raw_id recibidos ===
//     // select * from saldos where id_saldo in (viewRows.raw_id...)
//     let saldosFull = [];
//     if (rawIds.length) {
//       const ph = rawIds.map(() => "?").join(",");
//       saldosFull = await executeQuery(
//         `SELECT * FROM saldos WHERE id_saldo IN (${ph});`,
//         rawIds
//       );
//     }

//     // --- Confirmar transacción ---

//     // --- Respuesta estructurada ---
//     const detalleFacturas = facturas.map((f) => ({
//       id_factura: f.id_factura,
//       aplicado: appliedByFactura.get(f.id_factura) || 0,
//       saldo_final: f.saldo,
//     }));

//     const detalleCreditos = creditos.map((c) => ({
//       raw_id: c.raw_id,
//       tipo: c.isSaldoFavor ? "saldo_a_favor" : "pago",
//       disponible: c.disponible,
//       aplicado: appliedByCredito.get(c.raw_id) || 0,
//       sin_aplicar: Math.max(0, c.disponible - (appliedByCredito.get(c.raw_id) || 0)),
//       id_pago: pagosCreados.get(c.raw_id) || null,
//     }));

//     return res.status(200).json({
//       message:
//         "Pagos/Saldos aplicados por orden a facturas e items; pagos e items_pagos insertados; saldos_a_favor actualizado.",
//       orden_facturas: facturasOrden,
//       facturas: detalleFacturas,
//       creditos: detalleCreditos,
//       items_afectados: itemPendiente.map(({ id_item, id_factura, pendiente }) => ({
//         id_item,
//         id_factura,
//         saldo_pendiente_final: pendiente,
//       })),
//       saldos_full: saldosFull, // "objeto" de saldos solicitado
//       transaccion,
//     });
//   } catch (error) {
//     try {
//       await executeQuery("ROLLBACK");
//     } catch (_) {}
//     console.error("Error en asignarFacturaPagos:", error);
//     return res.status(500).json({
//       error: "Error al asignar pagos a las facturas",
//       details: error?.message || String(error),
//     });
//   }
// };

const asignarFacturaPagos = async (req, res) => {
  // Helper para IDs si no usas uuidv4()
  const newId = (pfx) =>
    `${pfx}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;

  // Helper de logging
  const logQuery = (label, sql, params, result) => {
    console.log(`[SQL] ${label}\n  Query: ${sql}\n  Params:`, params);
    if (result !== undefined) {
      console.log(`  Result:`, result);
    }
    console.log("------------------------------------------------------------");
  };

  try {
    const {
      id_factura: facturasRaw,
      ejemplo_saldos: saldosRaw,
      id_agente = null,
      metodo_de_pago = "aplicacion_saldo",
      currency = "MXN",
      tipo_de_tarjeta = null,
      link_pago = null,
      last_digits = null,
      referencia = null, // usaremos 'transaccion' si viene null
      concepto = "Aplicación a facturas",
    } = req.body || {};

    if (!facturasRaw || (Array.isArray(facturasRaw) && facturasRaw.length === 0)) {
      return res.status(400).json({
        error: "Debes enviar 'id_factura' con 1+ elementos (array o string).",
      });
    }

    // --- Normalizar arrays ---
    const facturasOrden = Array.isArray(facturasRaw) ? facturasRaw : [facturasRaw];

    let itemsEntrada = saldosRaw;
    if (!itemsEntrada) {
      return res.status(400).json({ error: "Falta 'ejemplo_saldos' en el payload." });
    }
    if (typeof itemsEntrada === "string") {
      try {
        itemsEntrada = JSON.parse(itemsEntrada);
      } catch (e) {
        return res.status(400).json({
          error: "El campo 'ejemplo_saldos' no es un JSON válido",
          details: e.message,
        });
      }
    }
    if (!Array.isArray(itemsEntrada)) itemsEntrada = [itemsEntrada];

    // --- Iniciar transacción ---

    // --- Traer saldos actuales de las facturas, conservando ORDEN ---
    const facturas = [];
    for (const idf of facturasOrden) {
      const queryFactura = "SELECT id_factura, saldo FROM facturas WHERE id_factura = ?;";
      const r = await executeQuery(queryFactura, [idf]);
      logQuery("SELECT factura saldo", queryFactura, [idf], r);

      if (!r?.length) {
        throw new Error(`Factura no encontrada: ${idf}`);
      }
      facturas.push({
        id_factura: r[0].id_factura,
        saldo: Number(r[0].saldo) || 0,
      });
    }
    console.log("[DBG] Facturas (saldo inicial):", facturas);

    // --- Consultar en bloque la vista para obtener saldo disponible por raw_id ---
    const rawIds = [...new Set(itemsEntrada.map((it) => String(it.id_saldo)))];
    const placeholdersRaw = rawIds.map(() => "?").join(",");
    let viewRows = [];
    if (rawIds.length) {
      const queryVista = `SELECT raw_id, saldo FROM vw_pagos_prepago_facturables WHERE raw_id IN (${placeholdersRaw});`;
      viewRows = await executeQuery(queryVista, rawIds);
      logQuery("SELECT vista saldos disponibles", queryVista, rawIds, viewRows);
    }

    const disponiblePorRawId = new Map();
    for (const row of viewRows || []) {
      const rid = String(row.raw_id);
      const disp = Number(row.saldo);
      if (Number.isFinite(disp)) disponiblePorRawId.set(rid, Math.max(0, disp));
    }

    // --- Construir créditos (topados por la vista) ---
    const creditos = itemsEntrada
      .map((it) => {
        const raw = String(it.id_saldo);
        const disponible = disponiblePorRawId.has(raw)
          ? Number(disponiblePorRawId.get(raw))
          : 0;
        const isSaldoFavor = /^\d+$/.test(raw); // num puro => saldo a favor
        return { raw_id: raw, disponible, restante: disponible, isSaldoFavor };
      })
      .filter((c) => c.disponible > 0);

    console.log("[DBG] Créditos filtrados (con saldo disponible):", creditos);

    if (creditos.length === 0) {
      throw new Error("No hay saldo disponible para aplicar (según la vista).");
    }

    // === (A) OBTENER ITEMS DE LAS FACTURAS con id_hospedaje (para mapear a id_servicio) ===
    const placeholdersFact = facturasOrden.map(() => "?").join(",");
    const queryItems = `SELECT id_item, id_factura, saldo, id_hospedaje FROM items WHERE id_factura IN (${placeholdersFact}) ORDER BY id_factura ASC, id_item ASC;`;
    const itemsDeFacturas = await executeQuery(queryItems, facturasOrden);
    logQuery("SELECT items por facturas", queryItems, facturasOrden, itemsDeFacturas);

    // Estructura: saldos pendientes por ítem (para repartir créditos a nivel ítem)
    const itemPendiente = (itemsDeFacturas || []).map((it) => ({
      id_item: it.id_item,
      id_factura: it.id_factura,
      pendiente: Number(it.saldo) || 0,
      id_hospedaje: it.id_hospedaje ?? null,
    }));
    console.log("[DBG] Items (pendiente inicial):", itemPendiente);

    // === (A.1) Construir: factura -> set de id_hospedaje
    const hospedajesPorFactura = new Map(); // id_factura -> Set(id_hospedaje)
    const setHospedajes = new Set();
    for (const it of itemPendiente) {
      if (!it.id_hospedaje) continue;
      setHospedajes.add(String(it.id_hospedaje));
      if (!hospedajesPorFactura.has(it.id_factura)) {
        hospedajesPorFactura.set(it.id_factura, new Set());
      }
      hospedajesPorFactura.get(it.id_factura).add(String(it.id_hospedaje));
    }

    // === (A.2) Mapear id_hospedaje -> id_servicio desde la vista vw_reservas_client
    const hospedajesUnicos = Array.from(setHospedajes);
    const mapHospToServ = new Map(); // id_hospedaje -> id_servicio
    if (hospedajesUnicos.length) {
      const phHosp = hospedajesUnicos.map(() => "?").join(",");
      const queryVistaReservas = `SELECT id_hospedaje, id_servicio FROM vw_reservas_client WHERE id_hospedaje IN (${phHosp});`;
      const rowsVista = await executeQuery(queryVistaReservas, hospedajesUnicos);
      logQuery("SELECT vw_reservas_client", queryVistaReservas, hospedajesUnicos, rowsVista);
      for (const r of rowsVista || []) {
        const h = String(r.id_hospedaje);
        const s = r.id_servicio ?? null;
        if (s != null) mapHospToServ.set(h, s);
      }
    }

    // Helper: elegir id_servicio representativo respetando el orden de facturas
    const pickIdServicio = () => {
      for (const fId of facturasOrden) {
        const setH = hospedajesPorFactura.get(fId);
        if (!setH || setH.size === 0) continue;
        for (const h of setH) {
          if (mapHospToServ.has(h)) return mapHospToServ.get(h);
        }
      }
      return null;
    };
    const id_servicio_representativo = pickIdServicio();
    console.log("[DBG] id_servicio_representativo:", id_servicio_representativo);

    // --- Plan de aplicación (separado por crédito -> por factura -> por ítem)
    // 1) Aplicamos a nivel facturas para actualizar saldos en memoria y acumular totales por factura/credito
    const appliedByFactura = new Map(); // id_factura -> suma aplicada
    const appliedByCredito = new Map(); // raw_id     -> suma aplicada
    let idxFactura = 0;

    // Copia de trabajo de saldos de facturas
    const facturasWorking = facturas.map((f) => ({ ...f }));

    for (const cred of creditos) {
      while (cred.restante > 0 && idxFactura < facturasWorking.length) {
        // Saltar facturas ya en cero
        while (idxFactura < facturasWorking.length && facturasWorking[idxFactura].saldo <= 0) {
          idxFactura++;
        }
        if (idxFactura >= facturasWorking.length) break;

        const f = facturasWorking[idxFactura];
        const aplicar = Math.min(f.saldo, cred.restante);

        if (aplicar <= 0) {
          idxFactura++;
          continue;
        }

        // Actualizar saldos en memoria
        f.saldo -= aplicar;
        cred.restante -= aplicar;

        // Acumular totales
        appliedByFactura.set(f.id_factura, (appliedByFactura.get(f.id_factura) || 0) + aplicar);
        appliedByCredito.set(cred.raw_id, (appliedByCredito.get(cred.raw_id) || 0) + aplicar);

        if (f.saldo <= 0) idxFactura++;
      }
    }

    console.log("[DBG] Totales aplicados por factura:", Array.from(appliedByFactura.entries()));
    console.log("[DBG] Totales aplicados por crédito:", Array.from(appliedByCredito.entries()));
    console.log("[DBG] Saldos finales (memoria) de facturas:", facturasWorking);

    // 2) Reparto a nivel ítem (para construir items_pagos)
    // Para consistencia: iteramos créditos en orden, y para cada crédito recorremos items secuencialmente
    const planItemsPagos = []; // {id_item, raw_id, monto}
    for (const cred of creditos) {
      const aplicado = appliedByCredito.get(cred.raw_id) || 0;
      if (aplicado <= 0) continue;
      let porAplicar = aplicado;
      for (const it of itemPendiente) {
        if (porAplicar <= 0) break;
        if (it.pendiente <= 0) continue;

        const m = Math.min(it.pendiente, porAplicar);
        planItemsPagos.push({ id_item: it.id_item, raw_id: cred.raw_id, monto: m });

        it.pendiente -= m;
        porAplicar -= m;
      }
    }
    console.log("[DBG] Plan items_pagos:", planItemsPagos);

    // 3) Crear pagos por crédito aplicado (>0)
    const transaccion = newId("tra");
    const pagosCreados = new Map(); // raw_id -> id_pago

    for (const cred of creditos) {
      const aplicado = appliedByCredito.get(cred.raw_id) || 0;
      if (aplicado <= 0) continue;

      const id_pago = newId("pago");
      pagosCreados.set(cred.raw_id, id_pago);

      const id_saldo_a_favor_pago = cred.isSaldoFavor ? cred.raw_id : null;
      const referencia_pago = referencia ?? transaccion;

      // fecha_pago = NOW() (evitar pasar Date)
      const queryInsertPagos = `
        INSERT INTO pagos (
          id_pago, id_servicio, id_saldo_a_favor, id_agente, metodo_de_pago,
          fecha_pago, concepto, referencia, currency, tipo_de_tarjeta,
          link_pago, last_digits, total, saldo_aplicado, transaccion, monto_transaccion
        )
        VALUES (?,?,?,?,?, NOW(), ?,?,?,?,?,?,?,?,?,?);
      `;
      const paramsPago = [
        id_pago,                           // id_pago
        id_servicio_representativo,        // id_servicio (de vw_reservas_client) o null
        id_saldo_a_favor_pago,             // id_saldo_a_favor (solo si es saldo a favor)
        id_agente,                         // id_agente
        metodo_de_pago,                    // metodo_de_pago
        concepto,                          // concepto
        referencia_pago,                   // referencia
        currency,                          // currency
        tipo_de_tarjeta,                   // tipo_de_tarjeta
        link_pago,                         // link_pago
        last_digits,                       // last_digits
        aplicado,                          // total
        aplicado,                          // saldo_aplicado
        transaccion,                       // transaccion
        aplicado,                          // monto_transaccion
      ];
      const rPago = await executeQuery(queryInsertPagos, paramsPago);
      logQuery("INSERT pagos", queryInsertPagos, paramsPago, rPago);
    }
    console.log("[DBG] pagosCreados (raw_id -> id_pago):", Array.from(pagosCreados.entries()));

    // 4) Insertar items_pagos usando el id_pago resultante por cada raw_id
    if (planItemsPagos.length > 0) {
      const valuesIP = [];
      const paramsIP = [];
      for (const p of planItemsPagos) {
        const id_pago = pagosCreados.get(p.raw_id);
        if (!id_pago) continue; // seguridad
        valuesIP.push("(?, ?, ?)");
        paramsIP.push(p.id_item, id_pago, p.monto);
      }
      if (valuesIP.length > 0) {
        const sqlIP = `INSERT INTO items_pagos (id_item, id_pago, monto) VALUES ${valuesIP.join(",")};`;
        const rIP = await executeQuery(sqlIP, paramsIP);
        logQuery("INSERT items_pagos (bulk)", sqlIP, paramsIP, rIP);
      } else {
        console.log("[DBG] No hubo values para items_pagos (posible error de plan).");
      }
    }

    // 5) Insertar facturas_pagos_y_saldos por factura y crédito:
    //    - Si es saldo a favor => (id_pago=null, id_saldo_a_favor=raw_id)
    //    - Si es pago         => (id_pago=id_pago generado, id_saldo_a_favor=null)
    //    Para el monto por factura, usamos appliedByFactura[factura] pero debemos
    //    distribuir por crédito. Para esto, generamos un reparto factura->ítems->crédito ya hecho.
    //    Simplificación: recalculamos por factura sumando de planItemsPagos los montos de ítems de esa factura por cada crédito.
    const montoFacturaCredito = new Map(); // key `${id_factura}|${raw_id}` -> monto
    const facturaPorItem = new Map(itemPendiente.map(it => [it.id_item, it.id_factura]));

    for (const p of planItemsPagos) {
      const id_factura = facturaPorItem.get(p.id_item);
      const key = `${id_factura}|${p.raw_id}`;
      montoFacturaCredito.set(key, (montoFacturaCredito.get(key) || 0) + p.monto);
    }

    const queryBridge = `INSERT INTO facturas_pagos_y_saldos (id_pago, id_saldo_a_favor, id_factura, monto) VALUES (?,?,?,?);`;
    for (const [key, monto] of montoFacturaCredito.entries()) {
      const [id_factura, raw] = key.split("|");
      const cred = creditos.find(c => c.raw_id === raw);
      if (!cred) continue;
      const id_pago_vinc = cred.isSaldoFavor ? null : pagosCreados.get(raw);
      const id_saldo_vinc = cred.isSaldoFavor ? raw : null;

      const paramsBridge = [id_pago_vinc, id_saldo_vinc, id_factura, monto];
      const rBridge = await executeQuery(queryBridge, paramsBridge);
      logQuery("INSERT facturas_pagos_y_saldos", queryBridge, paramsBridge, rBridge);
    }

    // 6) ACTUALIZAR saldos de facturas (con la copia final calculada)
    for (let i = 0; i < facturasWorking.length; i++) {
      const f = facturasWorking[i];
      const queryUpdateFactura = "UPDATE facturas SET saldo = ? WHERE id_factura = ?;";
      const rUF = await executeQuery(queryUpdateFactura, [f.saldo, f.id_factura]);
      logQuery("UPDATE facturas.saldo", queryUpdateFactura, [f.saldo, f.id_factura], rUF);
    }

    // 7) ACTUALIZAR saldos de items (pendiente final)
    //    Hacemos un UPDATE ... CASE para minimizar roundtrips
    const itemsConCambio = itemPendiente.filter(it => Number.isFinite(it.pendiente));
    if (itemsConCambio.length > 0) {
      const ids = itemsConCambio.map(it => it.id_item);
      const caseParts = itemsConCambio.map(it => `WHEN id_item = ? THEN ?`).join(" ");
      const paramsCase = [];
      for (const it of itemsConCambio) {
        paramsCase.push(it.id_item, it.pendiente);
      }
      const placeholdersItems = ids.map(() => "?").join(",");
      const sqlUpdateItems = `
        UPDATE items
        SET saldo = CASE ${caseParts} END
        WHERE id_item IN (${placeholdersItems});
      `;
      const paramsUpdateItems = [...paramsCase, ...ids];
      const rUI = await executeQuery(sqlUpdateItems, paramsUpdateItems);
      logQuery("UPDATE items.saldo (CASE bulk)", sqlUpdateItems, paramsUpdateItems, rUI);
    } else {
      console.log("[DBG] No hubo items a actualizar (posible ya en cero).");
    }

    // 8) ACTUALIZAR saldos_a_favor (solo si el raw_id es numérico)
    for (const cred of creditos) {
      if (!cred.isSaldoFavor) continue;
      const aplicado = appliedByCredito.get(cred.raw_id) || 0;
      const disponible = cred.disponible || 0;
      const restante = Math.max(0, disponible - aplicado);
      const saldo_actual = restante;

      const queryUpdateSaldos = `
        UPDATE saldos_a_favor
        SET saldo = ?, activo = CASE WHEN (?) <= 0 THEN 0 ELSE 1 END
        WHERE id_saldos = ?;
      `;
      const paramsUS = [saldo_actual, saldo_actual, cred.raw_id];
      const rUS = await executeQuery(queryUpdateSaldos, paramsUS);
      logQuery("UPDATE saldos_a_favor", queryUpdateSaldos, paramsUS, rUS);
    }

    // 9) (E) OPCIONAL: obtener objetos completos de saldos por los raw_id recibidos
    let saldosFull = [];
    if (rawIds.length) {
      const ph = rawIds.map(() => "?").join(",");
      const querySelectSaldosFull = `SELECT * FROM saldos WHERE id_saldo IN (${ph});`;
      saldosFull = await executeQuery(querySelectSaldosFull, rawIds);
      logQuery("SELECT saldos (full)", querySelectSaldosFull, rawIds, saldosFull);
    }



    // --- Respuesta estructurada ---
    const detalleFacturas = facturasWorking.map((f) => ({
      id_factura: f.id_factura,
      aplicado: appliedByFactura.get(f.id_factura) || 0,
      saldo_final: f.saldo,
    }));

    const detalleCreditos = creditos.map((c) => ({
      raw_id: c.raw_id,
      tipo: c.isSaldoFavor ? "saldo_a_favor" : "pago",
      disponible: c.disponible,
      aplicado: appliedByCredito.get(c.raw_id) || 0,
      sin_aplicar: Math.max(0, c.disponible - (appliedByCredito.get(c.raw_id) || 0)),
      id_pago: pagosCreados.get(c.raw_id) || null,
    }));

    const serviciosVinculados = {
      id_servicio_representativo,
      hospedajes_consultados: Array.from(setHospedajes),
      hospedaje_a_servicio: Array.from(mapHospToServ.entries()).map(([h, s]) => ({ id_hospedaje: h, id_servicio: s })),
    };

    return res.status(200).json({
      message:
        "Pagos/Saldos aplicados; pagos, items_pagos y puente insertados; facturas/items/saldos_a_favor actualizados.",
      orden_facturas: facturasOrden,
      facturas: detalleFacturas,
      creditos: detalleCreditos,
      items_afectados: itemPendiente.map(({ id_item, id_factura, pendiente }) => ({
        id_item,
        id_factura,
        saldo_pendiente_final: pendiente,
      })),
      saldos_full: saldosFull,
      transaccion,
      servicios_vinculados: serviciosVinculados,
    });
  } catch (error) {
    try {
      await executeQuery("ROLLBACK");
      console.log("[TX] ROLLBACK por error");
    } catch (_) {}
    console.error("Error en asignarFacturaPagos:", error);
    return res.status(500).json({
      error: "Error al asignar pagos a las facturas",
      details: error?.message || String(error),
    });
  }
};


const filtrarFacturas = async (req, res) => {
  const { estatusFactura, id_factura,id_cliente,cliente,uuid,rfc} = req.body;
  try {
    console.log(estatusFactura)
    const result = await executeSP("sp_filtrar_facturas", [
      estatusFactura || null,
      id_factura || null,
      id_cliente || null,
      cliente || null,
      uuid || null,
      rfc || null
    ]);
    if (!result) {
      return res.status(404).json({
        message: "No se encontraron facturas con el parametro deseado",
      });
    }
    return res.status(200).json({
      message: "Facturas filtradas correctamente",
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error al filtrar facturas",
      details: error.message || error,
      otherDetails: error.response?.data || null,
    });
  }
};
// Este es el endpoint para el caso 1a1
// const crearFacturaDesdeCargaPagos = async(req,res)=>{
//   const { fecha_emision, estado, usuario_creador, id_agente, total, subtotal, impuestos, saldo, rfc, id_empresa, uuid_factura, rfc_emisor, url_pdf, url_xml , raw_id
//   } = req.body;
// // de una validamos el tipo de pago

//   const id_factura = "fac-"+uuidv4();
//   const query = `INSERT INTO facturas (id_factura, fecha_emision, estado, usuario_creador, id_agente, total, subtotal, impuestos, saldo, rfc, id_empresa, uuid_factura, rfc_emisor, url_pdf, url_xml)
//                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
// if (raw_id.toString().includes("pag-")) {
//   var id = 'id_pago';
// } else {
//   var id = 'id_saldo_a_favor';
// }
// const query2 = `INSERT INTO facturas_pagos_y_saldos (${id}, id_factura, monto)
//                  VALUES (?, ?, ?)`;
//   try {
//     runTransaction(async (connection) => {
//       const [result] = await connection.query(query, [
//         id_factura,
//         fecha_emision,
//         estado,
//         usuario_creador,
//         id_agente,
//         total,
//         subtotal,
//         impuestos,
//         saldo,
//         rfc,
//         id_empresa,
//         uuid_factura,
//         rfc_emisor,
//         url_pdf,
//         url_xml
//       ]);
//       if (result.affectedRows === 0) {
//         throw new Error("No se pudo crear la factura desde carga");
//       }
//       const [result2] = await connection.query(query2, [
//         raw_id,
//         id_factura,
//         total
//       ]);
//       if (result2.affectedRows === 0) {
//         throw new Error("No se pudo asignar el pago o saldo a favor a la factura");
//       }
//       res.status(201).json({
//         message: "Factura creada correctamente desde carga con pago o saldo a favor",
//         data: { id_factura, raw_id }
//       });
//     });
//   } catch (error) {
//     res.status(500).json({
//       error: "Error al crear factura desde carga con pago o saldo a favor",
//   })
// }
// }

const get_agente_facturas = async (req, res) => {
  const { id_agente } = req.query;

  try {
    if (!id_agente) {
      throw new ShortError("No se encontro el id de agente", 404);
    }
    // 2. Ejecutar el Stored Procedure y pasar el ID del agente
    const facturas = await executeSP("get_agente_facturas", [id_agente]);
    // 3. Verificar si se encontraron facturas
    // if (facturas.length === 0) {
    //   return res.status(400).json({
    //     message: "No se encontraron facturas para el agente proporcionado.",
    //     data: [],
    //   });
    // }

    // 4. Enviar la respuesta con las facturas encontradas
    res.status(200).json({
      message: "Facturas del agente obtenidas correctamente.",
      data: facturas,
    });
  } catch (error) {
    // 5. Manejar errores
    req.context.logStep("Error en get_agente_facturas:", error);
    res.status(500).json({
      error: error,
      message: error.message || "Error al obtener facturas",
      data: null,
    });
  }
};

const createEmi = async (req, res) => {
  req.context.logStep(
    "createEmi",
    "Inicio del proceso de creación de factura (emi)"
  );
  try {
    const resp = await model.crearFacturaEmi(req, req.body);

    const facturamaData = resp?.facturama?.Id
      ? resp.facturama
      : resp?.data?.facturama?.Id
      ? resp.data.facturama
      : resp?.data?.Id
      ? resp.data
      : resp?.Id
      ? resp
      : null;

    if (!facturamaData) {
      return res.status(500).json({
        ok: false,
        message: "El modelo no devolvió los datos de Facturama esperados",
        detail: resp,
      });
    }

    return res.status(201).json({ data: facturamaData });
  } catch (error) {
    const status = error?.response?.status || error?.statusCode || 500;
    const payload = error?.response?.data ||
      error?.details || { message: error?.message || "Error" };
    return res.status(status).json({
      ok: false,
      message: payload.Message || payload.message || "Error al timbrar",
      detail: payload,
    });
  }
};

const crearFacturaDesdeCargaPagos = async (req, res) => {
  const {
    fecha_emision,
    estado,
    usuario_creador,
    id_agente,
    total,
    subtotal,
    impuestos,
    saldo,
    rfc,
    id_empresa,
    uuid_factura,
    rfc_emisor,
    url_pdf,
    url_xml,
    raw_id, // siempre viene del body: "pag-..." (uuid) o entero (id saldo)
  } = req.body;

  if (raw_id === undefined || raw_id === null) {
    return res
      .status(400)
      .json({ error: "Se requiere raw_id para vincular la factura." });
  }

  // Solo para decidir la columna FK; el valor original de raw_id se conserva para el INSERT
  const rawIdStr = String(raw_id).trim().toLowerCase();
  const fkColumn = rawIdStr.startsWith("pag-") ? "id_pago" : "id_saldo_a_favor";

  const id_factura = "fac-" + uuidv4();

  // ¿El body ya trae datos suficientes de la factura?
  const bodyTieneFactura =
    Boolean(fecha_emision) &&
    (Boolean(uuid_factura) || Boolean(url_xml)) &&
    total != null &&
    subtotal != null;

  const mapFacturamaToFacturaRow = (fd) => {
    const f = fd || {};
    const links = f.Links || f.links || {};
    const comp = f.Complemento || f.complemento || {};
    const timbre = comp.TimbreFiscalDigital || comp.timbreFiscalDigital || {};
    const emisor = f.Emisor || f.emisor || {};
    const totales = f.Totales || f.totales || {};

    const mTotal = f.Total ?? totales.Total ?? total ?? 0;
    const mSub = f.SubTotal ?? f.Subtotal ?? totales.SubTotal ?? subtotal ?? 0;
    const mImp =
      mTotal != null && mSub != null
        ? Number(mTotal) - Number(mSub)
        : impuestos ?? 0;

    return {
      fecha_emision: f.Fecha || f.fecha || new Date(),
      estado: estado || "Timbrada",
      usuario_creador: usuario_creador ?? null,
      id_agente,
      total: mTotal,
      subtotal: mSub,
      impuestos: mImp,
      saldo: saldo ?? 0,
      rfc,
      id_empresa: id_empresa ?? null,
      uuid_factura:
        timbre.UUID || timbre.Uuid || f.Uuid || f.UUID || uuid_factura || null,
      rfc_emisor: emisor.Rfc || emisor.RFC || rfc_emisor || null,
      url_pdf:
        links.Pdf || links.pdf || f.PdfUrl || f.pdfUrl || url_pdf || null,
      url_xml:
        links.Xml || links.xml || f.XmlUrl || f.xmlUrl || url_xml || null,
    };
  };

  let row;
  let facturamaData = null;
  let source = "body";

  try {
    if (!bodyTieneFactura) {
      // Timbra con Facturama (lógica de createEmi integrada)
      const resp = await model.crearFacturaEmi(req, req.body);
      facturamaData = resp?.facturama?.Id
        ? resp.facturama
        : resp?.data?.facturama?.Id
        ? resp.data.facturama
        : resp?.data?.Id
        ? resp.data
        : resp?.Id
        ? resp
        : null;

      if (!facturamaData) {
        return res.status(500).json({
          ok: false,
          message: "El modelo no devolvió los datos de Facturama esperados",
          detail: resp,
        });
      }
      row = mapFacturamaToFacturaRow(facturamaData);
      source = "facturama";
    } else {
      // Usa los datos del body
      const mTotal = total ?? 0;
      const mSub = subtotal ?? 0;
      const mImp =
        impuestos != null ? impuestos : Number(mTotal) - Number(mSub);
      row = {
        fecha_emision,
        estado,
        usuario_creador: usuario_creador ?? null,
        id_agente,
        total: mTotal,
        subtotal: mSub,
        impuestos: mImp,
        saldo: saldo ?? facturamaArgs.saldo,
        rfc: rfc || facturamaArgs.rfc,
        id_empresa: id_empresa ?? facturamaArgs.id_empresa,
        uuid_factura: uuid_factura,
        rfc_emisor: rfc_emisor || facturamaArgs.rfc_emisor,
        url_pdf: url_pdf || facturamaArgs.url_pdf,
        url_xml: url_xml || facturamaArgs.url_xml,
      };
    }

    const insertFacturaSQL = `
      INSERT INTO facturas (
        id_factura, fecha_emision, estado, usuario_creador, id_agente,
        total, subtotal, impuestos, saldo, rfc, id_empresa,
        uuid_factura, rfc_emisor, url_pdf, url_xml
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // fkColumn es seguro (solo "id_pago" o "id_saldo_a_favor")
    const insertLinkSQL = `
      INSERT INTO facturas_pagos_y_saldos (${fkColumn}, id_factura, monto)
      VALUES (?, ?, ?)
    `;

    await runTransaction(async (connection) => {
      const [r1] = await connection.query(insertFacturaSQL, [
        id_factura,
        row.fecha_emision,
        row.estado,
        row.usuario_creador,
        row.id_agente,
        row.total,
        row.subtotal,
        row.impuestos,
        row.saldo,
        row.rfc,
        row.id_empresa,
        row.uuid_factura,
        row.rfc_emisor,
        row.url_pdf,
        row.url_xml,
      ]);
      if (!r1?.affectedRows) throw new Error("No se pudo crear la factura");

      // IMPORTANTE: aquí usamos el valor ORIGINAL de raw_id (uuid o entero)
      const [r2] = await connection.query(insertLinkSQL, [
        raw_id,
        id_factura,
        row.total,
      ]);
      if (!r2?.affectedRows)
        throw new Error("No se pudo vincular el pago/saldo a la factura");

      return res.status(201).json({
        message: "Factura creada correctamente",
        data: {
          id_factura,
          raw_id,
          source,
          facturama:
            source === "facturama"
              ? {
                  Id: facturamaData?.Id,
                  Uuid: row.uuid_factura,
                  links: { pdf: row.url_pdf, xml: row.url_xml },
                }
              : undefined,
        },
      });
    });
  } catch (error) {
    const status = error?.response?.status || error?.statusCode || 500;
    const payload = error?.response?.data ||
      error?.details || { message: error?.message || "Error" };
    return res.status(status).json({
      ok: false,
      message:
        payload.Message || payload.message || "Error al crear la factura",
      detail: payload,
    });
  }
};

// Crea 1 factura y la vincula con N pagos/saldos.
// Si no viene "factura" en el body, timbra con Facturama (model.crearFacturaEmi).
const crearFacturaMultiplesPagos = async (req, res) => {
  const { factura: facturaBody, pagos_asociados } = req.body || {};
  const { info_user, datos_empresa } = req.body;

  if (!Array.isArray(pagos_asociados) || pagos_asociados.length === 0) {
    return res.status(400).json({
      ok: false,
      message: "Se requiere pagos_asociados (array con al menos un elemento).",
    });
  }

  // Normaliza cada pago: { raw_id, monto }
  let pagos;
  try {
    pagos = pagos_asociados.map((p, idx) => {
      const rid = p?.raw_id;
      const mnt = p?.monto ?? p?.monto_facturado ?? p?.amount;
      if (rid === undefined || rid === null || String(rid).trim() === "") {
        throw new Error(`pagos_asociados[${idx}]: raw_id es requerido`);
      }
      if (
        mnt === undefined ||
        mnt === null ||
        isNaN(Number(mnt)) ||
        Number(mnt) < 0
      ) {
        throw new Error(`pagos_asociados[${idx}]: monto inválido`);
      }
      return { raw_id: rid, monto: Number(mnt) };
    });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }

  const id_factura = "fac-" + uuidv4();
  const getFk = (rid) =>
    String(rid).trim().toLowerCase().startsWith("pag-")
      ? "id_pago"
      : "id_saldo_a_favor";

  // ¿La factura ya viene completa en el body?
  const fb = facturaBody || {};
  console.log("😁😁😁😁😁😁😁😁😁😁🤣🤣🤣🤣🤣", )

  const bodyTieneFactura =
    Boolean(fb.fecha_emision) &&
    (Boolean(fb.uuid_factura) || Boolean(fb.url_xml)) &&
    fb.total != null &&
    fb.subtotal != null;

  const mapFacturamaToFacturaRow = (fd) => {
    const f = fd || {};
    const links = f.Links || f.links || {};
    const comp = f.Complemento || f.complemento || {};
    const timbre = comp.TimbreFiscalDigital || comp.timbreFiscalDigital || {};
    const emisor = f.Emisor || f.emisor || {};
    const totales = f.Totales || f.totales || {};
    const total = f.Total ?? totales.Total ?? 0;
    const subtotal = f.SubTotal ?? f.Subtotal ?? totales.SubTotal ?? 0;
    const impuestos = Number(total) - Number(subtotal);
    console.log("datos factura 🐨🐨🐨🐨🐨🐨🐨🐨🐨🐨🐨🐨🐨", f);
    return {
      fecha_emision: f.Fecha || f.fecha || new Date(),
      estado: "Confirmada",
      usuario_creador: info_user.usuario_creador,
      id_agente: fb.id_agente ?? info_user.id_agente,
      total,
      subtotal,
      impuestos,
      saldo: fb.saldo ?? 0,
      rfc: fb.rfc,
      id_empresa: fb.id_empresa ?? null,
      uuid_factura:
        timbre.UUID ||
        timbre.Uuid ||
        f.Uuid ||
        f.UUID ||
        fb.uuid_factura ||
        null,
      rfc_emisor: emisor.Rfc || emisor.RFC || fb.rfc_emisor || null,
      url_pdf:
        links.Pdf || links.pdf || f.PdfUrl || f.pdfUrl || fb.url_pdf || null,
      url_xml:
        links.Xml || links.xml || f.XmlUrl || f.xmlUrl || fb.url_xml || null,
    };
  };

  let rowFactura;
  let facturamaData = null;
  let source = "body";

  try {
    if (!bodyTieneFactura) {
      const resp = await model.crearFacturaEmi(req, req.body);
      facturamaData = resp?.facturama?.Id
        ? resp.facturama
        : resp?.data?.facturama?.Id
        ? resp.data.facturama
        : resp?.data?.Id
        ? resp.data
        : resp?.Id
        ? resp
        : null;

      if (!facturamaData) {
        return res.status(500).json({
          ok: false,
          message: "El modelo no devolvió los datos de Facturama esperados",
          detail: resp,
        });
      }
      rowFactura = mapFacturamaToFacturaRow(facturamaData);
      // console.log("RECEIVER", resp.data.facturama.Receiver);
      // console.log("ISSUER", resp.data.facturama.Issuer);
      rowFactura.rfc_emisor = resp.data.facturama.Issuer.Rfc;
      rowFactura.rfc = resp.data.facturama.Receiver.Rfc;
      rowFactura.id_facturama = resp.data.facturama.Id;
      rowFactura.id_empresa = datos_empresa.id_empresa;
      rowFactura.uuid_factura = resp.data.facturama.Complement.TaxStamp.Uuid;
      source = "facturama";
    } else {
      const total = fb.total ?? 0;
      const subtotal = fb.subtotal ?? 0;
      const impuestos =
        fb.impuestos != null ? fb.impuestos : Number(total) - Number(subtotal);
      rowFactura = {
        fecha_emision: fb.fecha_emision,
        estado: fb.estado,
        usuario_creador: fb.usuario_creador ?? null,
        id_agente: fb.id_agente,
        total,
        subtotal,
        impuestos,
        saldo: fb.saldo ?? 0,
        rfc: fb.rfc,
        id_empresa: fb.id_empresa ?? null,
        uuid_factura: fb.uuid_factura ?? null,
        rfc_emisor: fb.rfc_emisor ?? null,
        url_pdf: fb.url_pdf ?? null,
        url_xml: fb.url_xml ?? null,
      };
    }

    // --------- Validación dura: suma de pagos == total de la factura (en centavos) ----------
    const totalFacturaCents = Math.round(Number(rowFactura.total) * 100);
    const sumPagosCents = pagos.reduce(
      (acc, p) => acc + Math.round(Number(p.monto) * 100),
      0
    );
    if (sumPagosCents !== totalFacturaCents) {
      return res.status(400).json({
        ok: false,
        message: "La suma de los pagos no coincide con el total de la factura.",
        total_factura: Number(rowFactura.total),
        total_vinculado: sumPagosCents / 100,
        diferencia: (totalFacturaCents - sumPagosCents) / 100,
      });
    }
    // ---------------------------------------------------------------------------------------

    const insertFacturaSQL = `
      INSERT INTO facturas (
        id_factura, fecha_emision, estado, usuario_creador, id_agente,
        total, subtotal, impuestos, saldo, rfc, id_empresa,
        uuid_factura, rfc_emisor, url_pdf, url_xml, id_facturama,origen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)
    `;

    await runTransaction(async (connection) => {
      try {
        let generador = rowFactura.usuario_creador
        let origen = 0
        if (!rowFactura.usuario_creador) {
          generador = rowFactura.id_agente
          origen = 1
        }
        
                console.log("😁😁😁😁😁😁😁😁😁😁🤣🤣🤣🤣🤣", rowFactura)
        console.log("😁😁😁😁😁😁😁😁😁😁🤣🤣🤣🤣🤣, generados", generador)
        const [r1] = await connection.query(insertFacturaSQL, [
          id_factura,
          rowFactura.fecha_emision,
          rowFactura.estado,
          generador,
          rowFactura.id_agente,
          rowFactura.total,
          rowFactura.subtotal,
          rowFactura.impuestos,
          rowFactura.saldo,
          rowFactura.rfc,
          rowFactura.id_empresa,
          rowFactura.uuid_factura,
          rowFactura.rfc_emisor,
          rowFactura.url_pdf,
          rowFactura.url_xml,
          rowFactura.id_facturama || null,
          origen,
        ]);
        if (!r1?.affectedRows) throw new Error("No se pudo crear la factura");

        // Vincula cada pago/saldo
        for (const { raw_id, monto } of pagos) {
          const fk = getFk(raw_id);
          const insertLinkSQL = `
          INSERT INTO facturas_pagos_y_saldos (${fk}, id_factura, monto)
          VALUES (?, ?, ?)
        `;
          const valorId = fk === "id_pago" ? String(raw_id) : Number(raw_id);
          const [r2] = await connection.query(insertLinkSQL, [
            valorId,
            id_factura,
            monto,
          ]);
          if (!r2?.affectedRows)
            throw new Error("No se pudo vincular un pago/saldo a la factura");
        }

        return res.status(201).json({
          ok: true,
          message: "Factura creada y vinculada con pagos/saldos",
          data: {
            id_factura,
            source,
            total_factura: Number(rowFactura.total),
            total_vinculado: sumPagosCents / 100,
            diferencia: 0,
            facturama:
              source === "facturama"
                ? {
                    Id: facturamaData?.Id,
                    Uuid: rowFactura.uuid_factura,
                    links: { pdf: rowFactura.url_pdf, xml: rowFactura.url_xml },
                  }
                : undefined,
          },
        });
      } catch (error) {
        console.log(error);
        throw error;
      }
    });
  } catch (err) {
    const status = err?.response?.status || err?.statusCode || 500;
    const payload = err?.response?.data ||
      err?.details || { message: err?.message || "Error" };
    return res.status(status).json({
      ok: false,
      message:
        payload.Message ||
        payload.message ||
        "Error al crear la factura con pagos",
      detail: payload,
    });
  }
};

// controllers/conexionFull.controller.js
const getFullDetalles = async (req, res) => {
  try {
    console.log(
      "📦 recibido getFullDetalles (normalizando id_buscar a JSON array)"
    );

    const rawAgente = req.query.id_agente ?? req.body?.id_agente ?? "";
    const rawBuscar = req.query.id_buscar ?? req.body?.id_buscar ?? "";

    const id_agente = String(rawAgente).trim();

    // --- Normalizar id_buscar a JSON array de strings ---
    const toJsonArrayString = (input) => {
      // Si ya viene como array (e.g., body JSON)
      if (Array.isArray(input)) {
        const arr = input
          .map((v) => (v == null ? "" : String(v).trim()))
          .filter(Boolean);
        return JSON.stringify(arr);
      }

      // Si viene como string
      const s = String(input).trim();
      if (!s) return "[]";

      // ¿Es un string que ya representa JSON?
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          const arr = parsed
            .map((v) => (v == null ? "" : String(v).trim()))
            .filter(Boolean);
          return JSON.stringify(arr);
        }
        // Si es escalar JSON (número o string), lo envolvemos en array
        return JSON.stringify([String(parsed)]);
      } catch {
        // No es JSON: soportar CSV o escalar simple
        if (s.includes(",")) {
          const arr = s
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          return JSON.stringify(arr);
        }
        return JSON.stringify([s]); // escalar -> array con 1
      }
    };

    const id_buscar_json = toJsonArrayString(rawBuscar);
    const ids = JSON.parse(id_buscar_json); // arreglo de strings

    if (!id_agente || ids.length === 0) {
      return res.status(400).json({
        message: "Faltan parámetros",
        required: ["id_agente", "id_buscar (≥1 id)"],
      });
    }
 
    // Detectar tipo por prefijo usando el primer id
    const first = ids[0].toLowerCase();
    let tipo = "pago";
    if (first.startsWith("hos")) tipo = "reserva";
    else if (first.startsWith("fac")) tipo = "factura";

    // Llamada al SP: SIEMPRE JSON (array)
    const sets = await executeSP2(
      "sp_get_conexion_full",
      [id_agente, tipo, id_buscar_json], // <— JSON array
      { allSets: true }
    );

    // Normalizar juegos de resultados
    const safe = (i) => (Array.isArray(sets?.[i]) ? sets[i] : []);

    // Mapeo según contrato
    // - origen = 'reserva'  -> [facturas, pagos]
    // - origen = 'pago'     -> [facturas, reservas]
    // - origen = 'factura'  -> [pagos, reservas]
    let payload = {};
    if (tipo === "reserva") {
      payload = { facturas: safe(0), pagos: safe(1) };
    } else if (tipo === "pago") {
      payload = { facturas: safe(0), reservas: safe(1) };
    } else {
      payload = { pagos: safe(0), reservas: safe(1) };
    }

    return res.status(200).json({
      message: "Consulta exitosa",
      tipo_origen: tipo,
      id_origen: ids, // devolvemos los IDs ya normalizados
      id_agente,
      ...payload,
    });
  } catch (error) {
    console.error("getFullDetalles error:", error);
    return res
      .status(500)
      .json({ message: "Error en el servidor", details: error });
  }
};

module.exports = { getFullDetalles };

const getDetallesConexionesFactura = async (req, res) => {
  const { id_factura, id_agente } = req.query;
  try {
    const [pagos = [], reservas = []] = await executeSP2(
      "sp_get_detalles_conexion_fcaturas",
      [id_agente, id_factura],
      { allSets: true }
    );
    res.status(200).json({
      message: "Consulta exitosa",
      pagos: pagos,
      reservas: reservas,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error en el servidor", details: error });
  }
};

const asignarURLS_factura = async (req, res) => {
  const { id_factura, url_pdf, url_xml } = req.query;
  try {
    const response = await executeSP("sp_asignar_urls_a_facturas", [
      id_factura,
      url_pdf,
      url_xml,
    ]);
    if (!response) {
      throw new ShortError("No se pudo actualizar las URLs de la factura", 500);
    }
    res.status(200).json({
      message: "URLs asignadas correctamente a la factura",
      data: response,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error al asignar URLs a la factura",
      details: error.message || error,
      otherDetails: error.response?.data || null,
    });
  }
};

module.exports = {
  create,
  getFullDetalles,
  get_agente_facturas,
  deleteFacturas,
  readAllFacturas,
  createCombinada,
  readConsultas,
  readAllConsultas,
  readDetailsFactura,
  isFacturada,
  crearFacturaDesdeCarga,
  asignarFacturaItems,
  filtrarFacturas,
  createEmi,
  crearFacturaDesdeCargaPagos,
  crearFacturaMultiplesPagos,
  getDetallesConexionesFactura,
  asignarURLS_factura,
  getfacturasPagoPendiente,
  asignarFacturaPagos,
};

//ya quedo "#$%&/()="
