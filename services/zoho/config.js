require("dotenv").config();
let { executeQuery } = require("../../config/db");

const config = {
  refresh_token: process.env.ZOHO_REFRESH_TOKEN,
  client_id: process.env.ZOHO_CLIENT_ID,
  client_secret: process.env.ZOHO_CLIENT_SECRET,
  grant_type: "refresh_token",
};

/**
 *
 * @returns access_token : string
 */
async function getAccessToken() {
  let access_token = null;
  try {
    const [results] = await executeQuery(
      `SELECT access_token
        FROM oauth_access_tokens
        WHERE provider = 'zoho'
          AND environment = 'production'
          AND is_revoked = 0
          AND expires_at > NOW()
        LIMIT 1;`
    );
    access_token = results ? results.access_token : null;
    if (access_token) {
      return access_token;
    }
  } catch (error) {
    console.error("Error obteniendo el access token:", error);
  }
  try {
    const response = await fetch("https://accounts.zoho.com/oauth/v2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(config),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Error al obtener el access token");
    }

    await executeQuery(
      `INSERT INTO oauth_access_tokens (
        provider,
        environment,
        access_token,
        expires_at,
        refreshed_at
      ) VALUES ( ?, ?, ?, DATE_ADD(NOW(), INTERVAL 55 MINUTE), NOW() )
      ON DUPLICATE KEY UPDATE
        access_token = VALUES(access_token),
        expires_at = VALUES(expires_at),
        refreshed_at = VALUES(refreshed_at),
        is_revoked = 0;
      `,
      ["zoho", "production", data.access_token]
    );

    access_token = data.access_token;

    return access_token;
  } catch (error) {
    console.error("Error generando el access token o guardandolo:", error);
  }
}

module.exports = { getAccessToken };
