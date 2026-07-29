const crypto = require("crypto");

/**
 * Genera un código de dispersión tipo "D" + 6-7 chars base36.
 * Puerto exacto de la función que usaba el frontend (window.crypto.getRandomValues),
 * usando el crypto built-in de Node.
 * @returns {string}
 */
const generateDispersionId = () => {
  const n = crypto.randomInt(0, 0x100000000);
  return "D" + (n % 36 ** 8).toString(36).padStart(6, "0").toUpperCase();
};

module.exports = { generateDispersionId };
