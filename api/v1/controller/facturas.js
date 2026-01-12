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
    console.log("ERROR MANEJADO");
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

const getfacturasPagoPendienteByAgente = async (req, res) => {
  try {
    const id_agente = req.body.id_agente;
    console.log(id_agente, "campos ");
    let solicitudes = await model.facturasPagoPendiente(id_agente);
    res.status(200).json(solicitudes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
};

const getFacturasDetalles = async (req, res) => {
  try {
    console.log("📦 recibido get_detalles_factura (normalizando a JSON array)");

    // Acepta: ?id_buscar=..., ?id_factura=..., o body { id_buscar / id_factura }
    const rawBuscar =
      req.query.id_factura ??
      req.query.id_buscar ??
      req.query?.id_raw ??
      req.body?.id_factura ??
      req.body?.id_buscar ??
      req.body?.id_raw ??
      "";

    // --- Normalizar a JSON array de strings ---
    const toJsonArrayString = (input) => {
      if (Array.isArray(input)) {
        const arr = input
          .map((v) => (v == null ? "" : String(v).trim()))
          .filter(Boolean);
        return JSON.stringify(arr);
      }

      const s = String(input).trim();
      if (!s) return "[]";

      // ¿Ya es JSON?
      try {
        const parsed = JSON.parse(s);

        // Si ya es array JSON
        if (Array.isArray(parsed)) {
          const arr = parsed
            .map((v) => (v == null ? "" : String(v).trim()))
            .filter(Boolean);
          return JSON.stringify(arr);
        }

        // Si es object JSON: soportar {id_factura: "..."} o {id_facturas:[...]}
        if (parsed && typeof parsed === "object") {
          const arrCandidate = Array.isArray(parsed.id_facturas)
            ? parsed.id_facturas
            : parsed.id_factura != null
            ? [parsed.id_factura]
            : [parsed];

          const arr = arrCandidate
            .map((v) => (v == null ? "" : String(v).trim()))
            .filter(Boolean);

          return JSON.stringify(arr);
        }

        // Si es escalar JSON (número o string)
        return JSON.stringify([String(parsed).trim()].filter(Boolean));
      } catch {
        // No es JSON: soportar CSV o escalar simple
        if (s.includes(",")) {
          const arr = s
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          return JSON.stringify(arr);
        }
        return JSON.stringify([s]);
      }
    };

    const p_payload = toJsonArrayString(rawBuscar);
    const ids = JSON.parse(p_payload);

    if (!ids || ids.length === 0) {
      return res.status(400).json({
        message: "Falta id_factura / id_buscar (≥1 id)",
        required: ["id_factura (o id_buscar)"],
        example: '?id_factura=fac-123 OR ?id_factura=["fac-1","fac-2"]',
      });
    }

    // (Opcional) validar prefijo, si quieres forzar que sean fac-...
    // const invalid = ids.find(x => !String(x).toLowerCase().startsWith("fac"));
    // if (invalid) { ... }

    // --- Llamada al SP ---
    // sp_factura_detalles(IN p_payload LONGTEXT)
    const sets = await executeSP2("sp_factura_detalles", [p_payload], {
      allSets: true,
    });

    const safe = (i) => (Array.isArray(sets?.[i]) ? sets[i] : []);

    // Contrato del SP (como lo dejamos):
    // 0: pagos.*
    // 1: saldos_a_favor.*
    // 2: reservas (vw_reservas_client...)
    const pagos = safe(0);
    const saldos = safe(1);
    const reservas = safe(2);

    if (pagos.length === 0 && saldos.length === 0 && reservas.length === 0) {
      return res.status(404).json({
        message: "No se encontraron detalles para la(s) factura(s) indicada(s)",
        error: "NOT_FOUND",
        data: { ids, pagos: [], saldos: [], reservas: [] },
      });
    }

    return res.status(200).json({
      message: "Consulta exitosa",
      data:{
        tipo_origen: "factura",
      id_origen: ids,
      pagos,
      saldos,
      reservas,
      }
    });
  } catch (error) {
    console.error("get_detalles_factura error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Error en el servidor",
      error: error.code || error.name || "ERROR_BACK",
      data: null,
    });
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
const updateDocumentosFacturas = async (req, res) => {
  try {
    const { url, id } = req.body;
    await executeQuery(`UPDATE facturas SET url_pdf = ? WHERE id_factura = ?`, [
      url,
      id,
    ]);
    res.status(200).json({ message: "Actualizado correctamente", data: "" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Internal Server Error",
      data: error,
      message: error.message || "Error",
    });
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
    fecha_vencimiento,
  } = req.body;
  const id_factura = "fac-" + uuidv4();

  console.log(items, "estos son los items 👌👌👌👌👌👌👌👌");

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
      fecha_vencimiento,
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

const asignarFacturaPagos2 = async (req, res) => {
  const newId = (pfx) =>
    `${pfx}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;

  // Debug helpers
  const ts = () => new Date().toISOString();
  const step = (n, msg, obj) => {
    console.log(`\n🟦 [${ts()}] STEP ${n} - ${msg}`);
    if (obj !== undefined) {
      try {
        console.log(JSON.stringify(obj, null, 2));
      } catch (e) {
        console.log(obj);
      }
    }
    console.log("------------------------------------------------------------");
  };

  const logQuery = (label, sql, params, result) => {
    console.log(`\n🟨 [${ts()}] [SQL] ${label}`);
    console.log(`Query:\n${sql}`);
    console.log("Params:", params);
    if (result !== undefined) {
      console.log("Result:", result);
    }
    console.log("------------------------------------------------------------");
  };

  // util para no spamear gigantes
  const brief = (arr, max = 5) =>
    Array.isArray(arr) ? arr.slice(0, max) : arr;

  try {
    step(0, "REQ.BODY recibido", req.body);

    const {
      id_factura: facturasRaw,
      ejemplo_saldos: saldosRaw,
      id_agente = null,
      metodo_de_pago = "aplicacion_saldo",
      currency = "MXN",
      tipo_de_tarjeta = null,
      link_pago = null,
      last_digits = null,
      referencia = null,
      concepto = "Aplicación a facturas",
    } = req.body || {};

    step(1, "Payload normalizado (campos principales)", {
      facturasRaw,
      saldosRaw_type: typeof saldosRaw,
      id_agente,
      metodo_de_pago,
      currency,
      referencia,
      concepto,
    });

    if (
      !facturasRaw ||
      (Array.isArray(facturasRaw) && facturasRaw.length === 0)
    ) {
      step(1.1, "ERROR: id_factura faltante/vacío");
      return res.status(400).json({
        error: "Debes enviar 'id_factura' con 1+ elementos (array o string).",
      });
    }

    const facturasOrden = Array.isArray(facturasRaw)
      ? facturasRaw
      : [facturasRaw];

    let itemsEntrada = saldosRaw;
    if (!itemsEntrada) {
      step(1.2, "ERROR: ejemplo_saldos faltante");
      return res
        .status(400)
        .json({ error: "Falta 'ejemplo_saldos' en el payload." });
    }

    if (typeof itemsEntrada === "string") {
      step(1.3, "ejemplo_saldos venía como string, intentando JSON.parse...");
      try {
        itemsEntrada = JSON.parse(itemsEntrada);
      } catch (e) {
        step(1.31, "ERROR: ejemplo_saldos string NO es JSON válido", {
          message: e.message,
        });
        return res.status(400).json({
          error: "El campo 'ejemplo_saldos' no es un JSON válido",
          details: e.message,
        });
      }
    }

    if (!Array.isArray(itemsEntrada)) itemsEntrada = [itemsEntrada];

    step(2, "facturasOrden + itemsEntrada (preview)", {
      facturasOrden,
      itemsEntrada_preview: brief(itemsEntrada, 10),
      itemsEntrada_len: itemsEntrada.length,
    });

    // (Opcional) transacción real
    // await executeQuery("START TRANSACTION");
    // step(2.1, "START TRANSACTION");

    // =========================
    // STEP 3: SELECT facturas
    // =========================
    const facturas = [];
    for (const idf of facturasOrden) {
      const queryFactura =
        "SELECT id_factura, saldo FROM facturas WHERE id_factura = ?;";
      const r = await executeQuery(queryFactura, [idf]);
      logQuery("SELECT factura saldo", queryFactura, [idf], r);

      if (!r?.length) {
        step(3.1, "ERROR: Factura no encontrada", { id_factura: idf });
        throw new Error(`Factura no encontrada: ${idf}`);
      }

      const f = { id_factura: r[0].id_factura, saldo: Number(r[0].saldo) || 0 };
      facturas.push(f);
    }
    step(3.2, "Facturas (saldo inicial)", facturas);

    // =========================
    // STEP 4: SELECT vista saldos disponibles
    // =========================
    const rawIds = [...new Set(itemsEntrada.map((it) => String(it.id_saldo)))];
    step(4, "rawIds (unique)", rawIds);

    const placeholdersRaw = rawIds.map(() => "?").join(",");
    let viewRows = [];
    if (rawIds.length) {
      const queryVista = `SELECT raw_id, saldo FROM vw_pagos_prepago_facturables WHERE raw_id IN (${placeholdersRaw});`;
      viewRows = await executeQuery(queryVista, rawIds);
      logQuery("SELECT vista saldos disponibles", queryVista, rawIds, viewRows);
    }
    step(4.1, "viewRows (preview)", brief(viewRows, 20));

    const disponiblePorRawId = new Map();
    for (const row of viewRows || []) {
      const rid = String(row.raw_id);
      const disp = Number(row.saldo);
      if (Number.isFinite(disp)) disponiblePorRawId.set(rid, Math.max(0, disp));
    }
    step(
      4.2,
      "disponiblePorRawId (as array)",
      Array.from(disponiblePorRawId.entries())
    );

    // =========================
    // STEP 5: Construir créditos
    // =========================
    const creditos = itemsEntrada
      .map((it) => {
        const raw = String(it.id_saldo);
        const disponible = disponiblePorRawId.has(raw)
          ? Number(disponiblePorRawId.get(raw))
          : 0;
        const isSaldoFavor = /^\d+$/.test(raw);
        return { raw_id: raw, disponible, restante: disponible, isSaldoFavor };
      })
      .filter((c) => c.disponible > 0);

    step(5, "creditos (con disponible>0)", creditos);

    if (creditos.length === 0) {
      step(5.1, "ERROR: creditos vacío (no hay saldo disponible según vista)");
      throw new Error("No hay saldo disponible para aplicar (según la vista).");
    }

    // =========================
    // STEP 6: SELECT items_facturas
    // =========================
    const placeholdersFact = facturasOrden.map(() => "?").join(",");
    const queryItems = `
      SELECT id_item, id_factura, monto, id_relacion as id_hospedaje
      FROM items_facturas
      WHERE id_factura IN (${placeholdersFact})
      ORDER BY id_factura ASC, id_item ASC;
    `;
    const itemsDeFacturas = await executeQuery(queryItems, facturasOrden);
    logQuery(
      "SELECT items_facturas por facturas",
      queryItems,
      facturasOrden,
      itemsDeFacturas
    );
    step(6.1, "itemsDeFacturas (preview)", brief(itemsDeFacturas, 20));

    // ⚠️ DEBUG CRÍTICO: aquí estaba el bug (it.saldo no existe)
    // Voy a imprimir qué llaves trae cada item
    if (itemsDeFacturas?.length) {
      step(
        6.2,
        "Keys del primer item_factura",
        Object.keys(itemsDeFacturas[0])
      );
      step(6.3, "Primer item_factura completo", itemsDeFacturas[0]);
    }

    const itemPendiente = (itemsDeFacturas || []).map((it) => ({
      id_item: it.id_item,
      id_factura: it.id_factura,

      // ⚠️ AQUÍ EL DEBUG:
      // Si en tu SELECT viene "monto", entonces it.saldo = undefined -> pendiente=0
      pendiente_from_saldo: it.saldo,
      pendiente_from_monto: it.monto,

      // La que realmente usa el código actual:
      pendiente: Number(it.saldo) || 0,

      id_hospedaje: it.id_hospedaje ?? null,
    }));

    step(6.4, "itemPendiente (preview + fuentes)", brief(itemPendiente, 30));

    // Guardas para detectar el bug al vuelo
    const sumPendiente = itemPendiente.reduce(
      (a, x) => a + (Number(x.pendiente) || 0),
      0
    );
    const sumMonto = itemPendiente.reduce(
      (a, x) => a + (Number(x.pendiente_from_monto) || 0),
      0
    );
    step(6.5, "SUMAS: pendiente(usado) vs monto(de DB)", {
      sumPendiente,
      sumMonto,
    });

    // =========================
    // STEP 7: Map hospedaje -> servicio
    // =========================
    const hospedajesPorFactura = new Map();
    const setHospedajes = new Set();

    for (const it of itemPendiente) {
      if (!it.id_hospedaje) continue;
      setHospedajes.add(String(it.id_hospedaje));
      if (!hospedajesPorFactura.has(it.id_factura))
        hospedajesPorFactura.set(it.id_factura, new Set());
      hospedajesPorFactura.get(it.id_factura).add(String(it.id_hospedaje));
    }

    step(7, "Hospedajes encontrados", {
      hospedajes_unicos: Array.from(setHospedajes),
      por_factura: Array.from(hospedajesPorFactura.entries()).map(
        ([f, set]) => ({
          id_factura: f,
          hospedajes: Array.from(set),
        })
      ),
    });

    const hospedajesUnicos = Array.from(setHospedajes);
    const mapHospToServ = new Map();
    if (hospedajesUnicos.length) {
      const phHosp = hospedajesUnicos.map(() => "?").join(",");
      const queryVistaReservas = `
        SELECT id_hospedaje, id_servicio
        FROM vw_reservas_client
        WHERE id_hospedaje IN (${phHosp});
      `;
      const rowsVista = await executeQuery(
        queryVistaReservas,
        hospedajesUnicos
      );
      logQuery(
        "SELECT vw_reservas_client",
        queryVistaReservas,
        hospedajesUnicos,
        rowsVista
      );

      for (const r of rowsVista || []) {
        const h = String(r.id_hospedaje);
        const s = r.id_servicio ?? null;
        if (s != null) mapHospToServ.set(h, s);
      }
    }

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
    step(7.1, "id_servicio_representativo + mapHospToServ", {
      id_servicio_representativo,
      mapHospToServ: Array.from(mapHospToServ.entries()),
    });

    // =========================
    // STEP 8: Aplicar créditos a facturas (memoria)
    // =========================
    const appliedByFactura = new Map();
    const appliedByCredito = new Map();
    let idxFactura = 0;
    const facturasWorking = facturas.map((f) => ({ ...f }));

    step(8, "facturasWorking inicial", facturasWorking);

    for (const cred of creditos) {
      step(8.1, "Procesando crédito", cred);

      while (cred.restante > 0 && idxFactura < facturasWorking.length) {
        while (
          idxFactura < facturasWorking.length &&
          facturasWorking[idxFactura].saldo <= 0
        )
          idxFactura++;
        if (idxFactura >= facturasWorking.length) break;

        const f = facturasWorking[idxFactura];
        const aplicar = Math.min(f.saldo, cred.restante);

        step(8.2, "Aplicación parcial", {
          idxFactura,
          factura: f,
          cred_raw: cred.raw_id,
          cred_restante: cred.restante,
          aplicar,
        });

        if (aplicar <= 0) {
          idxFactura++;
          continue;
        }

        f.saldo -= aplicar;
        cred.restante -= aplicar;

        appliedByFactura.set(
          f.id_factura,
          (appliedByFactura.get(f.id_factura) || 0) + aplicar
        );
        appliedByCredito.set(
          cred.raw_id,
          (appliedByCredito.get(cred.raw_id) || 0) + aplicar
        );

        if (f.saldo <= 0) idxFactura++;
      }

      step(8.3, "Crédito después de aplicar", {
        raw_id: cred.raw_id,
        restante_final: cred.restante,
        aplicado_total: appliedByCredito.get(cred.raw_id) || 0,
      });
    }

    step(8.4, "appliedByFactura / appliedByCredito / facturasWorking FINAL", {
      appliedByFactura: Array.from(appliedByFactura.entries()),
      appliedByCredito: Array.from(appliedByCredito.entries()),
      facturasWorking,
    });

    // =========================
    // STEP 9: Reparto a nivel ítem => planItemsPagos
    // =========================
    const planItemsPagos = [];

    step(
      9,
      "itemPendiente antes de repartir (preview)",
      brief(itemPendiente, 30)
    );

    for (const cred of creditos) {
      const aplicado = appliedByCredito.get(cred.raw_id) || 0;
      if (aplicado <= 0) continue;

      let porAplicar = aplicado;
      step(9.1, "Repartiendo crédito a items", {
        raw_id: cred.raw_id,
        aplicado,
        porAplicar,
      });

      for (const it of itemPendiente) {
        if (porAplicar <= 0) break;
        if (it.pendiente <= 0) continue;

        const m = Math.min(it.pendiente, porAplicar);
        planItemsPagos.push({
          id_item: it.id_item,
          raw_id: cred.raw_id,
          monto: m,
        });

        it.pendiente -= m;
        porAplicar -= m;

        step(9.2, "Asignación a item", {
          id_item: it.id_item,
          id_factura: it.id_factura,
          asignado: m,
          pendiente_restante_item: it.pendiente,
          porAplicar_restante_credito: porAplicar,
        });
      }

      step(9.3, "Fin crédito a items", {
        raw_id: cred.raw_id,
        porAplicar_sobrante: porAplicar,
      });
    }

    step(9.4, "planItemsPagos FINAL (preview)", {
      len: planItemsPagos.length,
      preview: brief(planItemsPagos, 50),
    });

    if (planItemsPagos.length === 0) {
      step(
        9.5,
        "ERROR CLAVE: planItemsPagos vacío => NO se insertará items_pagos",
        {
          causa_probable:
            "itemPendiente.pendiente quedó en 0 porque estás usando it.saldo pero tu SELECT trae monto. Cambia pendiente: Number(it.monto).",
          sumPendiente,
          sumMonto,
        }
      );
      // aquí puedes throw si quieres forzar que truene y lo veas
      // throw new Error("planItemsPagos vacío: no hay nada que insertar en items_pagos");
    }

    // =========================
    // STEP 10: INSERT pagos
    // =========================
    const transaccion = newId("tra");
    const pagosCreados = new Map();
    step(10, "Transacción generada", { transaccion });

    for (const cred of creditos) {
      const aplicado = appliedByCredito.get(cred.raw_id) || 0;
      if (aplicado <= 0) continue;

      const id_pago = newId("pag");
      pagosCreados.set(cred.raw_id, id_pago);

      const id_saldo_a_favor_pago = cred.isSaldoFavor ? cred.raw_id : null;
      const referencia_pago = referencia ?? transaccion;

      const queryInsertPagos = `
        INSERT INTO pagos (
          id_pago, id_servicio, id_saldo_a_favor, id_agente, metodo_pago,
          fecha_pago, concepto, referencia, currency, tipo_de_tarjeta,
          link_pago, last_digits, total, saldo_aplicado, transaccion, monto_transaccion
        )
        VALUES (?,?,?,?,?, NOW(), ?,?,?,?,?,?,?,?,?,?);
      `;
      const paramsPago = [
        id_pago,
        id_servicio_representativo,
        id_saldo_a_favor_pago,
        id_agente,
        metodo_de_pago,
        concepto,
        referencia_pago,
        currency,
        tipo_de_tarjeta,
        link_pago,
        last_digits,
        aplicado,
        aplicado,
        transaccion,
        aplicado,
      ];
      const rPago = await executeQuery(queryInsertPagos, paramsPago);
      logQuery("INSERT pagos", queryInsertPagos, paramsPago, rPago);

      step(10.1, "Pago creado para crédito", {
        raw_id: cred.raw_id,
        aplicado,
        id_pago,
        id_saldo_a_favor_pago,
      });
    }

    step(
      10.2,
      "pagosCreados (raw_id -> id_pago)",
      Array.from(pagosCreados.entries())
    );

    // =========================
    // STEP 11: INSERT items_pagos bulk
    // =========================
    if (planItemsPagos.length > 0) {
      const valuesIP = [];
      const paramsIP = [];

      for (const p of planItemsPagos) {
        const id_pago = pagosCreados.get(p.raw_id);

        // Si esto pasa mucho, significa que no se creó pago para ese crédito
        if (!id_pago) {
          step(
            11.1,
            "WARN: No existe id_pago para raw_id (saltando fila items_pagos)",
            p
          );
          continue;
        }

        valuesIP.push("(?, ?, ?)");
        paramsIP.push(p.id_item, id_pago, p.monto);
      }

      step(11.2, "Preparando INSERT items_pagos", {
        valuesIP_len: valuesIP.length,
        paramsIP_len: paramsIP.length,
        paramsIP_preview: brief(paramsIP, 30),
      });

      if (valuesIP.length > 0) {
        const sqlIP = `INSERT INTO items_pagos (id_item, id_pago, monto) VALUES ${valuesIP.join(
          ","
        )};`;
        const rIP = await executeQuery(sqlIP, paramsIP);
        logQuery("INSERT items_pagos (bulk)", sqlIP, paramsIP, rIP);
        step(11.3, "INSERT items_pagos OK", rIP);
      } else {
        step(11.4, "ERROR: valuesIP quedó vacío (no se insertó items_pagos)", {
          causa_probable:
            "pagosCreados no tenía id_pago para esos raw_id o planItemsPagos vacío o filtraste todo con !id_pago",
          pagosCreados: Array.from(pagosCreados.entries()),
          planItemsPagos_preview: brief(planItemsPagos, 50),
        });
      }
    } else {
      step(11.5, "NO INSERT items_pagos porque planItemsPagos está vacío");
    }

    // =========================
    // STEP 12: INSERT bridge facturas_pagos_y_saldos
    // =========================
    const montoFacturaCredito = new Map();
    const facturaPorItem = new Map(
      itemPendiente.map((it) => [it.id_item, it.id_factura])
    );

    for (const p of planItemsPagos) {
      const id_factura = facturaPorItem.get(p.id_item);
      const key = `${id_factura}|${p.raw_id}`;
      montoFacturaCredito.set(
        key,
        (montoFacturaCredito.get(key) || 0) + p.monto
      );
    }

    step(12, "montoFacturaCredito", Array.from(montoFacturaCredito.entries()));

    const queryBridge = `
      INSERT INTO facturas_pagos_y_saldos (id_pago, id_saldo_a_favor, id_factura, monto)
      VALUES (?,?,?,?);
    `;

    for (const [key, monto] of montoFacturaCredito.entries()) {
      const [id_factura, raw] = key.split("|");
      const cred = creditos.find((c) => c.raw_id === raw);
      if (!cred) continue;

      const id_pago_vinc = cred.isSaldoFavor ? null : pagosCreados.get(raw);
      const id_saldo_vinc = cred.isSaldoFavor ? raw : null;

      const paramsBridge = [id_pago_vinc, id_saldo_vinc, id_factura, monto];
      console.log(
        queryBridge,
        paramsBridge,
        "🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽🔽 parametros"
      );
      const rBridge = await executeQuery(queryBridge, paramsBridge);
      logQuery(
        "INSERT facturas_pagos_y_saldos",
        queryBridge,
        paramsBridge,
        rBridge
      );
    }

    // =========================
    // STEP 13: UPDATE facturas.saldo
    // =========================
    for (const f of facturasWorking) {
      const queryUpdateFactura =
        "UPDATE facturas SET saldo = ? WHERE id_factura = ?;";
      const rUF = await executeQuery(queryUpdateFactura, [
        f.saldo,
        f.id_factura,
      ]);
      logQuery(
        "UPDATE facturas.saldo",
        queryUpdateFactura,
        [f.saldo, f.id_factura],
        rUF
      );
    }

    // =========================
    // STEP 14: UPDATE items (OJO: tu código actual actualiza items, no items_facturas)
    // =========================
    const itemsConCambio = itemPendiente.filter((it) =>
      Number.isFinite(it.pendiente)
    );
    step(14, "itemsConCambio (preview)", brief(itemsConCambio, 20));

    if (itemsConCambio.length > 0) {
      const ids = itemsConCambio.map((it) => it.id_item);
      const caseParts = itemsConCambio
        .map(() => `WHEN id_item = ? THEN ?`)
        .join(" ");

      const paramsCase = [];
      for (const it of itemsConCambio)
        paramsCase.push(it.id_item, it.pendiente);

      const placeholdersItems = ids.map(() => "?").join(",");
      const sqlUpdateItems = `
        UPDATE items
        SET saldo = CASE ${caseParts} END
        WHERE id_item IN (${placeholdersItems});
      `;
      const paramsUpdateItems = [...paramsCase, ...ids];
      const rUI = await executeQuery(sqlUpdateItems, paramsUpdateItems);
      logQuery(
        "UPDATE items.saldo (CASE bulk)",
        sqlUpdateItems,
        paramsUpdateItems,
        rUI
      );
    }

    // =========================
    // STEP 15: UPDATE saldos_a_favor
    // =========================
    for (const cred of creditos) {
      if (!cred.isSaldoFavor) continue;

      const aplicado = appliedByCredito.get(cred.raw_id) || 0;
      const disponible = cred.disponible || 0;
      const restante = Math.max(0, disponible - aplicado);

      const queryUpdateSaldos = `
        UPDATE saldos_a_favor
        SET saldo = ?, activo = CASE WHEN (?) <= 0 THEN 0 ELSE 1 END
        WHERE id_saldos = ?;
      `;
      const paramsUS = [restante, restante, cred.raw_id];
      const rUS = await executeQuery(queryUpdateSaldos, paramsUS);
      logQuery("UPDATE saldos_a_favor", queryUpdateSaldos, paramsUS, rUS);
    }

    // (Opcional) COMMIT
    // await executeQuery("COMMIT");
    // step(16, "COMMIT");

    return res.status(200).json({
      message: "Debug completo impreso en consola (revisa logs).",
      dbg: {
        facturasOrden,
        rawIds,
        creditos,
        sumPendiente,
        sumMonto,
        planItemsPagos_len: planItemsPagos.length,
      },
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

const asignarFacturaPagos = async (req, res) => {
  // helpers
  // ============================================================
  // RECONCILIACIÓN: amarrar saldos entre credito_a_factura y credito_a_item
  // (solo para facturas que TIENEN items)
  // ============================================================
  const reconcileFacturaItemLinks = ({
    credito_a_factura,
    credito_a_item,
    itemsDeFacturas,
    toCents,
    fromCents,
    log,
  }) => {
    // Mapa id_item -> id_factura
    const itemToFactura = new Map();
    // Facturas que tienen items
    const facturasConItems = new Set();

    for (const it of itemsDeFacturas || []) {
      const id_item = String(it.id_item);
      const id_factura = String(it.id_factura);
      itemToFactura.set(id_item, id_factura);
      facturasConItems.add(id_factura);
    }

    log("[LINK] facturasConItems", Array.from(facturasConItems));

    // Normaliza credito_a_factura: 1 row por (factura|saldo)
    const facMap = new Map(); // key: f|s -> cents
    for (const r of credito_a_factura || []) {
      const id_factura = String(r.id_factura);
      const id_saldo = String(r.id_saldo);
      const cents = toCents(r.monto_a_aplicar);
      const k = `${id_factura}|${id_saldo}`;
      facMap.set(k, (facMap.get(k) ?? 0) + cents);
    }

    // Normaliza credito_a_item: 1 row por (item|saldo)
    const itemMap = new Map(); // key: item|saldo -> cents
    for (const r of credito_a_item || []) {
      const id_item = String(r.id_item);
      const id_saldo = String(r.id_saldo);
      const cents = toCents(r.monto_a_aplicar);
      const k = `${id_item}|${id_saldo}`;
      itemMap.set(k, (itemMap.get(k) ?? 0) + cents);
    }

    // Helpers para sets
    const buildFacturaSets = () => {
      const setFactura = new Map(); // id_factura -> Set(id_saldo)
      for (const [k, cents] of facMap.entries()) {
        if (cents <= 0) continue;
        const [idf, ids] = k.split("|");
        if (!facturasConItems.has(idf)) continue; // solo facturas con items
        if (!setFactura.has(idf)) setFactura.set(idf, new Set());
        setFactura.get(idf).add(ids);
      }
      return setFactura;
    };

    const buildItemSets = () => {
      const setItems = new Map(); // id_factura -> Set(id_saldo)
      for (const [k, cents] of itemMap.entries()) {
        if (cents <= 0) continue;
        const [id_item, id_saldo] = k.split("|");
        const id_factura = itemToFactura.get(id_item);
        if (!id_factura) continue;
        if (!facturasConItems.has(id_factura)) continue;
        if (!setItems.has(id_factura)) setItems.set(id_factura, new Set());
        setItems.get(id_factura).add(id_saldo);
      }
      return setItems;
    };

    const ensureFacturaHasCent = (id_factura, id_saldo) => {
      // +1 cent al target
      const kTarget = `${id_factura}|${id_saldo}`;
      facMap.set(kTarget, (facMap.get(kTarget) ?? 0) + 1);

      // -1 cent de un donador (misma factura, otro saldo)
      let donorKey = null;
      for (const [k, cents] of facMap.entries()) {
        if (cents <= 1) continue;
        const [idf, ids] = k.split("|");
        if (idf !== id_factura) continue;
        if (ids === id_saldo) continue;
        donorKey = k;
        break;
      }

      if (!donorKey) {
        // fallback: permitir donar del mismo saldo (si tenía >1) para no romper totales
        const c = facMap.get(kTarget) ?? 0;
        if (c > 1) donorKey = kTarget;
      }

      if (!donorKey) {
        throw new Error(
          `[LINK] No hay donador para meter 1 centavo en FACTURA ${id_factura} con saldo ${id_saldo}`
        );
      }

      facMap.set(donorKey, (facMap.get(donorKey) ?? 0) - 1);
      if ((facMap.get(donorKey) ?? 0) <= 0) facMap.delete(donorKey);

      log("[LINK][FACTURA] +1 cent / -1 cent", {
        id_factura,
        id_saldo,
        donorKey,
      });
    };

    const ensureItemHasCent = (id_factura, id_saldo) => {
      // Elegir un item de esa factura que tenga "donador" para poder restar 1 centavo sin romper el item
      const itemsFactura = [];
      for (const [id_item, idf] of itemToFactura.entries()) {
        if (idf === id_factura) itemsFactura.push(id_item);
      }

      // Encuentra item donde exista algún saldo != target con cents>1 (preferido)
      let chosenItem = null;
      let donorKey = null;

      const findDonorInItem = (id_item, allowOneCent = false) => {
        // retorna un key item|saldo donador distinto al target
        for (const [k, cents] of itemMap.entries()) {
          const [it, ids] = k.split("|");
          if (it !== id_item) continue;
          if (ids === id_saldo) continue;
          if (cents > 1) return k;
        }
        if (allowOneCent) {
          for (const [k, cents] of itemMap.entries()) {
            const [it, ids] = k.split("|");
            if (it !== id_item) continue;
            if (ids === id_saldo) continue;
            if (cents >= 1) return k;
          }
        }
        return null;
      };

      for (const id_item of itemsFactura) {
        const dk = findDonorInItem(id_item, false);
        if (dk) {
          chosenItem = id_item;
          donorKey = dk;
          break;
        }
      }

      // fallback: permitir donador con 1 centavo (podría “desaparecer” ese saldo de ese item)
      if (!chosenItem) {
        for (const id_item of itemsFactura) {
          const dk = findDonorInItem(id_item, true);
          if (dk) {
            chosenItem = id_item;
            donorKey = dk;
            break;
          }
        }
      }

      if (!chosenItem) {
        throw new Error(
          `[LINK] No hay item/donador para meter 1 centavo en ITEMS de FACTURA ${id_factura} con saldo ${id_saldo}`
        );
      }

      // +1 cent al target en chosenItem
      const kTarget = `${chosenItem}|${id_saldo}`;
      itemMap.set(kTarget, (itemMap.get(kTarget) ?? 0) + 1);

      // -1 cent al donador dentro del MISMO ITEM
      itemMap.set(donorKey, (itemMap.get(donorKey) ?? 0) - 1);
      if ((itemMap.get(donorKey) ?? 0) <= 0) itemMap.delete(donorKey);

      log("[LINK][ITEM] +1 cent / -1 cent", {
        id_factura,
        chosenItem,
        id_saldo,
        donorKey,
      });
    };

    // Iterar hasta estabilizar (por si un swap con 1 cent genera nuevas diferencias)
    const MAX_IT = 25;
    for (let it = 1; it <= MAX_IT; it++) {
      const setFactura = buildFacturaSets();
      const setItems = buildItemSets();

      let changed = false;

      for (const id_factura of facturasConItems) {
        const sF = setFactura.get(id_factura) || new Set();
        const sI = setItems.get(id_factura) || new Set();

        const missingInFactura = [...sI].filter((s) => !sF.has(s));
        const missingInItems = [...sF].filter((s) => !sI.has(s));

        if (missingInFactura.length || missingInItems.length) {
          log("[LINK] diferencias", {
            it,
            id_factura,
            missingInFactura,
            missingInItems,
          });
        }

        // Si un saldo está en items pero no en factura => meter 1 cent a factura
        for (const id_saldo of missingInFactura) {
          ensureFacturaHasCent(id_factura, id_saldo);
          changed = true;
        }

        // Si un saldo está en factura pero no en items => meter 1 cent a algún item de la factura
        for (const id_saldo of missingInItems) {
          ensureItemHasCent(id_factura, id_saldo);
          changed = true;
        }
      }

      if (!changed) {
        log("[LINK] OK estable", { iterations: it });
        break;
      }

      if (it === MAX_IT) {
        log("[LINK][WARN] No estabilizó en el máximo de iteraciones", {
          MAX_IT,
        });
      }
    }

    // Reconstruir arrays finales en decimales
    const creditoFacturaFinal = [];
    for (const [k, cents] of facMap.entries()) {
      if (cents <= 0) continue;
      const [id_factura, id_saldo] = k.split("|");
      creditoFacturaFinal.push({
        id_factura,
        id_saldo,
        monto_a_aplicar: fromCents(cents),
      });
    }

    const creditoItemFinal = [];
    for (const [k, cents] of itemMap.entries()) {
      if (cents <= 0) continue;
      const [id_item, id_saldo] = k.split("|");
      creditoItemFinal.push({
        id_item,
        id_saldo,
        monto_a_aplicar: fromCents(cents),
      });
    }

    // Debug final: sets por factura
    const finalSetFactura = new Map();
    for (const r of creditoFacturaFinal) {
      if (!facturasConItems.has(String(r.id_factura))) continue;
      if (!finalSetFactura.has(r.id_factura))
        finalSetFactura.set(r.id_factura, new Set());
      finalSetFactura.get(r.id_factura).add(String(r.id_saldo));
    }
    const finalSetItems = new Map();
    for (const r of creditoItemFinal) {
      const id_factura = itemToFactura.get(String(r.id_item));
      if (!id_factura || !facturasConItems.has(id_factura)) continue;
      if (!finalSetItems.has(id_factura))
        finalSetItems.set(id_factura, new Set());
      finalSetItems.get(id_factura).add(String(r.id_saldo));
    }

    log(
      "[LINK] sets FINAL factura",
      Array.from(finalSetFactura.entries()).map(([f, s]) => [f, Array.from(s)])
    );
    log(
      "[LINK] sets FINAL items",
      Array.from(finalSetItems.entries()).map(([f, s]) => [f, Array.from(s)])
    );

    return { creditoFacturaFinal, creditoItemFinal };
  };

  const toCents = (n) => {
    const x = Number(n ?? 0);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100);
  };

  const newId = (pfx) =>
    `${pfx}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  const fromCents = (c) => c / 100;
  const transaccion = newId("tra");

  const log = (label, data) => {
    if (data !== undefined) console.log(`[LOG] ${label}`, data);
    else console.log(`[LOG] ${label}`);
    console.log("------------------------------------------------------------");
  };

  const logQuery = (label, sql, params, result) => {
    console.log(`[SQL] ${label}\n  Query: ${sql}\n  Params:`, params);
    if (result !== undefined) console.log(`  Result:`, result);
    console.log("------------------------------------------------------------");
  };

  const briefLocal = (arr, n = 20) =>
    Array.isArray(arr) ? arr.slice(0, n) : arr;
  let pendiente_items;
  let pendiente_facturas;

  // Best-fit: intenta cubrir completo; si no, agarra cualquiera con saldo > 0
  const pickBest = (pool, need) => {
    const full = pool.filter((p) => p.remaining >= need);
    if (full.length) {
      let best = full[0];
      for (const c of full) if (c.remaining < best.remaining) best = c;
      return { picked: best, mode: "full_cover_best_fit" };
    }
    const any = pool.find((p) => p.remaining > 0) || null;
    return { picked: any, mode: "partial_any" };
  };

  try {
    log("Pasos a iniciar (req.body)", req.body);

    const {
      id_factura: facturasRaw,
      ejemplo_saldos: saldosRaw,
      id_agente = null,
      metodo_de_pago = "aplicacion_saldo",
      currency = "MXN",
      concepto = "aplicacion a facturas",
    } = req.body || {};

    // ---------
    // Validaciones payload
    // ---------
    if (
      !facturasRaw ||
      (Array.isArray(facturasRaw) && facturasRaw.length === 0)
    ) {
      log("ERROR id_factura faltante/vacío", { facturasRaw });
      return res.status(400).json({
        error: "Debes enviar 'id_factura' con 1+ elementos (array o string).",
      });
    }
    const facturasOrden = Array.isArray(facturasRaw)
      ? facturasRaw
      : [facturasRaw];
    log("facturasOrden normalizado", facturasOrden);

    let itemsEntrada = saldosRaw;
    if (!itemsEntrada) {
      log("ERROR ejemplo_saldos faltante", { itemsEntrada });
      return res
        .status(400)
        .json({ error: "Falta 'ejemplo_saldos' en el payload." });
    }

    if (typeof itemsEntrada === "string") {
      log("ejemplo_saldos venía string -> JSON.parse", itemsEntrada);
      try {
        itemsEntrada = JSON.parse(itemsEntrada);
      } catch (e) {
        log("ERROR JSON.parse(ejemplo_saldos)", { message: e.message });
        return res.status(400).json({
          error: "El campo 'ejemplo_saldos' no es un JSON válido",
          details: e.message,
        });
      }
    }
    if (!Array.isArray(itemsEntrada)) itemsEntrada = [itemsEntrada];

    log("itemsEntrada normalizado", {
      length: itemsEntrada.length,
      preview: briefLocal(itemsEntrada, 10),
    });

    // -----------------------------
    // 1) Cargar facturas (totales por factura)
    // -----------------------------
    const facturas = [];
    for (const idf of facturasOrden) {
      const q = "SELECT id_factura, saldo FROM facturas WHERE id_factura = ?;";
      const r = await executeQuery(q, [idf]);
      logQuery("SELECT factura saldo", q, [idf], r);

      if (!r?.length) {
        log("ERROR: Factura no encontrada", { id_factura: idf });
        return res.status(400).json({ error: `Factura no encontrada: ${idf}` });
      }
      const fSaldo = Number(r[0].saldo) || 0;

      if (fSaldo <= 0) {
        log("ERROR: Factura sin saldo por pagar (ya pagada o aplicada)", {
          id_factura: idf,
          saldo: fSaldo,
        });
        return res.status(400).json({
          error:
            "No se puede aplicar pago: la factura ya fue pagada total o parcialmente (saldo <= 0).",
          details: { id_factura: idf, saldo: fSaldo },
        });
      }

      const f = { id_factura: String(r[0].id_factura), saldo: fSaldo };
      facturas.push(f);

      log("facturas.push", f);
    }

    const totalFacturasCents = facturas.reduce(
      (acc, f) => acc + toCents(f.saldo),
      0
    );
    log("Facturas cargadas", {
      facturas,
      total_facturas: fromCents(totalFacturasCents),
    });

    // -----------------------------
    // 2) Vista de saldos disponibles (saldo y monto_por_facturar por raw_id)
    // -----------------------------
    const rawIds = [...new Set(itemsEntrada.map((it) => String(it.id_saldo)))];
    const placeholdersRaw = rawIds.map(() => "?").join(",");
    let viewRows = [];

    if (rawIds.length) {
      const q = `SELECT raw_id, saldo, monto_por_facturar
                 FROM vw_pagos_prepago_facturables
                 WHERE raw_id IN (${placeholdersRaw});`;
      viewRows = await executeQuery(q, rawIds);
      logQuery("SELECT vw_pagos_prepago_facturables", q, rawIds, viewRows);
    }

    const saldoVistaPorRaw = new Map(); // saldo real (para items)
    const facturablePorRaw = new Map(); // monto_por_facturar (para validación aplicado)

    for (const row of viewRows || []) {
      const rid = String(row.raw_id);
      const saldoC = Math.max(0, toCents(row.saldo));
      const factC = Math.max(0, toCents(row.monto_por_facturar));
      saldoVistaPorRaw.set(rid, saldoC);
      facturablePorRaw.set(rid, factC);

      log("[MAP] vista set", {
        rid,
        saldo: fromCents(saldoC),
        monto_por_facturar: fromCents(factC),
      });
    }

    // -----------------------------
    // 3) Items de facturas (para asignación a items)
    // -----------------------------
    const placeholdersFact = facturasOrden.map(() => "?").join(",");
    const qItems = `
      SELECT id_item, id_factura, monto, id_relacion as id_hospedaje
      FROM items_facturas
      WHERE id_factura IN (${placeholdersFact})
      ORDER BY id_factura ASC, id_item ASC;
    `;
    const itemsDeFacturas = await executeQuery(qItems, facturasOrden);
    logQuery("SELECT items_facturas", qItems, facturasOrden, itemsDeFacturas);

    // const qItem = `SELECT saldo from items where id_factura `
    log("itemsDeFacturas (preview)", briefLocal(itemsDeFacturas, 50));

    const totalItemsCents = (itemsDeFacturas || []).reduce(
      (acc, it) => acc + toCents(it.monto),
      0
    );
    log("Total items", { total_items: fromCents(totalItemsCents) });

    // ============================================================
    // 4) Normalización de saldos de entrada + VALIDACIONES
    // ============================================================
    const saldosAplicados = (itemsEntrada || []).map((s) => {
      const id_saldo = String(s.id_saldo);
      const aplicado_cents = toCents(s.aplicado);

      const montoFacturableCents = facturablePorRaw.get(id_saldo) ?? 0;
      const saldoVistaCents = saldoVistaPorRaw.get(id_saldo) ?? 0;

      // Para ITEMS: si aplicado > saldoVista -> usar saldoVista; si no, usar aplicado
      const itemCapCents = Math.min(aplicado_cents, saldoVistaCents);

      const obj = {
        id_saldo,
        aplicado_cents,
        montoFacturableCents,
        saldoVistaCents,
        itemCapCents,
      };

      log("[SALDO] normalizado", {
        id_saldo,
        aplicado: fromCents(aplicado_cents),
        monto_por_facturar: fromCents(montoFacturableCents),
        saldo_vista: fromCents(saldoVistaCents),
        item_cap: fromCents(itemCapCents),
      });

      return obj;
    });

    // (A) Validación por saldo: aplicado <= monto_por_facturar (siempre)
    for (const s of saldosAplicados) {
      if (s.aplicado_cents > s.montoFacturableCents) {
        log("[ERROR] aplicado > monto_por_facturar", {
          id_saldo: s.id_saldo,
          aplicado: fromCents(s.aplicado_cents),
          monto_por_facturar: fromCents(s.montoFacturableCents),
        });

        // return res.status(400).json({
        //   error: "fondos insuficientes por favor recarga la pagina",
        //   details: {
        //     id_saldo: s.id_saldo,
        //     aplicado: fromCents(s.aplicado_cents),
        //     monto_por_facturar: fromCents(s.montoFacturableCents),
        //   },
        // });
      }
    }

    // (B) Validación facturas: total aplicado debe cubrir EXACTO total facturas
    const totalAplicadoCents = saldosAplicados.reduce(
      (acc, s) => acc + s.aplicado_cents,
      0
    );
    let diferencia = fromCents(totalFacturasCents - totalAplicadoCents);
    log("Totales aplicado vs facturas", {
      total_aplicado: fromCents(totalAplicadoCents),
      total_facturas: fromCents(totalFacturasCents),
      diferencia: fromCents(totalFacturasCents - totalAplicadoCents),
    });

    // (C) Validación items: suma de min(aplicado, saldoVista) >= total items
    const totalItemCapCents = saldosAplicados.reduce(
      (acc, s) => acc + s.itemCapCents,
      0
    );
    log("Totales items (cap vs need)", {
      total_item_cap: fromCents(totalItemCapCents),
      total_items: fromCents(totalItemsCents),
      diferencia: fromCents(totalItemsCents - totalItemCapCents),
    });

    // if (totalItemsCents > 0 && totalItemCapCents < totalItemsCents) {
    //   return res.status(400).json({
    //     error: "fondos insuficientes por favor recarga la pagina",
    //     details: {
    //       motivo: "La suma de min(aplicado, saldo) no cubre el total de items",
    //       total_item_cap: fromCents(totalItemCapCents),
    //       total_items: fromCents(totalItemsCents),
    //       faltante: fromCents(totalItemsCents - totalItemCapCents),
    //     },
    //   });
    // }

    // ============================================================
    // 5) ASIGNACIÓN A FACTURAS (solo con aplicado)
    // ============================================================
    const poolFactura = saldosAplicados
      .filter((s) => s.aplicado_cents > 0)
      .map((s) => ({ id_saldo: s.id_saldo, remaining: s.aplicado_cents }));

    log(
      "poolFactura inicial (remaining=aplicado)",
      poolFactura.map((p) => ({
        id_saldo: p.id_saldo,
        remaining: fromCents(p.remaining),
      }))
    );

    const credito_a_factura = [];

    for (const f of facturas) {
      let need = toCents(f.saldo);
      log("[FACTURA] start", {
        id_factura: f.id_factura,
        need: fromCents(need),
      });

      while (need > 0) {
        const { picked, mode } = pickBest(poolFactura, need);

        log("[FACTURA] pickBest", {
          id_factura: f.id_factura,
          mode,
          need: fromCents(need),
          picked: picked
            ? {
                id_saldo: picked.id_saldo,
                remaining: fromCents(picked.remaining),
              }
            : null,
        });

        if (!picked || picked.remaining <= 0) {
          pendiente_facturas = need;
          diferencia = need;
          break;
        }

        const take = Math.min(need, picked.remaining);

        credito_a_factura.push({
          id_factura: f.id_factura,
          id_saldo: picked.id_saldo,
          monto_a_aplicar: fromCents(take),
        });

        log("[FACTURA] push", {
          id_factura: f.id_factura,
          id_saldo: picked.id_saldo,
          take: fromCents(take),
        });

        picked.remaining -= take;
        need -= take;

        log("[FACTURA] after", {
          id_factura: f.id_factura,
          id_saldo: picked.id_saldo,
          remaining: fromCents(picked.remaining),
          need: fromCents(need),
        });
      }
    }

    log("credito_a_factura final", credito_a_factura);

    // ============================================================
    // 6) ASIGNACIÓN A ITEMS (capado por saldoVista: min(aplicado, saldoVista))
    // ============================================================
    const poolItem = saldosAplicados
      .filter((s) => s.itemCapCents > 0)
      .map((s) => ({ id_saldo: s.id_saldo, remaining: s.itemCapCents }))
      .sort((a, b) => b.remaining - a.remaining);

    log(
      "poolItem inicial (remaining=min(aplicado,saldoVista))",
      poolItem.map((p) => ({
        id_saldo: p.id_saldo,
        remaining: fromCents(p.remaining),
      }))
    );

    const credito_a_item = [];

    for (const it of itemsDeFacturas || []) {
      const id_item = String(it.id_item);
      let need = toCents(it.monto);

      log("[ITEM] start", {
        id_item,
        id_factura: it.id_factura,
        need: fromCents(need),
      });

      while (need > 0) {
        const { picked, mode } = pickBest(poolItem, need);

        log("[ITEM] pickBest", {
          id_item,
          mode,
          need: fromCents(need),
          picked: picked
            ? {
                id_saldo: picked.id_saldo,
                remaining: fromCents(picked.remaining),
              }
            : null,
        });

        if (!picked || picked.remaining <= 0) {
          pendiente_items = need;
          break;
        }

        const take = Math.min(need, picked.remaining);

        credito_a_item.push({
          id_item,
          id_saldo: picked.id_saldo,
          monto_a_aplicar: fromCents(take),
        });

        log("[ITEM] push", {
          id_item,
          id_saldo: picked.id_saldo,
          take: fromCents(take),
        });

        picked.remaining -= take;
        need -= take;

        log("[ITEM] after", {
          id_item,
          id_saldo: picked.id_saldo,
          remaining: fromCents(picked.remaining),
          need: fromCents(need),
        });
      }
    }

    log("credito_a_item final", credito_a_item);

    // ============================================================
    // 6.5) AMARRE saldo<->factura<->items (regla del centavo)
    // ============================================================
    try {
      const { creditoFacturaFinal, creditoItemFinal } =
        reconcileFacturaItemLinks({
          credito_a_factura,
          credito_a_item,
          itemsDeFacturas,
          toCents,
          fromCents,
          log,
        });

      // Sobrescribe para que TODO lo de inserts/bridges/updates use los reconciliados
      credito_a_factura.length = 0;
      credito_a_factura.push(...creditoFacturaFinal);

      credito_a_item.length = 0;
      credito_a_item.push(...creditoItemFinal);

      log(
        "[LINK] credito_a_factura reconciliado",
        briefLocal(credito_a_factura, 50)
      );
      log("[LINK] credito_a_item reconciliado", briefLocal(credito_a_item, 50));
    } catch (e) {
      log("[LINK][ERROR] Reconciliación falló", { message: e.message });
      return res.status(400).json({
        error:
          "No se pudo amarrar saldos entre items y facturas (regla del centavo)",
        details: e.message,
      });
    }

    // ============================================================
    // 7) INSERTS en pagos usando credito_a_item
    // ============================================================
    // ============================================================
    // 7) INSERTS en pagos + items_pagos usando credito_a_item
    // ============================================================

    const sqlIP = `INSERT INTO items_pagos (id_item, id_pago, monto) VALUES (?,?,?);`;

    const queryInsertPagos = `
  INSERT INTO pagos (
    id_pago, id_servicio, id_saldo_a_favor, id_agente, metodo_de_pago,
    fecha_pago, concepto, referencia, currency, tipo_de_tarjeta,
    link_pago, last_digits, total, saldo_aplicado, transaccion, monto_transaccion
  )
  VALUES (?,?,?,?,?, NOW(), ?,?,?,?,?,?,?,?,?,?);
`;

    // Bridge facturas/saldos (id_pago = NULL)
    const queryBridge = `
  INSERT INTO facturas_pagos_y_saldos (id_pago, id_saldo_a_favor, id_factura, monto)
  VALUES (?,?,?,?);
`;

    // Updates
    const queryUpdateFactura =
      "UPDATE facturas SET saldo = ? WHERE id_factura = ?;";
    const queryUpdateSaldoAFavor = `
  UPDATE saldos_a_favor
  SET saldo = GREATEST(0, saldo - ?)
  WHERE id_saldos = ?;
`;

    // --------------------------
    // Mapas auxiliares
    // --------------------------

    // id_item -> id_hospedaje (ya lo tienes en itemsDeFacturas)
    const itemToHospedaje = new Map();
    for (const it of itemsDeFacturas || []) {
      itemToHospedaje.set(String(it.id_item), String(it.id_hospedaje));
    }
    log(
      "[PAGOS] itemToHospedaje (preview)",
      briefLocal(Array.from(itemToHospedaje.entries()), 20)
    );

    // hospedajes únicos (de credito_a_item)
    const hospedajesUnicos = [
      ...new Set(
        (credito_a_item || [])
          .map((row) => itemToHospedaje.get(String(row.id_item)))
          .filter(Boolean)
          .map(String)
      ),
    ];
    log("[PAGOS] hospedajesUnicos", hospedajesUnicos);

    // id_hospedaje -> id_servicio (vw_reservas_client)
    const hospToServicio = new Map();
    if (hospedajesUnicos.length) {
      const phHosp = hospedajesUnicos.map(() => "?").join(",");
      const queryVistaReservas = `
    SELECT id_hospedaje, id_servicio
    FROM vw_reservas_client
    WHERE id_hospedaje IN (${phHosp});
  `;
      const rowsVista = await executeQuery(
        queryVistaReservas,
        hospedajesUnicos
      );
      logQuery(
        "SELECT vw_reservas_client",
        queryVistaReservas,
        hospedajesUnicos,
        rowsVista
      );

      for (const r of rowsVista || []) {
        const h = String(r.id_hospedaje);
        const s = r.id_servicio ? String(r.id_servicio) : null;
        if (!hospToServicio.has(h) && s) hospToServicio.set(h, s);
      }
    }
    log(
      "[PAGOS] hospToServicio (preview)",
      briefLocal(Array.from(hospToServicio.entries()), 20)
    );

    // Metadata por saldo (saldos_a_favor)
    const saldosIdsUnicos = [
      ...new Set((credito_a_item || []).map((r) => String(r.id_saldo))),
    ];
    log("[PAGOS] saldosIdsUnicos", saldosIdsUnicos);

    const saldoInfoById = new Map();
    if (saldosIdsUnicos.length) {
      const phSaldo = saldosIdsUnicos.map(() => "?").join(",");
      const querySaldoInfo = `
    SELECT
      id_saldos,
      metodo_pago,
      concepto,
      referencia,
      currency,
      tipo_tarjeta,
      link_stripe,
      ult_digits
    FROM saldos_a_favor
    WHERE id_saldos IN (${phSaldo});
  `;
      const rowsSaldoInfo = await executeQuery(querySaldoInfo, saldosIdsUnicos);
      logQuery(
        "SELECT saldos_a_favor (metadata)",
        querySaldoInfo,
        saldosIdsUnicos,
        rowsSaldoInfo
      );

      for (const r of rowsSaldoInfo || []) {
        saldoInfoById.set(String(r.id_saldos), {
          metodo_de_pago: r.metodo_de_pago ?? metodo_de_pago ?? null,
          concepto: r.concepto ?? concepto ?? null,
          referencia: r.referencia ?? null,
          currency: r.currency ?? currency ?? null,
          tipo_de_tarjeta: r.tipo_de_tarjeta ?? null,
          link_pago: r.link_pago ?? null,
          last_digits: r.last_digits ?? null,
        });
      }
    }
    log(
      "[PAGOS] saldoInfoById (preview)",
      briefLocal(Array.from(saldoInfoById.entries()), 10)
    );

    // Acumulador para restar saldo en saldos_a_favor (por id_saldo) en CENTS
    const restarPorSaldoCents = new Map();

    // --------------------------
    // Inserts por credito_a_item
    // --------------------------
    let insertedPagos = 0;
    let insertedItemsPagos = 0;

    for (const row of credito_a_item || []) {
      const id_item = String(row.id_item);
      const id_saldo_a_favor_pago = String(row.id_saldo);

      const id_hospedaje = itemToHospedaje.get(id_item) || null;
      const id_servicio_representativo = id_hospedaje
        ? hospToServicio.get(String(id_hospedaje)) || null
        : null;

      const aplicado_cents = toCents(row.monto_a_aplicar);
      const aplicado = fromCents(aplicado_cents);

      const meta = saldoInfoById.get(id_saldo_a_favor_pago) || {
        metodo_de_pago: metodo_de_pago ?? null,
        concepto: concepto ?? null,
        referencia: null,
        currency: currency ?? null,
        tipo_de_tarjeta: null,
        link_pago: null,
        last_digits: null,
      };

      if (!id_servicio_representativo) {
        log("[PAGOS][WARN] No se encontró id_servicio para id_item", {
          id_item,
          id_hospedaje,
          id_saldo: id_saldo_a_favor_pago,
        });
        // Si quieres HARD FAIL:
        // return res.status(400).json({ error: "No se encontró id_servicio para un item", details: { id_item, id_hospedaje } });
      }

      // 👇 id_pago debe ser único por insert (usa tu generador actual)
      const id_pago = newId("pag"); // <- YA EXISTE EN TU PROYECTO (no lo estoy definiendo)

      const paramsPago = [
        id_pago,
        id_servicio_representativo,
        id_saldo_a_favor_pago,
        id_agente,
        meta.metodo_de_pago,
        meta.concepto,
        meta.referencia,
        meta.currency,
        meta.tipo_de_tarjeta,
        meta.link_pago,
        meta.last_digits,
        aplicado, // total
        aplicado, // saldo_aplicado
        transaccion, // ya la generas tú
        aplicado, // monto_transaccion
      ];

      log("[PAGOS] INSERT pagos (params)", {
        id_pago,
        id_item,
        id_hospedaje,
        id_servicio_representativo,
        id_saldo_a_favor_pago,
        aplicado,
        meta,
        transaccion,
      });

      const rPago = await executeQuery(queryInsertPagos, paramsPago);
      logQuery("INSERT pagos", queryInsertPagos, paramsPago, rPago);
      insertedPagos += 1;

      // INSERT items_pagos con el id_pago recién insertado
      const paramsIP = [id_item, id_pago, aplicado];
      log("[PAGOS] INSERT items_pagos (params)", {
        id_item,
        id_pago,
        monto: aplicado,
      });

      const rIP = await executeQuery(sqlIP, paramsIP);
      logQuery("INSERT items_pagos", sqlIP, paramsIP, rIP);
      insertedItemsPagos += 1;

      // acumular para update saldos_a_favor
      const prev = restarPorSaldoCents.get(id_saldo_a_favor_pago) ?? 0;
      restarPorSaldoCents.set(id_saldo_a_favor_pago, prev + aplicado_cents);

      log("[PAGOS] restarPorSaldoCents.update", {
        id_saldo: id_saldo_a_favor_pago,
        prev: fromCents(prev),
        add: fromCents(aplicado_cents),
        nuevo: fromCents(prev + aplicado_cents),
      });
    }

    log("[PAGOS] Inserts completados", { insertedPagos, insertedItemsPagos });

    // ============================================================
    // 8) INSERT bridge facturas_pagos_y_saldos con credito_a_factura
    //    id_pago = NULL (como pediste)
    // ============================================================
    let insertedBridge = 0;

    for (const row of credito_a_factura || []) {
      const id_factura = String(row.id_factura);
      const id_saldo = String(row.id_saldo);
      const monto_cents = toCents(row.monto_a_aplicar);
      const monto = fromCents(monto_cents);

      const paramsBridge = [null, id_saldo, id_factura, monto];

      log("[BRIDGE] INSERT facturas_pagos_y_saldos (params)", {
        id_pago: null,
        id_saldo,
        id_factura,
        monto,
      });

      const rB = await executeQuery(queryBridge, paramsBridge);
      logQuery("INSERT facturas_pagos_y_saldos", queryBridge, paramsBridge, rB);
      insertedBridge += 1;
    }

    log("[BRIDGE] Inserciones completadas", { insertedBridge });

    // ============================================================
    // 9) UPDATE facturas -> saldo = 0
    // ============================================================
    let updatedFacturas = 0;

    for (const f of facturas || []) {
      const id_factura = String(f.id_factura);

      diferencia = diferencia / 100;
      const paramsUF = [diferencia, id_factura];
      log("[FACTURA] UPDATE saldo=0 (params)", { id_factura, diferencia });

      const rUF = await executeQuery(queryUpdateFactura, paramsUF);
      logQuery("UPDATE facturas", queryUpdateFactura, paramsUF, rUF);

      updatedFacturas += 1;
    }

    log("[FACTURA] Updates completados", { updatedFacturas });

    // ============================================================
    // 10) UPDATE saldos_a_favor -> restar lo insertado en pagos (por id_saldo)
    // ============================================================
    let updatedSaldos = 0;

    for (const [id_saldo, centsToSub] of restarPorSaldoCents.entries()) {
      const montoSub = fromCents(centsToSub);

      const paramsUS = [montoSub, id_saldo];

      log("[SALDO] UPDATE saldos_a_favor restar (params)", {
        id_saldo,
        restar: montoSub,
      });

      const rUS = await executeQuery(queryUpdateSaldoAFavor, paramsUS);
      logQuery("UPDATE saldos_a_favor", queryUpdateSaldoAFavor, paramsUS, rUS);

      updatedSaldos += 1;
    }

    log("[SALDO] Updates completados", { updatedSaldos });

    return res.status(200).json({
      ok: true,
      facturas,
      totals: {
        total_facturas: fromCents(totalFacturasCents),
        total_aplicado: fromCents(totalAplicadoCents),
        total_items: fromCents(totalItemsCents),
        total_item_cap: fromCents(totalItemCapCents),
      },
      credito_a_factura,
      credito_a_item,
    });
  } catch (error) {
    console.error("[ERROR] asignarFacturaPagos", error);
    return res
      .status(500)
      .json({ error: "algo salio mal", details: error?.message });
  }
};

const filtrarFacturas = async (req, res) => {
  const { estatusFactura, id_factura, id_cliente, cliente, uuid, rfc } =
    req.body;
  try {
    console.log(estatusFactura);
    const result = await executeSP("sp_filtrar_facturas", [
      estatusFactura || null,
      id_factura || null,
      id_cliente || null,
      cliente || null,
      uuid || null,
      rfc || null,
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
  console.log("😁😁😁😁😁😁😁😁😁😁🤣🤣🤣🤣🤣");

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
        let generador = rowFactura.usuario_creador;
        let origen = 0;
        if (!rowFactura.usuario_creador) {
          generador = rowFactura.id_agente;
          origen = 1;
        }

        console.log("😁😁😁😁😁😁😁😁😁😁🤣🤣🤣🤣🤣", rowFactura);
        console.log("😁😁😁😁😁😁😁😁😁😁🤣🤣🤣🤣🤣, generados", generador);
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
  getfacturasPagoPendienteByAgente,
  updateDocumentosFacturas,
  getFacturasDetalles,
};

//ya quedo "#$%&/()="
