// app/api/booking/lookup/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import * as cheerio from "cheerio";
import { CookieJar, fetch as undiciFetch } from "undici";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  airlineCode: z.enum(["Y4", "AM", "VB"]), // Volaris, Aeromexico, Viva
  confirmationCode: z.string().min(4).max(12),
  passengerLastName: z.string().min(2).max(60),
  // opcional según aerolínea / debug
  flightNumber: z.string().optional().nullable(),
  departureDateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  debug: z.boolean().optional(),
});

type LookupInput = z.infer<typeof Schema>;

type NormalizedBooking = {
  airlineCode: "Y4" | "AM" | "VB";
  confirmationCode: string;
  passengerLastName: string;
  status?: string | null;
  passengers?: Array<{ name: string }>;
  segments?: Array<{
    origin?: string | null;
    destination?: string | null;
    flightNumber?: string | null;
    departureTime?: string | null;
    arrivalTime?: string | null;
  }>;
  baggage?: {
    included?: string | null;
    notes?: string | null;
  };
  raw?: {
    finalUrl?: string;
  };
};

function normalizeLastName(s: string) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * fetch con CookieJar (undici)
 */
async function jarFetch(
  jar: CookieJar,
  url: string,
  init?: RequestInit & { maxRedirections?: number }
) {
  const res = await undiciFetch(url, {
    ...init,
    // undici soporta dispatcher con CookieJar
    dispatcher: jar,
    // importante: simular navegador
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      "accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "es-MX,es;q=0.9,en;q=0.8",
      ...(init?.headers || {}),
    },
    redirect: "follow",
  } as any);

  const contentType = res.headers.get("content-type") || "";
  const bodyText = await res.text();
  return { res, contentType, bodyText, finalUrl: res.url };
}

/**
 * Extrae inputs hidden (csrf, tokens) de un HTML
 */
function extractHiddenInputs(html: string) {
  const $ = cheerio.load(html);
  const out: Record<string, string> = {};
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr("name");
    const value = $(el).attr("value") ?? "";
    if (name) out[name] = value;
  });
  return out;
}

/**
 * =========================
 * ADAPTERS POR AEROLÍNEA
 * =========================
 * Nota: los selectors/fields exactos cambian. Aquí va la estructura correcta.
 * Tú solo ajustas:
 *  - URL de landing de "manage booking"
 *  - campos del form
 *  - selectors del HTML resultado
 */

async function lookupVolaris(input: LookupInput): Promise<NormalizedBooking> {
  const jar = new CookieJar();

  // 1) GET landing (toma cookies + tokens)
  // Ajusta URL si tu flujo usa otra ruta (mytrips / manage booking)
  const landingUrl = "https://www.volaris.com/mytrips";
  const landing = await jarFetch(jar, landingUrl, { method: "GET" });

  const hidden = extractHiddenInputs(landing.bodyText);

  // 2) POST del formulario (esto es lo que debes ajustar)
  // Muchas webs usan endpoints internos; aquí ponemos un placeholder.
  // Tú lo encuentras abriendo DevTools > Network y copiando el request real.
  const postUrl = "https://www.volaris.com/mytrips"; // placeholder

  const form = new URLSearchParams();
  // Campos típicos (placeholder):
  form.set("confirmationCode", input.confirmationCode);
  form.set("lastName", normalizeLastName(input.passengerLastName));

  // Adjunta tokens hidden que existan
  for (const [k, v] of Object.entries(hidden)) form.set(k, v);

  const result = await jarFetch(jar, postUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "origin": "https://www.volaris.com",
      "referer": landingUrl,
    },
    body: form.toString(),
  });

  // 3) Parse HTML result
  const $ = cheerio.load(result.bodyText);

  // ⚠️ Estos selectors son ejemplos. Debes ajustarlos a lo que veas en el HTML real.
  const status =
    $(".booking-status").first().text().trim() ||
    $("*[data-testid='booking-status']").first().text().trim() ||
    null;

  const passengers: NormalizedBooking["passengers"] = [];
  $(".passenger-name, *[data-testid='passenger-name']").each((_, el) => {
    const name = $(el).text().trim();
    if (name) passengers.push({ name });
  });

  const segments: NormalizedBooking["segments"] = [];
  $(".segment, *[data-testid='segment']").each((_, el) => {
    const block = $(el);
    const origin = block.find(".origin, *[data-testid='origin']").first().text().trim() || null;
    const destination =
      block.find(".destination, *[data-testid='destination']").first().text().trim() || null;
    const flightNumber =
      block.find(".flight-number, *[data-testid='flight-number']").first().text().trim() || null;
    const departureTime =
      block.find(".departure-time, *[data-testid='departure-time']").first().text().trim() || null;
    const arrivalTime =
      block.find(".arrival-time, *[data-testid='arrival-time']").first().text().trim() || null;

    if (origin || destination || flightNumber) {
      segments.push({ origin, destination, flightNumber, departureTime, arrivalTime });
    }
  });

  // Baggage (ejemplo)
  const baggageIncluded =
    $(".baggage, *[data-testid='baggage']").first().text().trim() || null;

  return {
    airlineCode: "Y4",
    confirmationCode: input.confirmationCode,
    passengerLastName: input.passengerLastName,
    status,
    passengers: passengers.length ? passengers : undefined,
    segments: segments.length ? segments : undefined,
    baggage: baggageIncluded ? { included: baggageIncluded } : undefined,
    raw: { finalUrl: result.finalUrl },
  };
}

