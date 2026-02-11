const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

// Cache simple TTL para no pegarle 10 veces al mismo PNR
const CACHE = new Map();
const TTL_MS = 60 * 1000;

function now() { return Date.now(); }

function normalizeLastName(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function cacheGet(key) {
  const it = CACHE.get(key);
  if (!it) return null;
  if (it.exp < now()) { CACHE.delete(key); return null; }
  return it.value;
}

function cacheSet(key, value) {
  CACHE.set(key, { exp: now() + TTL_MS, value });
}

function looksLikeHumanCheck(text) {
  const t = String(text || "").toLowerCase();
  return (
    t.includes("captcha") ||
    t.includes("verify you are human") ||
    t.includes("verifica que eres humano") ||
    t.includes("checking your browser") ||
    t.includes("access denied") ||
    t.includes("cloudfront") ||
    t.includes("bot")
  );
}

async function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
}

async function pickFirstLocator(frame, selectors, timeoutMs) {
  for (const sel of selectors) {
    const loc = frame.locator(sel).first();
    try {
      const count = await loc.count();
      if (count > 0) {
        // espera a que esté visible/enabled si aplica
        await loc.waitFor({ state: "visible", timeout: Math.min(5000, timeoutMs) }).catch(() => {});
        return { selector: sel, locator: loc };
      }
    } catch {}
  }
  return null;
}

async function clickIfExists(pageOrFrame, candidates, timeoutMs) {
  for (const c of candidates) {
    try {
      const loc = pageOrFrame.locator(c).first();
      if (await loc.count()) {
        await loc.click({ timeout: Math.min(3000, timeoutMs) });
        return c;
      }
    } catch {}
  }
  return null;
}

async function listInputsInFrames(page) {
  const out = [];
  for (const f of page.frames()) {
    const inputs = await f.$$eval("input", (els) =>
      els.map((e) => ({
        name: e.getAttribute("name"),
        id: e.id || null,
        type: e.getAttribute("type"),
        placeholder: e.getAttribute("placeholder"),
        ariaLabel: e.getAttribute("aria-label"),
        testid: e.getAttribute("data-testid"),
      }))
    ).catch(() => []);
    out.push({ frameUrl: f.url(), inputs });
  }
  return out;
}

function chooseBestFrame(frameInputsList) {
  // Elige el frame con más inputs
  let best = null;
  for (const item of frameInputsList) {
    const n = item.inputs?.length || 0;
    if (!best || n > best.n) best = { ...item, n };
  }
  return best && best.n > 0 ? best : null;
}

// Extrae datos sin asumir testids exactos.
// 1) intenta leer __NEXT_DATA__ (si existe)
// 2) si no, devuelve un resumen de texto
async function extractData(pageOrFrame) {
  return await pageOrFrame.evaluate(() => {
    function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

    const next = document.querySelector("#__NEXT_DATA__");
    const nextJson = next?.textContent ? safeParse(next.textContent) : null;

    const text = (document.body?.innerText || "").replace(/\s+\n/g, "\n").trim();
    const textPreview = text.slice(0, 2000);

    return {
      nextData: nextJson ? { hasNextData: true } : { hasNextData: false },
      // si quieres, luego podemos navegar dentro del JSON cuando sepamos la estructura real
      textPreview,
    };
  });
}

/**
 * lookupBooking:
 * - NO usa tokens
 * - Automatiza el flujo web normal
 * - Devuelve screenshot + debug para que identifiques qué HTML te está sirviendo
 */
