const otpGenerator = require("otp-generator");
const { executeQuery } = require("../../../config/db");
const { sendOTPByEmail } = require("../../../lib/utils/otp");
const { CustomError } = require("../../../middleware/errorHandler");

const enviarOtp = async (req, res) => {
  try {
    //1.- Extraemos el correo
    const { email } = req.body;
    //2.- Generamos el codigo
    const otp = otpGenerator.generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });
    //3.- Enviamos el correo al email recibido
    await sendOTPByEmail(email, otp);
    //4.- Guardamos el correo y el codigo para que pueda verificarse
    const query =
      "INSERT INTO otp_storage (email, otp, created_at) VALUES (?,?,NOW());";
    await executeQuery(query, [email, otp]);

    res.status(204).json({
      message: "OTP generado y enviado correctamente",
    });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ error, message: error.message, data: null });
  }
};

const clientesSinVerificar = async (req, res) => {
  try {
    const response = await executeQuery(`select * from otp_storage where id in
(SELECT MAX(id) FROM otp_storage group by email) and verify = false`);

    res.json({ success: true, message: "Se obtuvo con exito", data: response });
  } catch (error) {
    res
      .status(error.statusCode)
      .json({ error, message: error.message, data: null });
  }
};
const verificarOtp = async (req, res) => {
  try {
    const { email, code } = req.query;
    const query =
      "SELECT * FROM otp_storage WHERE email = ? AND otp = ? AND verify = false;";
    const response = await executeQuery(query, [email, code]);

    if (response.length < 1) {
      throw new CustomError(
        "Codigo incorrecto",
        404,
        "ERROR_CODE_REGISTER",
        []
      );
    }
    res.status(204).json({ message: "Se verifico correctamente el codigo" });
  } catch (error) {
    res
      .status(error.statusCode)
      .json({ error, message: error.message, data: null });
  }
};

module.exports = { enviarOtp, clientesSinVerificar, verificarOtp };
