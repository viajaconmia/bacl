const {
  executeQuery,
  executeTransaction,
  runTransaction,
  executeSP2,
} = require("../../../config/db");
const { CustomError } = require("../../../middleware/errorHandler");
const { crearCfdi } = require("./facturamaModel");
const { v4: uuidv4 } = require("uuid");
const {
  buildAddendaXmlFromJson,
} = require("../../Facturama/Facturama/addenda");

const isFacturada = async (id) => {
  try {
    const query = `SELECT COUNT(*) AS facturadas FROM items where id_factura is not null and id_hospedaje = ?;`;
    const response = await executeQuery(query, [id]);
    return response[0].facturadas > 0;
  } catch (error) {
    throw error;
  }
};

const createFactura = async ({ cfdi, info_user, datos_empresa }, req) => {
  try {
    const { id_solicitud, id_user } = info_user;

    const reduce = cfdi.Items.reduce(
      (acc, item) => {
        // Sumar el total
        acc.total += parseFloat(item.Total);

        // Sumar el subtotal (sin impuestos)
        acc.subtotal += parseFloat(item.Subtotal);

        // Sumar los impuestos de cada item
        item.Taxes.forEach((tax) => {
          acc.impuestos += parseFloat(tax.Total);
        });

        return acc;
      },
      { total: 0, subtotal: 0, impuestos: 0 },
    );

    const response = await runTransaction(async (connection) => {
      let response_factura;
      try {
        console.log(cfdi);
        response_factura = await crearCfdi(req, cfdi);

        const { addenda_json, addenda_type } = info_user || {};
        const cfdiId = response_factura?.data?.Id;

        if (cfdiId && addenda_json) {
          const addendaXml = buildAddendaXmlFromJson(
            addenda_json,
            "NoktosAddenda",
          );

          // Esto es lo que el endpoint de Facturama espera según el modelo: CfdiId + AddendaXML :contentReference[oaicite:2]{index=2}
          const addendaBody = {
            CfdiId: cfdiId,
            AddendaXML: addendaXml,
            // opcional: Addenda: addendaXml,
          };

          try {
            const addendaResp = await facturama.Addendas.Create(
              req,
              addenda_type || "Noktos",
              addendaBody,
            );
            console.log("✅ Addenda attach result:", addendaResp?.data);
          } catch (e) {
            // MUY recomendado: NO tumbar la factura si falla el addenda (a menos que negocio lo exija)
            console.error(
              "⚠️ No se pudo adjuntar addenda:",
              e?.response?.data || e?.message || e,
            );
          }
        }
      } catch (error) {
        console.error(
          "Error al crear CFDI:",
          error.response.data,
          error.response,
        );
        throw new CustomError(
          error.response.data.Message || "Error al crear la factura",
          500,
          "FACTURA_ERROR",
          { data: error.response.data.ModelState },
        );
      }
      try {
        const id_factura = `fac-${uuidv4()}`;

        const { total, subtotal, impuestos } = reduce;

        const query = `
    INSERT INTO facturas ( id_factura, fecha_emision, estado, usuario_creador, total, subtotal, impuestos, id_facturama, rfc, id_empresa,uuid_factura )
    VALUES (?,?,?,?,?,?,?,?,?,?,?);`;

        console.log("response_factura", response_factura);

        const params = [
          id_factura,
          new Date(),
          "Confirmada",
          id_user,
          total,
          subtotal,
          impuestos,
          response_factura.data.Id,
          datos_empresa.rfc,
          datos_empresa.id_empresa,
          response_factura.data.Complement.TaxStamp.Uuid,
        ];
        const result_creates = await connection.execute(query, params);

        const [rows] = await connection.execute(
          `SELECT * FROM vw_reservas_client WHERE id_solicitud = ?;`,
          [id_solicitud],
        );

        const [reserva] = rows;
        console.log(reserva);
        const query2 = `
        UPDATE items
        SET id_factura = ?,
            is_facturado = 1
        WHERE id_hospedaje = ? OR id_viaje_aereo = ? OR id_renta_carro = ?;`;
        const params2 = [id_factura, reserva.id_hospedaje];

        const result = await connection.execute(query2, params2);

        const query3 = `
        INSERT INTO facturas_pagos_y_saldos (id_factura, monto, id_pago)
          SELECT ?, ?, p.id_pago
            FROM solicitudes s
              JOIN servicios se ON s.id_servicio = se.id_servicio
              JOIN pagos p ON se.id_servicio = p.id_servicio
            WHERE s.id_solicitud = ?;`;
        const params3 = [id_factura, total, id_solicitud];
        const result2 = await connection.execute(query3, params3);

        const update_hospedaje = `UPDATE hospedajes h
        JOIN bookings b ON h.id_booking = b.id_booking
        SET h.is_facturado = 1
        WHERE b.id_solicitud = ?;`;
        await connection.execute(update_hospedaje, [id_solicitud]);

        return response_factura.data;
      } catch (error) {
        throw {
          data: error,
        };
      }
    });
    console.log(" ⬅️⬅️⬅️⬅️⬅️ response", response);
    return response;
  } catch (error) {
    throw error;
  }
};

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function sumTaxesByRate(items, rateTarget) {
  const EPS = 1e-6;
  let s = 0;
  for (const it of items || []) {
    for (const tx of it?.Taxes || []) {
      const rate = num(tx?.Rate);
      const isRetention = String(tx?.IsRetention) === "true";
      const name = String(tx?.Name || "").toUpperCase();
      if (!isRetention && name === "IVA" && Math.abs(rate - rateTarget) < EPS) {
        s += num(tx?.Total);
      }
    }
  }
  return s;
}

