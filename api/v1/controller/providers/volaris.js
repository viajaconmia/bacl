const volarisService = require("../services/providers/volaris");

function mask(s, left = 2, right = 1) {
  if (!s) return "";
  const t = String(s);
  if (t.length <= left + right) return "*".repeat(t.length);
  return t.slice(0, left) + "*".repeat(t.length - left - right) + t.slice(-right);
}

const lookupBookingByPNR = async (req, res) => {
  try {
    const recordLocator = String(req.body.recordLocator || "").trim().toUpperCase();
    const lastName = String(req.body.lastName || "").trim();

    if (!recordLocator || recordLocator.length < 5) {
      return res.status(400).json({ ok: false, error: "recordLocator inválido" });
    }
    if (!lastName || lastName.length < 2) {
      return res.status(400).json({ ok: false, error: "lastName inválido" });
    }

    // Debug solo si mandas header y coincide con tu env
    const debugAllowed =
      !!req.headers["x-debug-key"] &&
      !!process.env.INTERNAL_DEBUG_KEY &&
      req.headers["x-debug-key"] === process.env.INTERNAL_DEBUG_KEY;

    const r = await volarisService.lookupBooking(
      { recordLocator, lastName },
      { debugAllowed }
    );

    if (!r.ok) {
      return res.status(200).json({
        ok: false,
        status: "UNKNOWN",
        error: r.error,
        meta: {
          recordLocator: mask(recordLocator),
          lastName: mask(lastName, 1, 0),
          finalUrl: r.finalUrl || null,
          title: r.title || null,
          screenshotPath: r.screenshotPath || null,
          challenge: r.challenge || false,
        },
        debug: debugAllowed ? r.debug : undefined,
      });
    }

    return res.status(200).json({
      ok: true,
      status: "OK",
      data: r.data,
      meta: {
        recordLocator: mask(recordLocator),
        lastName: mask(lastName, 1, 0),
        finalUrl: r.finalUrl || null,
        title: r.title || null,
        screenshotPath: r.screenshotPath || null,
      },
      debug: debugAllowed ? r.debug : undefined,
    });
  } catch (error) {
    console.error("volaris.lookupBooking controller error:", error);
    return res.status(500).json({
      ok: false,
      error: "Internal Server Error",
      details: error.message,
    });
  }
};

module.exports = { lookupBookingByPNR };