async function lookupViva(input: LookupInput): Promise<NormalizedBooking> {
  const jar = new CookieJar();

  const landingUrl = "https://www.vivaaerobus.com/en-us/manage/find-booking";
  const landing = await jarFetch(jar, landingUrl, { method: "GET" });
  const hidden = extractHiddenInputs(landing.bodyText);

  // Placeholder: debes capturar el endpoint real desde Network
  const postUrl = landingUrl;

  const form = new URLSearchParams();
  form.set("confirmationCode", input.confirmationCode);
  form.set("lastName", normalizeLastName(input.passengerLastName));
  for (const [k, v] of Object.entries(hidden)) form.set(k, v);

  const result = await jarFetch(jar, postUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://www.vivaaerobus.com",
      referer: landingUrl,
    },
    body: form.toString(),
  });

  const $ = cheerio.load(result.bodyText);
  const status =
    $(".booking-status").first().text().trim() ||
    $("*[data-testid='booking-status']").first().text().trim() ||
    null;

  return {
    airlineCode: "VB",
    confirmationCode: input.confirmationCode,
    passengerLastName: input.passengerLastName,
    status,
    raw: { finalUrl: result.finalUrl },
  };
}

async function lookupAeromexico(input: LookupInput): Promise<NormalizedBooking> {
  const jar = new CookieJar();

  // Aeroméxico a veces se mueve entre flujos (PNR vs ticket).
  // Aquí va estructura base.
  const landingUrl = "https://www.aeromexico.com/en-us/manage-your-booking";
  const landing = await jarFetch(jar, landingUrl, { method: "GET" });
  const hidden = extractHiddenInputs(landing.bodyText);

  const postUrl = landingUrl; // placeholder

  const form = new URLSearchParams();
  form.set("confirmationCode", input.confirmationCode);
  form.set("lastName", normalizeLastName(input.passengerLastName));
  for (const [k, v] of Object.entries(hidden)) form.set(k, v);

  const result = await jarFetch(jar, postUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://www.aeromexico.com",
      referer: landingUrl,
    },
    body: form.toString(),
  });

  const $ = cheerio.load(result.bodyText);
  const status =
    $(".booking-status").first().text().trim() ||
    $("*[data-testid='booking-status']").first().text().trim() ||
    null;

  return {
    airlineCode: "AM",
    confirmationCode: input.confirmationCode,
    passengerLastName: input.passengerLastName,
    status,
    raw: { finalUrl: result.finalUrl },
  };
}

export async function POST(req: Request) {
  const debugAllowed =
    !!req.headers.get("x-debug-key") &&
    !!process.env.INTERNAL_DEBUG_KEY &&
    req.headers.get("x-debug-key") === process.env.INTERNAL_DEBUG_KEY;

  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Bad request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;

    let data: NormalizedBooking;

    if (input.airlineCode === "Y4") data = await lookupVolaris(input);
    else if (input.airlineCode === "VB") data = await lookupViva(input);
    else data = await lookupAeromexico(input);

    // Si quieres debugging, devuelve un poco más (sin exponer HTML completo si no tienes control)
    if (input.debug && debugAllowed) {
      return NextResponse.json({ ok: true, data }, { status: 200 });
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}