function pickFirst(obj, keys) {
  for (const k of keys) {
    if (obj?.[k]) return obj[k];
  }
  return null;
}


const createFacturaCombinada = async (req, { cfdi, info_user }) => {
  req.context.logStep(
    "LLgando al model de crear factura combinada con los datos:",
    JSON.stringify({ cfdi, info_user }),
  );
  try {
    const { id_solicitud, id_user, id_items, datos_empresa, items_facturados } =
      info_user;
    const solicitudesArray = Array.isArray(id_solicitud)
      ? id_solicitud
      : [id_solicitud];
    const itemsArray = Array.isArray(items_facturados)
      ? items_facturados
      : [items_facturados];

    // 0. Calcular totales
    const { total, subtotal, impuestos } = cfdi.Items.reduce(
      (acc, item) => {
        acc.total += parseFloat(item.Total);
        acc.subtotal += parseFloat(item.Subtotal);
        item.Taxes.forEach((tax) => (acc.impuestos += parseFloat(tax.Total)));
        return acc;
      },
      { total: 0, subtotal: 0, impuestos: 0 },
    );

    // Ejecutamos todo dentro de una transacción
    const result = await runTransaction(async (conn) => {
      try {
        // 1. Crear factura en Facturama
        const response_factura = await crearCfdi(req, cfdi); // 1. Crear factura en Facturama

        // ✅ Adjuntar addenda si viene
        const cfdiId = response_factura?.data?.Id;
        const addendaJson = info_user?.addenda_json; // <- lo mandas desde front
        const addendaType = info_user?.addenda_type || "Noktos";

        if (cfdiId && addendaJson) {
          const addendaXml = buildAddendaXmlFromJson(
            addendaJson,
            "NoktosAddenda",
          );

          const addendaBody = {
            CfdiId: cfdiId,
            AddendaXML: addendaXml,
          };

          try {
            const addendaResp = await facturama.Addenda.Create(
              req,
              addendaType,
              addendaBody,
            );
            console.log("✅ Addenda attach:", addendaResp?.data);
          } catch (e) {
            // Recomiendo NO tirar la factura si falla la addenda
            console.error(
              "⚠️ Falló addenda:",
              e?.response?.data || e?.message || e,
            );
          }
        }

        // 2. Generar ID local de factura
        const id_factura = `fac-${uuidv4()}`;
        console.log("responses", info_user);

        const receiver = cfdi?.Receiver || {};
const items = cfdi?.Items || [];

const total = items.reduce((a, it) => a + num(it?.Total), 0);
const subtotal = items.reduce((a, it) => a + num(it?.Subtotal), 0);
const impuestos = items.reduce((a, it) => {
  const t = (it?.Taxes || []).reduce((b, tx) => b + num(tx?.Total), 0);
  return a + t;
}, 0);

const iva16 = sumTaxesByRate(items, 0.16);
const iva8  = sumTaxesByRate(items, 0.08);


const taxStamp = response_factura?.data?.Complement?.TaxStamp || {};

// Facturama suele traer algo tipo Timestamp/Date/etc (depende del SDK/versión)
const fechaTimbradoRaw = pickFirst(taxStamp, [
  "Timestamp",
  "Date",
  "FechaTimbrado",
  "DateTime",
  "CreatedAt",
]);

const cfdiVersion = pickFirst(response_factura?.data, ["CfdiVersion", "Version", "CFDIversion"]);

const estadoSat = pickFirst(response_factura?.data, ["Status", "EstadoSat", "SatStatus"]);

const issuer = response_factura?.data?.Issuer || response_factura?.data?.Emisor || response_factura?.data?.Emitter || {};

const fechaEmision = cfdi?.Date ? new Date(cfdi.Date) : new Date();
const fechaTimbrado = fechaTimbradoRaw ? new Date(fechaTimbradoRaw) : null;

// 👇 Guarda conceptos + observations en un solo longtext JSON
const conceptosJson = JSON.stringify({
  observations: cfdi?.Observations ?? null,
  items: cfdi?.Items ?? [],
});

const insertFacturaQuery = `
  INSERT INTO facturas (
    id_factura,
    fecha_emision,
    fecha_timbrado,
    serie,
    folio,
    estado,
    estado_sat,
    cfdi_version,
    cfdi_tipo,
    usuario_creador,
    total,
    subtotal,
    iva_16,
    iva_8,
    impuestos,
    regimen_fiscal_receptor,
    domicilio_fiscal_receptor,
    id_facturama,
    rfc,
    id_empresa,
    uuid_factura,
    rfc_emisor,
    nombre_emisor,
    lugar_expedicion,
    rfc_receptor,
    nombre_receptor,
    uso_cfdi,
    moneda,
    forma_pago,
    metodo_pago,
    condicion_pago,
    conceptos,
    saldo,
    id_agente,
    fecha_vencimiento
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);
`;

await conn.execute(insertFacturaQuery, [
  id_factura,                     // id_factura
  fechaEmision,                   // fecha_emision (DATE)
  fechaTimbrado,                  // fecha_timbrado (DATETIME)
  cfdi?.Serie ?? null,            // serie
  cfdi?.Folio != null ? String(cfdi.Folio) : null, // folio
  "Confirmada",                   // estado
  estadoSat ?? null,              // estado_sat
  cfdiVersion ?? null,            // cfdi_version
  cfdi?.CfdiType ?? null,         // cfdi_tipo
  id_user,                        // usuario_creador
  total,                          // total
  subtotal,                       // subtotal
  iva16 || null,                  // iva_16
  iva8 || null,                   // iva_8
  impuestos,                      // impuestos
  receiver?.FiscalRegime ?? null, // regimen_fiscal_receptor
  receiver?.TaxZipCode ?? null,   // domicilio_fiscal_receptor
  response_factura?.data?.Id ?? null, // id_facturama
  datos_empresa?.rfc ?? receiver?.Rfc ?? null, // rfc (tu columna legacy)
  datos_empresa?.id_empresa ?? null, // id_empresa
  taxStamp?.Uuid ?? response_factura?.data?.Complement?.TaxStamp?.Uuid, // uuid_factura (NOT NULL)
  issuer?.Rfc ?? null,            // rfc_emisor
  issuer?.Name ?? null,           // nombre_emisor
  cfdi?.ExpeditionPlace ?? null,  // lugar_expedicion
  receiver?.Rfc ?? null,          // rfc_receptor
  receiver?.Name ? String(receiver.Name).trim() : null, // nombre_receptor
  receiver?.CfdiUse ?? null,      // uso_cfdi
  cfdi?.Currency ?? null,         // moneda
  cfdi?.PaymentForm ?? null,      // forma_pago
  cfdi?.PaymentMethod ?? null,    // metodo_pago
  null,                           // condicion_pago (no viene en tu objeto)
  conceptosJson,                  // conceptos (longtext)
  total,                          // saldo
  id_user,                        // id_agente
  info_user?.fecha_vencimiento ?? null, // fecha_vencimiento
]);


        // 4. Actualizar solo los items seleccionados
        // const updateItemsSql = `
        // UPDATE items
        // SET id_factura = ?,
        // is_facturado = 1
        // WHERE id_item IN (${itemsArray.map(() => "?").join(",")})
        // `;
        // const resultados_items = await conn.execute(updateItemsSql, [
        //   id_factura,
        //   ...itemsArray,
        // ]);
        // 4 NUEVO: Insertar en items factura
        const numberOfItems = itemsArray.length;
        console.log("ITEMSSS", itemsArray);
        const insertItemsFacturasQuery = `
        insert into items_facturas (id_factura,id_relacion,id_item,monto) values(?,?,?,?);`;
        for (let i = 0; i < numberOfItems; i++) {
          console.log(
            "😎😎😎😎😎😎😎😎😎😎😎😎😎🤬🤬🤬🤬🤬🤬🤬🤬🤬🤬🤬",
            itemsArray[i].id_relacion,
            itemsArray[i].id_item,
            total / numberOfItems,
          );
          await conn.execute(insertItemsFacturasQuery, [
            id_factura,
            itemsArray[i].id_relacion,
            itemsArray[i].id_item,
            total / numberOfItems,
          ]);
        }

        // 5. Insertar registros en facturas_pagos
        /* const resultados_pagos = await conn.execute( LO COMENTO POR SI ACASO
          `
        INSERT INTO facturas_pagos (
          id_factura, 
          monto_pago, 
          id_pago
          )
          SELECT 
          ? AS id_factura,
          ? AS monto_pago,
          p.id_pago
          FROM 
          solicitudes s
          JOIN servicios se ON s.id_servicio = se.id_servicio
          JOIN pagos p ON se.id_servicio = p.id_servicio
          WHERE 
          s.id_solicitud IN (${solicitudesArray.map(() => "?").join(",")})
          AND p.id_pago IS NOT NULL
          `,
          [id_factura, total, ...solicitudesArray]
        );
        console.log("resultado pagos", resultados_pagos);*/
        const insertPagosSql = `
  INSERT INTO facturas_pagos_y_saldos (
    id_factura,
    id_pago,
    monto
  )
  SELECT 
    ?            AS id_factura,
    p.id_pago    AS id_pago,
    p.total     AS monto
  FROM solicitudes s
  JOIN servicios se ON s.id_servicio = se.id_servicio
  JOIN pagos p     ON se.id_servicio = p.id_servicio
  WHERE s.id_solicitud IN (${solicitudesArray.map(() => "?").join(",")})
    AND p.id_pago IS NOT NULL
`;
        const resultados_pagos = await conn.execute(insertPagosSql, [
          id_factura,
          ...solicitudesArray,
        ]);
        console.log("resultado pagos", resultados_pagos);

        return {
          id_factura,
          ...response_factura,
        };
      } catch (error) {
        console.log(error.response);
        console.log(error);
        throw error;
      }
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    throw error;
  }
};

//--helpers
function calcularTotalesDesdeItems(items = []) {
  return items.reduce(
    (acc, item) => {
      acc.total += Number(item?.Total ?? 0);
      acc.subtotal += Number(item?.Subtotal ?? 0);
      if (Array.isArray(item?.Taxes)) {
        for (const tax of item.Taxes) acc.impuestos += Number(tax?.Total ?? 0);
      }
      return acc;
    },
    { total: 0, subtotal: 0, impuestos: 0 },
  );
}

// Deja el CFDI listo para Facturama v3 (sin metadatos, con tipos correctos)
// Reemplaza tu sanitizeCfdi por esta versión
function sanitizeCfdi(cfdiRaw = {}) {
  const cfdi = { ...cfdiRaw };

  // --- Tipo de CFDI que Facturama v3 está pidiendo explícitamente ---
  // Si te llega CfdiType o Type, unifícalos en CfdiType
  if (cfdi.Type && !cfdi.CfdiType) cfdi.CfdiType = cfdi.Type;
  if (!cfdi.CfdiType) cfdi.CfdiType = "I"; // default Ingreso
  delete cfdi.Type; // opcional pero recomendado si el endpoint solo reconoce CfdiType

  // Requeridos mínimos
  if (!cfdi.Exportation) cfdi.Exportation = "01"; // no aplica
  if (!cfdi.ExpeditionPlace) throw new Error("ExpeditionPlace requerido");
  if (cfdi.CfdiType === "I") {
    if (!cfdi.PaymentForm)
      throw new Error("PaymentForm requerido para CfdiType=I");
    if (!cfdi.PaymentMethod)
      throw new Error("PaymentMethod requerido para CfdiType=I");
  }

  // Helper para 2 decimales
  const to2 = (n) => Number(Number(n ?? 0).toFixed(2));

  // Asegurar tipos en Items (números/booleanos) y claves válidas
  cfdi.Items = (cfdi.Items || []).map((it) => {
    const item = { ...it };

    // ClaveProdServ numérica de 8 dígitos
    const prod = String(item.ProductCode || "");
    if (!/^\d{8}$/.test(prod)) item.ProductCode = "81112100";

    item.Quantity = Number(item.Quantity ?? 1);
    item.UnitPrice = to2(item.UnitPrice);
    item.Subtotal = to2(item.Subtotal);
    item.Total = to2(item.Total);

    if (Array.isArray(item.Taxes)) {
      item.Taxes = item.Taxes.map((t) => ({
        ...t,
        Rate: Number(t.Rate),
        Base: to2(t.Base),
        Total: to2(t.Total),
        IsRetention: t.IsRetention === true, // default false si no viene
        IsFederalTax: t.IsFederalTax !== false, // default true
      }));
    }

    return item;
  });

  // Quitar metadatos ajenos al esquema Facturama
  delete cfdi.info_user;
  delete cfdi.datos_empresa;
  delete cfdi.OrderNumber;
  delete cfdi.NameId;
  // delete cfdi.Observations; // quítalo si tu cuenta no lo soporta

  return cfdi;
}

// const crearFacturaEmi = async (req, { cfdi }) => {
//   const {info_user} = cfdi
//   req.context.logStep(
//     "LLgando al model de crear factura combinada con los datos:",
//     JSON.stringify({ cfdi, info_user }),
//   );
//   console.log("datos",cfdi,info_user)
//   try {
//     const { id_user, datos_empresa } = info_user;

//     // 0. Calcular totales
//     // const { total, subtotal, impuestos } = cfdi.Items.reduce(
//     //   (acc, item) => {
//     //     acc.total += parseFloat(item.Total);
//     //     acc.subtotal += parseFloat(item.Subtotal);
//     //     item.Taxes.forEach((tax) => (acc.impuestos += parseFloat(tax.Total)));
//     //     return acc;
//     //   },
//     //   { total: 0, subtotal: 0, impuestos: 0 }
//     // );

//     // Ejecutamos todo dentro de una transacción
//     const result = await runTransaction(async (conn) => {
//       try {
//         // 1. Crear factura en Facturama
//         const response_factura = await crearCfdi(req, cfdi);

//         // 2. Generar ID local de factura
//         const id_factura = `fac-${uuidv4()}`;

//         // 3. Insertar factura principal
//         const insertFacturaQuery = `
//         INSERT INTO facturas (
//           id_factura,
//           fecha_emision,
//           estado,
//           usuario_creador,
//           total,
//           subtotal,
//           impuestos,
//           id_facturama,
//           rfc,
//           id_empresa,
//           uuid_factura
//           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?,?,?,?);
//           `;
//         console.log(datos_empresa);
//         const results = await conn.execute(insertFacturaQuery, [
//           id_factura,
//           new Date(),
//           "Confirmada",
//           id_user,
//           total,
//           subtotal,
//           impuestos,
//           response_factura.data.Id,
//           datos_empresa.rfc,
//           datos_empresa.id_empresa,
//           response_factura.data.Complement.TaxStamp.Uuid,
//         ]);

//         // 4. Actualizar solo los items seleccionados
//         // const updateItemsSql = `
//         // UPDATE items
//         // SET id_factura = ?
//         // WHERE id_item IN (${itemsArray.map(() => "?").join(",")})
//         // `;
//         // const resultados_items = await conn.execute(updateItemsSql, [
//         //   id_factura,
//         //   ...itemsArray,
//         // ]);

//         // 5. Insertar registros en facturas_pagos
//         const resultados_pagos = await conn.execute(
//           `
//         INSERT INTO facturas_pagos (
//           id_factura,
//           monto_pago,
//           id_pago
//           )
//           SELECT
//           ? AS id_factura,
//           ? AS monto_pago,
//           p.id_pago
//           FROM
//           solicitudes s
//           JOIN servicios se ON s.id_servicio = se.id_servicio
//           JOIN pagos p ON se.id_servicio = p.id_servicio
//           WHERE
//           s.id_solicitud IN (${solicitudesArray.map(() => "?").join(",")})
//           AND p.id_pago IS NOT NULL
//           `,
//           [id_factura, total, ...solicitudesArray]
//         );
//         console.log("resultado pagos", resultados_pagos);

//         return {
//           id_factura,
//           ...response_factura,
//         };
//       } catch (error) {
//         throw error;
//       }
//     });

//     return {
//       success: true,
//       data: result,
//     };
//   } catch (error) {
//     throw error;
//   }
// };

const crearFacturaEmi = async (req, payload) => {
  let { cfdi, info_user, datos_empresa, solicitudesArray = [] } = payload || {};

  // Compat: si info_user / datos_empresa venían dentro del CFDI, extraerlos
  if (cfdi?.info_user && !info_user) {
    info_user = cfdi.info_user;
    delete cfdi.info_user;
  }
  if (cfdi?.datos_empresa && !datos_empresa) {
    datos_empresa = cfdi.datos_empresa;
    delete cfdi.datos_empresa;
  }

  // Compat: si viene doblemente anidado, aplanar
  if (cfdi && cfdi.cfdi) cfdi = cfdi.cfdi;

  req.context?.logStep?.(
    "LLgando al model de crear factura combinada con los datos:",
    JSON.stringify({ cfdi: { ...cfdi, Items: undefined }, info_user }),
  );

  try {
    // Validaciones mínimas de contexto
    const { id_user } = info_user || {};
    if (!id_user) throw new Error("id_user requerido");
    if (!datos_empresa?.rfc || !datos_empresa?.id_empresa) {
      throw new Error(
        "datos_empresa.rfc y datos_empresa.id_empresa son requeridos",
      );
    }

    // Totales para tu BD
    const totales = (cfdi.Items || []).reduce(
      (acc, item) => {
        acc.total += Number(item?.Total ?? 0);
        acc.subtotal += Number(item?.Subtotal ?? 0);
        if (Array.isArray(item?.Taxes)) {
          for (const t of item.Taxes) acc.impuestos += Number(t?.Total ?? 0);
        }
        return acc;
      },
      { total: 0, subtotal: 0, impuestos: 0 },
    );
    const { total, subtotal, impuestos } = totales;

    // ---- Defaults rápidos ANTES de sanear (opcional, puedes moverlos a tu sanitize) ----
    // ExpeditionPlace (CP del emisor): intenta datos_empresa.expedition_cp, luego datos_empresa.cp,
    // y como último recurso Receiver.TaxZipCode (solo sandbox).
    if (!cfdi.ExpeditionPlace || String(cfdi.ExpeditionPlace).trim() === "") {
      const emisorCP =
        datos_empresa?.expedition_cp ||
        datos_empresa?.cp ||
        cfdi?.Receiver?.TaxZipCode;
      if (!emisorCP) {
        throw new Error(
          "ExpeditionPlace requerido: faltan CP del emisor (datos_empresa.expedition_cp o .cp).",
        );
      }
      cfdi.ExpeditionPlace = String(emisorCP);
    }
    if (!cfdi.CfdiType && cfdi.Type) cfdi.CfdiType = cfdi.Type;
    if (!cfdi.CfdiType) cfdi.CfdiType = "I";
    if (!cfdi.Exportation) cfdi.Exportation = "01";
    if (cfdi.CfdiType === "I") {
      if (!cfdi.PaymentForm) cfdi.PaymentForm = "03"; // ajusta a tu operación real
      if (!cfdi.PaymentMethod) cfdi.PaymentMethod = "PUE";
    }
    // -------------------------------------------------------------------------------

    // 🔧 Aquí usas TU versión de sanitizeCfdi (debes tenerla definida en este módulo o importarla)
    const body = sanitizeCfdi(cfdi);

    // 👀 Imprimir el BODY que se enviará a Facturama (full, sin truncar)
    // console.log("➡️ BODY a Facturama (POST /3/cfdis):");
    // console.dir(body, { depth: null });

    // Transacción: crear en Facturama y luego guardar local
    const result = await runTransaction(async (conn) => {
      try {
        // 1) Crear CFDI en Facturama
        let response_factura;
        try {
          response_factura = await crearCfdi(req, body);
          // console.log("respuesta de facturama", response_factura);
        } catch (error) {
          const msg = error?.response?.data || error?.message || error;
          console.error("Error al crear CFDI:", msg);
          throw new Error(msg);
        }

        // 2) Insert local
        const id_factura = `fac-${uuidv4()}`;
        const insertFacturaQuery = `
        INSERT INTO facturas (
          id_factura, fecha_emision, estado, usuario_creador,
          total, subtotal, impuestos, id_facturama, rfc, id_empresa, uuid_factura
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;

        // await conn.execute(insertFacturaQuery, [
        //   id_factura,
        //   new Date(),
        //   "Confirmada",
        //   id_user,
        //   total,
        //   subtotal,
        //   impuestos,
        //   response_factura.data.Id,
        //   datos_empresa.rfc,
        //   datos_empresa.id_empresa,
        //   response_factura.data.Complement.TaxStamp.Uuid,
        // ]);

        // 3) (Opcional) relacionar pagos por solicitudes
        /*if (Array.isArray(solicitudesArray) && solicitudesArray.length) {
          const placeholders = solicitudesArray.map(() => "?").join(",");
          const sql = `
          INSERT INTO facturas_pagos (id_factura, monto_pago, id_pago)
          SELECT ?, ?,
                 p.id_pago
          FROM solicitudes s
          JOIN servicios se ON s.id_servicio = se.id_servicio
          JOIN pagos p ON se.id_servicio = p.id_servicio
          WHERE s.id_solicitud IN (${placeholders})
            AND p.id_pago IS NOT NULL
        `;
          await conn.execute(sql, [id_factura, total, ...solicitudesArray]);
        } LO COMENTO POR SI ACASO*/

        if (Array.isArray(solicitudesArray) && solicitudesArray.length) {
          const placeholders = solicitudesArray.map(() => "?").join(",");
          const sql = `
    INSERT INTO facturas_pagos_y_saldos (id_factura, id_pago, monto)
    SELECT
      ?          AS id_factura,
      p.id_pago  AS id_pago,
      p.total    AS monto
    FROM solicitudes s
    JOIN servicios se ON s.id_servicio = se.id_servicio
    JOIN pagos p      ON se.id_servicio = p.id_servicio
    WHERE s.id_solicitud IN (${placeholders})
      AND p.id_pago IS NOT NULL
  `;
          await conn.execute(sql, [id_factura, ...solicitudesArray]);
        }

        return {
          id_factura,
          facturama: response_factura.data,
        };
      } catch (error) {
        throw error;
      }
    });

    return { success: true, data: result };
  } catch (error) {
    throw error;
  }
};

module.exports = { crearFacturaEmi };

const getFacturasConsultas = async (user_id) => {
  /*PARECE SER QUE YA NO SE OCUPA*/
  try {
    let query = `
SELECT
  facturas.id_factura,
  facturas.fecha_emision,
  facturas.estado,
  facturas.usuario_creador,
  facturas.total AS total_factura,
  facturas.subtotal AS subtotal_factura,
  facturas.impuestos AS impuestos_factura,
  facturas.saldo,
  facturas.created_at AS fecha_creacion_factura,
  facturas.updated_at,
  facturas.id_facturama,
  facturas.rfc,
  facturas.id_empresa,
  empresas.razon_social,
  
  -- JSON con los pagos relacionados a esta factura
  (
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT(
        'id_pago', p.id_pago,
        'id_servicio', p.id_servicio,
        'monto', p.monto,
        'monto_a_credito', p.monto_a_credito,
        'responsable_pago_empresa', p.responsable_pago_empresa,
        'responsable_pago_agente', p.responsable_pago_agente,
        'fecha_creacion', p.created_at,
        'pago_por_credito', p.pago_por_credito,
        'pendiente_por_cobrar', p.pendiente_por_cobrar,
        'total', p.total,
        'subtotal', p.subtotal,
        'impuestos', p.impuestos,
        'concepto', p.concepto,
        'referencia', p.referencia,
        'fecha_pago', p.fecha_pago,
        'metodo_de_pago', p.metodo_de_pago,
        'currency', p.currency,
        'tipo_de_pago', p.tipo_de_pago,
        'banco', p.banco,
        'last_digits', p.last_digits
      )
    )
    FROM facturas_pagos fp
    JOIN pagos p ON fp.id_pago = p.id_pago
    WHERE fp.id_factura = facturas.id_factura
  ) AS pagos,
  
  -- JSON con las solicitudes relacionadas a través de los pagos
  (
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT(
        'id_solicitud', s.id_solicitud,
        'id_servicio', s.id_servicio,
        'confirmation_code', s.confirmation_code,
        'id_viajero', s.id_viajero,
        'hotel', s.hotel,
        'check_in', s.check_in,
        'check_out', s.check_out,
        'room', s.room,
        'total', s.total,
        'status', s.status,
        'id_usuario_generador', s.id_usuario_generador,
        'nombre_viajero', s.nombre_viajero,
        'solicitud_total', ROUND(s.total, 2),
        'created_at', srv.created_at,
        'nombre_hotel', h.nombre_hotel,
        'codigo_reservacion_hotel', h.codigo_reservacion_hotel,
        'viajero', JSON_OBJECT(
          'id_viajero', v.id_viajero,
          'nombre', v.primer_nombre,
          'apellido_paterno', v.apellido_paterno,
          'apellido_materno', v.apellido_materno,
          'email', v.correo,
          'telefono', v.telefono
        ),
        'is_booking', IF(b.id_solicitud IS NOT NULL, TRUE, FALSE)
      )
    )
    FROM facturas_pagos fp
    JOIN pagos p ON fp.id_pago = p.id_pago
    JOIN servicios srv ON p.id_servicio = srv.id_servicio
    LEFT JOIN solicitudes s ON srv.id_servicio = s.id_servicio
    LEFT JOIN bookings b ON s.id_solicitud = b.id_solicitud
    LEFT JOIN hospedajes h ON b.id_booking = h.id_booking
    LEFT JOIN viajeros v ON s.id_viajero = v.id_viajero
    WHERE fp.id_factura = facturas.id_factura
  ) AS solicitudes

FROM facturas
LEFT JOIN empresas ON facturas.id_empresa = empresas.id_empresa
WHERE facturas.id_factura IN (
  SELECT fp.id_factura
  FROM facturas_pagos fp
  JOIN pagos p ON fp.id_pago = p.id_pago
  JOIN servicios srv ON p.id_servicio = srv.id_servicio
  JOIN solicitudes s ON srv.id_servicio = s.id_servicio
  WHERE facturas.usuario_creador = ?
)
ORDER BY facturas.created_at DESC;`;
    let response = await executeQuery(query, [user_id]);

    return response;
  } catch (error) {
    throw error;
  }
};

const getAllFacturasConsultas = async () => {
  try {
    const query = `select * from facturas f
join agentes a on a.id_agente = f.usuario_creador
order by fecha_emision desc;`;
    let response = await executeQuery(query, []);

    return response;
  } catch (error) {
    throw error;
  }
};

const getAllFacturasPagosPendientes = async () => {
  try {
    const query = `SELECT vf.*
FROM vw_facturas AS vf
JOIN (
  SELECT 
    uuid_factura,
    fecha_emision,
    total,
    subtotal,
    impuestos,
    rfc
  FROM vw_facturas
  GROUP BY
    uuid_factura, fecha_emision, total, subtotal, impuestos, rfc
  HAVING
    SUM(COALESCE(JSON_LENGTH(pagos_asociados), 0)) = 0
) AS g
USING (uuid_factura, fecha_emision, total, subtotal, impuestos, rfc)
-- (Opcional) si además quieres limitar a saldo = 0 o NULL:
-- WHERE vf.saldo = 0 OR vf.saldo IS NULL
ORDER BY vf.uuid_factura, vf.fecha_emision;`;
    let response = await executeQuery(query, []);

    return response;
  } catch (error) {
    throw error;
  }
};

const facturasPagoPendiente = async (id_agente) => {
  try {
    const response = await executeSP2("sp_get_facturas_pendientes_por_agente", [
      id_agente,
    ]);
    return response;
  } catch (error) {
    throw error;
  }
};

const getDetailsFactura = async (id_factura) => {
  try {
    const query = `select count(*) AS noches_facturadas, i.*, h.*, b.total as total_booking, b.subtotal as subtotal_booking, b.impuestos as impuestos_booking from items i 
join hospedajes h on h.id_hospedaje = i.id_hospedaje
join bookings b on b.id_booking = h.id_booking
where i.id_factura = ?
group by h.id_hospedaje;`;
    let response = await executeQuery(query, [id_factura]);

    return response;
  } catch (error) {
    throw error;
  }
};

const getAllFacturas = async () => {
  try {
    const query = `SELECT 
  id_factura,
  is_prepagada,
  id_facturama,
  fecha_emision,
  estado_factura,
  usuario_creador,
  total_factura,
  subtotal_factura,
  impuestos_factura,
  saldo,
  factura_created_at,
  factura_updated_at,
  factura_rfc,
  metodo_de_pago,
  nombre_agente,
  razon_social,
  GROUP_CONCAT(DISTINCT hotel ORDER BY hotel SEPARATOR ', ') AS hoteles
FROM 
  vista_facturas_pagos
GROUP BY 
  id_factura;`;
    const response = await executeQuery(query);
    console.log(response);
    return response;
  } catch (error) {
    throw error;
  }
};
const deleteFacturas = async (id) => {
  try {
    await executeTransaction(
      `delete from items WHERE id_factura = ?`,
      [id],
      async (results, connection) => {
        try {
          await connection.execute(
            `delete from facturas WHERE id_factura = ?;`,
            [id],
          );
        } catch (error) {
          console.log(error);
          throw error;
        }
      },
    );

    return { message: "success" };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createFactura,
  getAllFacturas,
  deleteFacturas,
  createFacturaCombinada,
  getFacturasConsultas,
  getAllFacturasConsultas,
  getAllFacturasPagosPendientes,
  getDetailsFactura,
  isFacturada,
  crearFacturaEmi,
  facturasPagoPendiente,
};
