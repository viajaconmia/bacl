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
    "Inicio del proceso de creación de factura combinada",
  );
  try {
    const resp = await model.createFacturaCombinada(req, req.body);
    req.context.logStep("resultado del model.createFacturaCombinada");
    console.log(resp);
    return res.status(201).json(resp.data.data);
  } catch (error) {
    console.log("ERROR MANEJADO");
    console.log(error?.details?.response?.data?.ModelState || null);
    console.log(error?.response?.data?.ModelState || null);
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

const resumenFacturasCxC = async (req, res) => {
  try {
    const data = await model.getResumenFacturasCxC();
    res.status(200).json(data);
  } catch (error) {
    console.error("Error resumenFacturasCxC:", error);
    res.status(500).json({ error: "Error al obtener resumen de cuentas por cobrar" });
  }
};

const detalleFacturasCxC = async (req, res) => {
 try {
    const {
      bucket = "all",
      id_agente = null,
      fecha_vencimiento_inicio = null,
      fecha_vencimiento_fin = null,
    } = req.body || {};

    const response = await model.getDetalleFacturasCxC({
      bucket,
      id_agente,
      fecha_vencimiento_inicio,
      fecha_vencimiento_fin,
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error en postDetalleFacturasCxC:", error);
    return res.status(500).json({
      message: "Error al obtener el detalle de facturas",
      error: error.message,
    });
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
      data: {
        tipo_origen: "factura",
        id_origen: ids,
        pagos,
        saldos,
        reservas,
      },
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
    "Iniciando creación de factura desde carga",
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
        "Error al crear factura desde carga",
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

  if (!Array.isArray(itemsArray) || itemsArray.length === 0) {
    return res
      .status(400)
      .json({ error: "El campo 'items' debe ser un array con elementos" });
  }

  // Helpers para DECIMAL (evita float issues)
  const toDecimal2String = (value) => {
    // acepta number o string; convierte a string con 2 decimales
    const n = Number(value);
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
  };

  try {
    // --- Queries ---
    const updateItems = `
      UPDATE items
      SET id_factura = ?,
          is_facturado = 1
      WHERE id_item = ?;
    `;

    const insertItemFactura = `
      INSERT INTO items_facturas (id_factura, id_item, monto)
      VALUES (?, ?, ?);
    `;

    const updateFactura = `
      UPDATE facturas
      SET saldo = ?
      WHERE id_factura = ?;
    `;

    // Bloquea la fila de factura para evitar carreras
    const saldo_factura = await executeQuery(
      `select saldo from facturas where id_factura = ? FOR UPDATE;`,
      [id_factura],
    );

    if (!saldo_factura?.length) {
      await executeQuery("ROLLBACK;");
      return res
        .status(404)
        .json({ error: "Factura no encontrada", id_factura });
    }

    let suma_total_items = 0;

    for (const item of itemsArray) {
      // total del item (o monto que quieras registrar)
      const totalItemNum = Number(item.total);
      if (!Number.isFinite(totalItemNum) || totalItemNum <= 0) {
        await executeQuery("ROLLBACK;");
        return res.status(400).json({
          error: "Cada item debe traer un total numérico > 0",
          item,
        });
      }

      const montoDecimalStr = toDecimal2String(totalItemNum);
      suma_total_items += totalItemNum;

      // 1) UPDATE items
      await executeQuery(updateItems, [id_factura, item.id_item]);

      // 2) INSERT items_facturas con monto DECIMAL
      //    Nota: pasar string "972.92" es lo más seguro para DECIMAL en MySQL
      await executeQuery(insertItemFactura, [
        id_factura,
        item.id_item,
        montoDecimalStr,
      ]);
    }

    const saldoActualNum = Number(saldo_factura[0].saldo);
    const nuevo_saldo = saldoActualNum - suma_total_items;

    if (nuevo_saldo < 0) {
      await executeQuery("ROLLBACK;");
      // respeta tu ShortError si quieres, aquí lo dejo directo:
      return res
        .status(400)
        .json({ error: "El saldo de la factura no puede ser negativo" });
    }

    await executeQuery(updateFactura, [
      toDecimal2String(nuevo_saldo),
      id_factura,
    ]);

    await executeQuery("COMMIT;");

    return res.status(200).json({
      message: "Items asignados correctamente a la factura",
      data: "Factura asociada: " + id_factura,
      total_asignado: toDecimal2String(suma_total_items),
      nuevo_saldo: toDecimal2String(nuevo_saldo),
    });
  } catch (error) {
    try {
      await executeQuery("ROLLBACK;");
    } catch (_) {}

    return res.status(500).json({
      error: "Error al asignar items a la factura",
      details: error.message || error,
      otherDetails: error.response?.data || null,
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
          `[LINK] No hay donador para meter 1 centavo en FACTURA ${id_factura} con saldo ${id_saldo}`,
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
          `[LINK] No hay item/donador para meter 1 centavo en ITEMS de FACTURA ${id_factura} con saldo ${id_saldo}`,
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
      Array.from(finalSetFactura.entries()).map(([f, s]) => [f, Array.from(s)]),
    );
    log(
      "[LINK] sets FINAL items",
      Array.from(finalSetItems.entries()).map(([f, s]) => [f, Array.from(s)]),
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
      0,
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
      0,
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
      0,
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
      0,
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
      })),
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
      })),
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
        briefLocal(credito_a_factura, 50),
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
      briefLocal(Array.from(itemToHospedaje.entries()), 20),
    );

    // hospedajes únicos (de credito_a_item)
    const hospedajesUnicos = [
      ...new Set(
        (credito_a_item || [])
          .map((row) => itemToHospedaje.get(String(row.id_item)))
          .filter(Boolean)
          .map(String),
      ),
    ];
    log("[PAGOS] hospedajesUnicos", hospedajesUnicos);

    // id_hospedaje -> id_servicio (vw_reservas_client)
    const hospToServicio = new Map();
    if (hospedajesUnicos.length) {
      const phHosp = hospedajesUnicos.map(() => "?").join(",");
      const queryVistaReservas = `
    SELECT id_relacion as id_hospedaje, id_servicio
    FROM vw_new_reservas
    WHERE id_relacion IN (${phHosp});
  `;
      const rowsVista = await executeQuery(
        queryVistaReservas,
        hospedajesUnicos,
      );
      logQuery(
        "SELECT vw_reservas_client",
        queryVistaReservas,
        hospedajesUnicos,
        rowsVista,
      );

      for (const r of rowsVista || []) {
        const h = String(r.id_hospedaje);
        const s = r.id_servicio ? String(r.id_servicio) : null;
        if (!hospToServicio.has(h) && s) hospToServicio.set(h, s);
      }
    }
    log(
      "[PAGOS] hospToServicio (preview)",
      briefLocal(Array.from(hospToServicio.entries()), 20),
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
        rowsSaldoInfo,
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
      briefLocal(Array.from(saldoInfoById.entries()), 10),
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
  const {
    estatusFactura,
    id_factura,
    id_cliente,
    cliente,
    uuid,
    rfc,
    page = null,
    length = null,
    startDate = null,
    endDate = null,
  } = req.body;
  try {
    const result = await executeQuery(
      "Call sp_filtrar_facturas(?, ?, ?, ?, ?, ?, ?, ?,?,?)",
      [
        estatusFactura || null,
        id_factura || null,
        id_cliente || null,
        cliente || null,
        uuid || null,
        rfc || null,
        page,
        length,
        startDate,
        endDate,
      ],
    );

    if (result[0].length == 0) {
      return res.status(404).json({
        message: "No se encontraron facturas con el parametro deseado",
      });
    }
    return res.status(200).json({
      message: "Facturas filtradas correctamente",
      data: result[0],
      metadata: result[1] ? result[1][0] : null, // Asumiendo que el SP devuelve metadata en el segundo result set
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
    "Inicio del proceso de creación de factura (emi)",
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
        : (impuestos ?? 0);

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
      0,
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
      "📦 recibido getFullDetalles (normalizando id_buscar a JSON array)",
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

    const sets = await executeSP2(
      "sp_get_conexion_full",
      [id_agente, tipo, id_buscar_json],
      { allSets: true },
    );

    const safe = (i) => (Array.isArray(sets?.[i]) ? sets[i] : []);

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

//const response = await model.cancelarCfdi(id_cfdi, motive, type);
//Hacer validacion der que tenga id_facturama
const getQuitarDetalles = async (req, res) => {
  try {
    console.log("📦 recibido getQuitarDetalles");

    const id_factura = String(
      req.query.id_factura ?? req.body?.id_factura ?? "",
    ).trim();

    if (!id_factura) {
      return res.status(400).json({
        ok: false,
        message: "Se requiere id_factura",
      });
    }

    const deleteItemsFacturasSQL = `
      DELETE FROM items_facturas
      WHERE id_factura = ?
    `;

    const updateItemsSQL = `
      UPDATE items
      SET id_factura = ""
      WHERE id_factura = ?
    `;

    const deleteSaldos = ` DELETE FROM facturas_pagos_y_saldos
      WHERE id_factura = ?
    `;

    return await runTransaction(async (connection) => {
      // 1) Elimina relaciones/detalles
      const [del] = await connection.query(deleteItemsFacturasSQL, [
        id_factura,
      ]);
      const [delsaldos] = await connection.query(deleteSaldos, [id_factura]);

      // 2) Vacía id_factura en items
      const [upd] = await connection.query(updateItemsSQL, [id_factura]);

      return res.status(204).json({
        ok: true,
        message: "Detalles quitados correctamente",
        data: {
          id_factura,
          deleted_items_facturas: del?.affectedRows ?? 0,
          updated_items: upd?.affectedRows ?? 0,
          delet_saldos: delsaldos?.affectedRows ?? 0,
        },
      });
    });
  } catch (error) {
    console.error("getQuitarDetalles error:", error);
    return res.status(500).json({
      ok: false,
      message: "Error en el servidor",
      details: error?.message ?? error,
    });
  }
};

module.exports = { getFullDetalles };

const getDetallesConexionesFactura = async (req, res) => {
  const { id_factura, id_agente } = req.query;
  try {
    const [pagos = [], reservas = []] = await executeSP2(
      "sp_get_detalles_conexion_fcaturas",
      [id_agente, id_factura],
      { allSets: true },
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
// Normaliza: minúsculas, sin acentos, sin dobles espacios, etc.
function normalizeEstado(s) {
  return String(s ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // quita zero-width
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/\s+/g, " ");
}

function getCiudad(locationStr) {
  const raw = String(locationStr ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // quita zero-width
    .trim();

  if (!raw) return raw;

  // Caso típico: "Mexico City, Distrito Federal, Mexico (MEX/MMMX ...)"
  const commaIdx = raw.indexOf(",");
  if (commaIdx !== -1) return raw.slice(0, commaIdx).trim();

  // Fallback: "Cancún (CUN/MMUN ...)" (sin comas)
  const parenIdx = raw.indexOf("(");
  if (parenIdx !== -1) return raw.slice(0, parenIdx).trim();

  return raw; // si no hay comas ni paréntesis, ya es "ciudad"
}

const CLAVE_ESTADOS = {
  aguascalientes: "AGS",
  "distrito federal": "CDMX",
  df: "CDMX",
  aguascalientes: "AGS",

  "baja california": "BC",
  "baja california norte": "BC",
  "baja california sur": "BCS",
  campeche: "CAMP",
  chiapas: "CHIS",
  chihuahua: "CHIH",
  "ciudad de mexico": "CDMX",
  cdmx: "CDMX",
  coahuila: "COAH",
  colima: "COL",
  durango: "DGO",
  guanajuato: "GTO",
  guerrero: "GRO",
  hidalgo: "HGO",
  jalisco: "JAL",
  mexico: "EDO MÉXD",
  "estado de mexico": "EDO MÉXD",
  michoacan: "MICH",
  morelos: "MOR",
  nayarit: "NAY",
  "nuevo leon": "NL",
  oaxaca: "OAX",
  puebla: "PUE",
  queretaro: "QRO",
  "quintana roo": "Q ROOF",
  "san luis potosi": "SLP",
  sinaloa: "SIN",
  sonora: "SON",
  tabasco: "TAB",
  tamaulipas: "TAMPS",
  tlaxcala: "TLAX",
  veracruz: "VER",
  yucatan: "YUC",
  zacatecas: "ZAC",
};

// Si ya viene como clave, la deja; si viene como nombre, la convierte
const VALID_KEYS = new Set([
  "AGS",
  "BC",
  "BCS",
  "CAMP",
  "CHIS",
  "CHIH",
  "CDMX",
  "COAH",
  "COL",
  "DGO",
  "GTO",
  "GRO",
  "HGO",
  "JAL",
  "EDO MEXD",
  "MICH",
  "MOR",
  "NAY",
  "NL",
  "OAX",
  "PUE",
  "QRO",
  "Q ROOF",
  "SLP",
  "SIN",
  "SON",
  "TAB",
  "TAMPS",
  "TLAX",
  "VER",
  "YUC",
  "ZAC",
]);

function mapEstadoToClave(estado_reserva) {
  const raw = String(estado_reserva ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
  if (!raw) return raw;

  if (VALID_KEYS.has(raw)) return raw; // ya es clave exacta
  const norm = normalizeEstado(raw);
  return CLAVE_ESTADOS[norm] ?? raw; // si no encuentra, deja lo original
}

function getEstadoClaveFromLocation(locationStr) {
  const raw = String(locationStr ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();

  if (!raw) return raw;

  // Quita paréntesis para parsear comas sin ruido
  const noParen = raw.replace(/\s*\([^)]*\)\s*/g, "").trim();

  // Split por comas: "Ciudad, Estado, País"
  const parts = noParen
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  // 1) Caso normal: "Ciudad, Estado, Mexico ..."
  if (parts.length >= 2) {
    return mapEstadoToClave(parts[1]); // <- Estado (2º segmento)
  }

  // 2) Si no hay comas (ej. solo nombre aeropuerto), intenta inferir por IATA
  // Formato típico: "(MEX/MMMX ...)" o "(NLU/MMSM)"
  const iata = (raw.match(/\(([A-Z]{3})\//) || [])[1];

  // Mapea IATA -> CLAVE_ESTADO (pon aquí los que uses más)
  const AIRPORT_STATE_BY_IATA = {
    MEX: "CDMX",
    NLU: "EDO MÉXD",
    MTY: "NL",
    QRO: "QRO",
    GDL: "JAL",
    CUN: "Q ROOF",
    TIJ: "BC",
    SJD: "BCS",
    PVR: "JAL",
  };

  if (iata && AIRPORT_STATE_BY_IATA[iata]) return AIRPORT_STATE_BY_IATA[iata];

  // 3) Último fallback: intenta mapear usando TODO el texto (si trae algo tipo "Nuevo Leon")
  // (Evita agarrar "Mexico" país: tu mapEstadoToClave sólo convierte si coincide con un estado)
  const clave = mapEstadoToClave(noParen);
  return clave;
}

function getCodigoConfirmacionBase(codigo_confirmacion) {
  const raw = String(codigo_confirmacion ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();

  if (!raw) return raw;

  // Solo aplica si empieza con HJK (case-insensitive). Si no, lo deja igual.
  if (/^HJK/i.test(raw)) {
    // "HJK11497-YH58PG" -> "HJK11497"
    return raw.split("-")[0].trim();
  }

  return raw;
}

function toYMD(value) {
  if (value === undefined || value === null) return value;

  // Si MySQL/driver te lo da como Date
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const mo = String(value.getUTCMonth() + 1).padStart(2, "0");
    const da = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }

  const raw = String(value).trim();
  if (!raw) return raw;

  // "2026-02-27T06:00:00.000Z" -> "2026-02-27"
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

const agentes_report_fac = async (req, res) => {
  const { id_agente, fecha_desde, fecha_hasta } = req.query;

  try {
    if (!id_agente) {
      throw new ShortError("No se encontro el id de agente", 404);
    }

    // Normaliza fechas: si no vienen o vienen vacías -> null
    const normalizeDate = (v) => {
      if (v === undefined || v === null) return null;
      const s = String(v).trim();
      return s.length ? s : null; // espera formato YYYY-MM-DD
    };

    const p_fecha_desde = normalizeDate(fecha_desde);
    const p_fecha_hasta = normalizeDate(fecha_hasta);

    // ⚠️ Importante: ahora tu SP recibe 3 params (id_agente, fecha_desde, fecha_hasta)
    const facturas = await executeSP("sp_facturas_agente_reservas", [
      id_agente,
      p_fecha_desde,
      p_fecha_hasta,
    ]);
    const facturasConClave = (Array.isArray(facturas) ? facturas : []).map(
      (row) => {
        const origen_estado = getEstadoClaveFromLocation(row.origen);
        const destino_estado = getEstadoClaveFromLocation(row.destino);

        const estado_reserva_original = mapEstadoToClave(row.estado_reserva);
        const estado_reserva_ruta =
          [origen_estado, destino_estado].filter(Boolean).join("-") ||
          estado_reserva_original;

        // ❌ no mandar columnas redundantes
        const { origen, destino, ...rest } = row;

        return {
          ...rest,

          // ✅ solo estas fechas sin hora
          chin: toYMD(row.chin),
          chout: toYMD(row.chout),

          // ✅ confirmación base
          codigo_confirmacion_base: getCodigoConfirmacionBase(
            row.codigo_confirmacion,
          ),

          // ✅ estados
          origen_estado,
          destino_estado,
          estado_reserva: estado_reserva_ruta,
        };
      },
    );

    res.status(200).json({
      message: "Facturas del agente obtenidas correctamente.",
      data: facturasConClave,
    });
  } catch (error) {
    req.context.logStep("Error en sp_facturas_agente_reservas:", error);
    res.status(500).json({
      error,
      message: error.message || "Error al obtener facturas",
      data: null,
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
  getQuitarDetalles,
  agentes_report_fac,
  detalleFacturasCxC,
  resumenFacturasCxC,
};

//ya quedo "#$%&/()="
