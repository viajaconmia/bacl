/**
 * Genera una imagen PNG de una cotización de hotel usando Puppeteer
 * @async
 * @function generarImagenHotel
 * @param {Object} data - Datos del hotel a incluir en la cotización
 * @param {string} data.hotel - Nombre del hotel
 * @param {string} data.subtotal - Precio sin impuestos por noche
 * @param {string} data.total - Precio con impuestos por noche
 * @param {boolean} data.desayuno - Indica si el desayuno está incluido
 * @param {string} data.direccion - Dirección del hotel
 * @returns {Promise<Buffer>} Buffer PNG con la imagen de la cotización generada
 * @description
 * Esta función es utilizada internamente por `generarYSubirImagenHotel` para:
 * 1. Crear un documento HTML con los datos de la cotización del hotel
 * 2. Renderizar el HTML a través de Puppeteer (headless browser)
 * 3. Capturar una screenshot en formato PNG
 * 4. Retornar el buffer de la imagen para ser subida a S3
 *
 * El flujo completo es:
 * generarYSubirImagenHotel() → generarImagenHotel() → subirBufferAS3()
 *
 * @example
 * const buffer = await generarImagenHotel({
 *   hotel: "Hotel Premium",
 *   subtotal: "150.00",
 *   total: "180.00",
 *   desayuno: true,
 *   direccion: "Calle Principal 123"
 * });
 */
const puppeteer = require("puppeteer");
const { subirBufferAS3 } = require("./subir-imagen");

async function generarImagenHotel(data) {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"], // por si estás en server
  });

  const page = await browser.newPage();

  const html = `
<div style="
    width: 800px;
    font-family: Arial, sans-serif;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    box-shadow: 0 10px 25px rgba(0,0,0,0.08);
  ">

    <!-- HEADER -->
    <div style="
      background: #0b5fa5;
      color: white;
      padding: 16px 20px;
      font-size: 18px;
      font-weight: bold;
      letter-spacing: 1px;
    ">
      HOSPEDAJE 2026
    </div>

    <!-- CONTENT -->
    <div style="">

      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">

        <tr>
          <td style="padding: 8px; border:1px solid #000; background-color:#ddddff"><b>HOTEL:</b></td>
          <td style="padding: 8px; border:1px solid #000; text-align:center;">
            <b>${data.hotel || ""}</b>
          </td>
        </tr>

        <tr>
          <td style="padding: 8px; border:1px solid #000; background-color:#ddddff"><b>HABITACIÓN:</b></td>
          <td style="padding: 8px; border:1px solid #000; text-align:center;">SENCILLA</td>
        </tr>

        <tr>
          <td style="padding: 8px; border:1px solid #000; background-color:#ddddff"><b>SUBTOTAL:</b></td>
          <td style="padding: 8px; border:1px solid #000; text-align:center;display:flex; gap:16px;">
            <p style = "">$ ${data.subtotal || ""}</p>
              
                    <p style="">
            Precio sin impuestos por noche
          </p>
            </td>
        </tr>

        <tr>
          <td style="padding: 8px; border:1px solid #000; background-color:#ddddff"><b>PRECIO TOTAL:</b></td>
          <td style="padding: 8px; border:1px solid #000; text-align:center;display:flex;gap:16px;">
            <p style = "">$ ${data.total || ""}</p>
              
                    <p style="">
            Precio con impuestos por noche
          </p>
            </td>
        </tr>

        <tr>
          <td style="padding: 8px; border:1px solid #000; background-color:#ddddff"><b>DESAYUNO INCLUIDO:</b></td>
          <td style="padding: 8px; border:1px solid #000; text-align:center;">
            ${data.desayuno ? "SI" : "NO"}
          </td>
        </tr>

        <tr>
          <td style="padding: 8px; border:1px solid #000; background-color:#ddddff"><b>DIRECCIÓN:</b></td>
          <td style="padding: 8px; border:1px solid #000; text-align:center;">
            ${data.direccion || ""}
          </td>
        </tr>

      </table>

    </div>
    <div style="
      background: #00a3c4;
      padding: 10px 20px;
      color: #222;
      font-weight: bold;
      font-size: 14px;
    ">
      Tarifa no reembolsable
    </div>
  </div>
  `;

  await page.setViewport({ width: 820, height: 400 });

  await page.setContent(html, {
    waitUntil: "networkidle0",
  });

  const buffer = await page.screenshot({
    type: "png",
  });

  await browser.close();

  return buffer;
}

/**
 * Genera una imagen PNG de una cotización de hotel usando Puppeteer
 * @async
 * @function generarImagenHotel
 * @param {Object} data - Datos del hotel a incluir en la cotización
 * @param {string} data.hotel - Nombre del hotel
 * @param {string} data.id - id unico del hotel
 * @param {string} data.subtotal - Precio sin impuestos por noche
 * @param {string} data.total - Precio con impuestos por noche
 * @param {boolean} data.desayuno - Indica si el desayuno está incluido
 * @param {string} data.direccion - Dirección del hotel
 * @returns {Promise<Buffer>} Buffer PNG con la imagen de la cotización generada
 *
 * @example
 * const buffer = await generarImagenHotel({
 *   hotel: "Hotel Premium",
 *   subtotal: "150.00",
 *   total: "180.00",
 *   desayuno: true,
 *   direccion: "Calle Principal 123"
 * });
 */
async function generarYSubirImagenHotel(hotel) {
  const buffer = await generarImagenHotel(hotel);
  const key = `hoteles/${hotel.id}-${Date.now()}/cotizacion.png`;
  const url = await subirBufferAS3(buffer, key);
  return url;
}

module.exports = { generarImagenHotel, generarYSubirImagenHotel };
