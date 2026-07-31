/**
 * Formatters + template HTML para el correo de aviso de dispersión creada.
 * Sin DB ni I/O — recibe datos ya resueltos por dispersion.service.js.
 */

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getUTCFullYear()}`;
};

const fmtMoney = (value) => {
  if (value == null) return "";
  const str = typeof value === "number" ? value.toFixed(2) : String(value).trim();
  if (!str) return "";
  const [intPart, decPart] = str.split(".");
  const reversed = intPart.split("").reverse().join("");
  let fmt = "";
  for (let i = 0; i < reversed.length; i++) {
    if (i > 0 && i % 3 === 0) fmt += ",";
    fmt += reversed[i];
  }
  const formattedInt = fmt.split("").reverse().join("");
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
};

/**
 * @param {object} params
 * @param {string} params.idDispersion
 * @param {object[]} params.solicitudesProcesadas - [{ id_solicitud_proveedor, id_proveedor_cuenta, monto_dispersar, ... }]
 * @param {object[]} params.reservas - filas de reservasService.getAll({ids}).rows
 * @param {object[]} params.cuentas - filas de cuentasService.getByIds(idsCuentas)
 * @returns {{ subject: string, html: string }}
 */
const buildDispersionEmail = ({ idDispersion, solicitudesProcesadas, reservas, cuentas }) => {
  const reservasMap = new Map(reservas.map((r) => [Number(r.id_solicitud_proveedor), r]));
  const cuentasMap = new Map(cuentas.map((c) => [Number(c.id), c]));
  const nombreProveedor = reservas.length > 0 ? (reservas[0].intermediario ?? reservas[0].proveedor) : null;

  let totalCosto = 0;
  let totalVenta = 0;
  let totalDispersado = 0;

  const filas = solicitudesProcesadas
    .map((s, i) => {
      const r = reservasMap.get(Number(s.id_solicitud_proveedor));
      if (!r) return "";

      const costo = Number(r.costo_total ?? 0);
      const venta = Number(r.total ?? 0);
      const montoDispersar = Number(s.monto_dispersar ?? 0);
      totalCosto += costo;
      totalVenta += venta;
      totalDispersado += montoDispersar;

      const markupPct = costo > 0 ? (((venta - costo) / venta) * 100).toFixed(2) + "%" : "—";
      const bg = i % 2 === 0 ? "#f9fafb" : "#fff";
      const cuenta = cuentasMap.get(Number(s.id_proveedor_cuenta));
      const nombreProveedorFila = r.intermediario ?? r.proveedor;

      return `
        <tr style="background: ${bg};">
          <td style="padding: 8px 10px; color: #111827;">${r.cliente ?? "—"}</td>
          <td style="padding: 8px 10px; color: #111827;">${nombreProveedorFila ?? "—"}</td>
          <td style="padding: 8px 10px; color: #111827;">${r.codigo_confirmacion ?? "—"}</td>
          <td style="padding: 8px 10px; color: #111827;">${fmtDate(r.check_in)}</td>
          <td style="padding: 8px 10px; color: #111827;">${fmtDate(r.check_out)}</td>
          <td style="padding: 8px 10px; color: #111827;">$${fmtMoney(costo)}</td>
          <td style="padding: 8px 10px; color: #111827;">$${fmtMoney(venta)}</td>
          <td style="padding: 8px 10px; color: #111827;">${markupPct}</td>
          <td style="padding: 8px 10px; color: #111827;">$${fmtMoney(montoDispersar)}</td>
          <td style="padding: 8px 10px; color: #111827;">${cuenta?.banco ?? "—"}</td>
          <td style="padding: 8px 10px; color: #111827;">${cuenta?.titular ?? "—"}</td>
          <td style="padding: 8px 10px; color: #111827; min-width: 200px; white-space: nowrap;">${cuenta?.cta ?? "—"}</td>
        </tr>
      `;
    })
    .join("");

  const totalMarkupPct =
    totalCosto > 0 ? (((totalVenta - totalCosto) / totalVenta) * 100).toFixed(2) + "%" : "—";

  const totalesHtml = `
    <tr style="background: #deebff; font-weight: bold; border-top: 2px solid #0b5fa5;">
      <td colspan="5" style="padding: 8px 10px; color: #0b5fa5;">Total</td>
      <td style="padding: 8px 10px; color: #0b5fa5;">$${fmtMoney(totalCosto)}</td>
      <td style="padding: 8px 10px; color: #0b5fa5;">$${fmtMoney(totalVenta)}</td>
      <td style="padding: 8px 10px; color: #0b5fa5;">${totalMarkupPct}</td>
      <td style="padding: 8px 10px; color: #0b5fa5;">$${fmtMoney(totalDispersado)}</td>
      <td colspan="3" style="padding: 8px 10px;"></td>
    </tr>
  `;

  const subject = `Nueva dispersión creada: ${idDispersion}${nombreProveedor ? ` | ${nombreProveedor}` : ""}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; background: #fff;">
      <div style="background: #deebff; padding: 28px 24px 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <img src="https://luiscastaneda-tos.github.io/log/files/mia.png" alt="MIA" style="max-height: 56px; margin-bottom: 14px; display: block; margin-left: auto; margin-right: auto;" />
        <h2 style="color: #0b5fa5; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.3px;">Nueva solicitud de dispersión de pago</h2>
      </div>
      <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #deebff;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
          <tr style="background: #deebff;">
            <td style="padding: 8px 12px; font-weight: bold; color: #0b5fa5; width: 40%;">Codigo de Dispersión</td>
            <td style="padding: 8px 12px; color: #111827;">${idDispersion}</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 8px 12px; font-weight: bold; color: #374151;">Total solicitudes de pago</td>
            <td style="padding: 8px 12px; color: #111827;">${solicitudesProcesadas.length}</td>
          </tr>
          <tr style="background: #deebff;">
            <td style="padding: 8px 12px; font-weight: bold; color: #0b5fa5;">Monto total a dispersar</td>
            <td style="padding: 8px 12px; color: #111827; font-weight: bold;">$${fmtMoney(totalDispersado)} MXN</td>
          </tr>
        </table>

        <h3 style="font-size: 14px; color: #0b5fa5; margin: 0 0 12px 0; font-weight: 700;">Detalle de reservas</h3>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #0b5fa5; color: #fff;">
                <th style="padding: 8px 10px; text-align: left;">Cliente</th>
                <th style="padding: 8px 10px; text-align: left;">Proveedor</th>
                <th style="padding: 8px 10px; text-align: left;">Confirmación</th>
                <th style="padding: 8px 10px; text-align: left;">Check-in</th>
                <th style="padding: 8px 10px; text-align: left;">Check-out</th>
                <th style="padding: 8px 10px; text-align: left;">Costo</th>
                <th style="padding: 8px 10px; text-align: left;">Venta</th>
                <th style="padding: 8px 10px; text-align: left;">Markup</th>
                <th style="padding: 8px 10px; text-align: left;">A dispersar</th>
                <th style="padding: 8px 10px; text-align: left;">Banco</th>
                <th style="padding: 8px 10px; text-align: left;">Titular</th>
                <th style="padding: 8px 10px; text-align: left; min-width: 200px;">Cuenta</th>
              </tr>
            </thead>
            <tbody>
              ${filas || '<tr><td colspan="12" style="padding: 12px; color: #6b7280;">Sin reservas encontradas</td></tr>'}
              ${filas ? totalesHtml : ""}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  return { subject, html };
};

module.exports = { fmtDate, fmtMoney, buildDispersionEmail };