async function lookupBooking({ recordLocator, lastName }, { debugAllowed } = { debugAllowed: false }) {
  const debug = [];
  const last = normalizeLastName(lastName);
  const key = `Y4:${recordLocator}:${last}`;

  const cached = cacheGet(key);
  if (cached) return { ok: true, data: cached, debug, finalUrl: null, title: null };

  const headless = process.env.PW_HEADLESS ? process.env.PW_HEADLESS === "1" : true;
  const timeoutMs = Number(process.env.PW_TIMEOUT_MS || 30000);
  const baseUrl = "https://www.volaris.com/mytrips";

  const screenshotDir = process.env.PW_SCREENSHOT_DIR
    ? process.env.PW_SCREENSHOT_DIR
    : path.join(process.cwd(), "pw_screens");

  await ensureDir(screenshotDir);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    locale: "es-MX",
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  const page = await context.newPage();

  let screenshotPath = null;
  let finalUrl = null;
  let title = null;

  try {
    // =========================
    // 1) GOTO + DIAGNÓSTICO
    // =========================
    const resp = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    finalUrl = page.url();
    title = await page.title().catch(() => null);

    debug.push({
      step: "goto",
      status: resp ? resp.status() : null,
      gotoUrl: resp ? resp.url() : null,
      finalUrl,
      title,
    });

    // esperar SPA/hidratación
    await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {});
    await page.waitForTimeout(1500);

    const html = await page.content();
    const challenge = looksLikeHumanCheck(html);

    screenshotPath = path.join(
      screenshotDir,
      `volaris_mytrips_${Date.now()}.png`
    );
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

    debug.push({
      step: "after_load",
      challenge,
      htmlHead: html.slice(0, 600),
      screenshotPath,
      frames: page.frames().map((f) => f.url()),
    });

    if (challenge) {
      return {
        ok: false,
        error: "Requiere verificación humana (captcha/challenge) o acceso denegado",
        debug,
        challenge: true,
        finalUrl,
        title,
        screenshotPath,
      };
    }

    // =========================
    // 2) Cookies banner (intento suave)
    // =========================
    await clickIfExists(page, [
      'button:has-text("Aceptar")',
      'button:has-text("Acepto")',
      'button:has-text("Accept")',
      '[aria-label*="accept" i]',
    ], timeoutMs);

    // =========================
    // 3) Inputs en frames
    // =========================
    const frameInputsList = await listInputsInFrames(page);
    if (debugAllowed) debug.push({ step: "frame_inputs", frameInputsList });

    const best = chooseBestFrame(frameInputsList);
    if (!best) {
      return {
        ok: false,
        error: "No se detectaron inputs en la página. Probable contenido bloqueado o UI no cargó.",
        debug,
        challenge: false,
        finalUrl,
        title,
        screenshotPath,
      };
    }

    // toma el frame real por URL
    const targetFrame = page.frames().find((f) => f.url() === best.frameUrl) || page.mainFrame();

    // =========================
    // 4) (Opcional) Pause solo si PW_PAUSE=1
    // =========================
    if (process.env.PW_PAUSE === "1") {
      await page.pause();
    }

    // =========================
    // 5) Encontrar inputs (SIN adivinar un name fijo)
    // =========================
    const locatorSel = [
      // record locator / código
      'input[name*="record" i]',
      'input[id*="record" i]',
      'input[placeholder*="código" i]',
      'input[placeholder*="codigo" i]',
      'input[aria-label*="código" i]',
      'input[aria-label*="codigo" i]',
      'input[placeholder*="record" i]',
    ];

    const lastSel = [
      // last name / apellido
      'input[name*="last" i]',
      'input[id*="last" i]',
      'input[placeholder*="apellido" i]',
      'input[aria-label*="apellido" i]',
      'input[name*="surname" i]',
      'input[id*="surname" i]',
    ];

    const foundRecord = await pickFirstLocator(targetFrame, locatorSel, timeoutMs);
    const foundLast = await pickFirstLocator(targetFrame, lastSel, timeoutMs);

    if (!foundRecord || !foundLast) {
      return {
        ok: false,
        error: "No pude identificar los inputs (recordLocator/lastName). Revisa screenshot y debug.",
        debug: debugAllowed ? [...debug, { step: "selector_fail", foundRecord, foundLast, bestFrame: best.frameUrl }] : debug,
        challenge: false,
        finalUrl,
        title,
        screenshotPath,
      };
    }

    // Fill
    await foundRecord.locator.fill(recordLocator, { timeout: timeoutMs });
    await foundLast.locator.fill(last, { timeout: timeoutMs });

    debug.push({
      step: "filled",
      recordSelector: foundRecord.selector,
      lastSelector: foundLast.selector,
      frameUrl: best.frameUrl,
    });

    // =========================
    // 6) Submit (botón)
    // =========================
    const submitCandidates = [
      'button[type="submit"]',
      'button:has-text("Buscar")',
      'button:has-text("Consultar")',
      'button:has-text("Continuar")',
      'button:has-text("Search")',
      'button:has-text("Continue")',
    ];

    const foundBtn = await pickFirstLocator(targetFrame, submitCandidates, timeoutMs);
    if (!foundBtn) {
      return {
        ok: false,
        error: "No encontré botón de submit. Revisa screenshot y debug.",
        debug,
        challenge: false,
        finalUrl,
        title,
        screenshotPath,
      };
    }

    await Promise.all([
      foundBtn.locator.click({ timeout: timeoutMs }),
      page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {}),
    ]);

    finalUrl = page.url();
    title = await page.title().catch(() => null);

    // Re-check challenge
    const html2 = await page.content();
    const challenge2 = looksLikeHumanCheck(html2);
    debug.push({ step: "after_submit", finalUrl, title, challenge: challenge2 });

    if (challenge2) {
      return {
        ok: false,
        error: "Después de enviar, apareció verificación humana (captcha/challenge) o bloqueo.",
        debug,
        challenge: true,
        finalUrl,
        title,
        screenshotPath,
      };
    }

    // =========================
    // 7) Extraer datos (genérico)
    // =========================
    const data = await extractData(targetFrame);

    // Validación mínima: si ni nextData ni texto trae, está raro
    if (!data || (!data.textPreview && !data.nextData)) {
      return {
        ok: false,
        error: "No se pudo extraer contenido (DOM vacío). Revisa screenshot.",
        debug,
        challenge: false,
        finalUrl,
        title,
        screenshotPath,
      };
    }

    cacheSet(key, data);

    return { ok: true, data, debug, finalUrl, title, screenshotPath };
  } catch (e) {
    return {
      ok: false,
      error: e?.message || "Error Playwright",
      debug,
      finalUrl,
      title,
      screenshotPath,
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

module.exports = { lookupBooking };
