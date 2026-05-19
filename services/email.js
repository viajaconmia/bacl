const { API_SENDGRID } = require("../config/auth");
const sgMail = require("@sendgrid/mail");
const { CustomError } = require("../middleware/errorHandler");

sgMail.setApiKey(API_SENDGRID);

/**
 * @param {string} to - Destinatario
 * @param {{ subject: string, html: string, text?: string }} body
 */
const sendEmail = async (to, { subject, html, text }) => {
  const msg = {
    to,
    from: "soportemia@noktos.com",
    subject,
    html,
    ...(text ? { text } : {}),
  };

  try {
    await sgMail.send(msg);
  } catch (error) {
    const codeError = "SENDGRID_ERROR";
    if (error.response) {
      throw new CustomError(
        "Error al enviar correo electrónico",
        500,
        codeError,
        error.response.body.errors.map((item) => item.message),
      );
    }
    throw new CustomError(
      "Error desconocido al mandar el correo electrónico",
      500,
      codeError,
      error,
    );
  }
};

module.exports = { sendEmail };
