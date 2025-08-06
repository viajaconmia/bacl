const { API_SENDGRID } = require("../../config/auth");
const sgMail = require("@sendgrid/mail");
const { CustomError } = require("../../middleware/errorHandler");
sgMail.setApiKey(API_SENDGRID);

const sendOTPByEmail = async (email, otp) => {
  const msg = {
    to: email,
    from: "soportemia@noktos.com",
    subject: "Tu código de verificación para ingresar a MIA",
    text: `Tu código de verificación es: ${otp}`,
    html: `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">MIA - Verificación de Acceso</h1>
    </div>
    
    <!-- Main Body -->
    <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            ¡Hola! Estamos procesando tu solicitud de acceso. Por favor utiliza el siguiente código de verificación:
        </p>
        
        <div style="background: #f1f5f9; width: 100%; padding: 20px; border-radius: 8px; border: 2px dashed #93c5fd; display:flex; justify-content: center; text-align: center; margin: 0 auto 30px auto; display: inline-block;">
            <div style="font-size: 32px; font-weight: 700; color: #2563eb; letter-spacing: 3px;">
                ${otp}
            </div>
        </div>
        
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 25px 0;">
            Este código es válido por 10 minutos. Por motivos de seguridad, no compartas este código con nadie.
        </p>

        <!-- Contact Info -->
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 20px; font-size: 14px; color: #475569;">
            <strong>¿Necesitas ayuda?</strong><br>
            Escríbenos a <a href="mailto:support@noktos.zohodesk.com" style="color: #2563eb; text-decoration: none;">support@noktos.zohodesk.com</a><br>
            Llámanos al <a href="tel:8006665867" style="color: #2563eb; text-decoration: none;">800 666 5867</a><br>
            WhatsApp: <a href="https://wa.me/5215510445254" style="color: #2563eb; text-decoration: none;">55 1044 5254</a>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 25px; text-align: center; margin-top: 30px;">
            <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin: 0;">
                Si no solicitaste este código, puedes ignorar este mensaje.<br>
                Equipo de Soporte MIA · 
                <a href="mailto:ayuda@mia.com" style="color: #2563eb; text-decoration: none;">ayuda@mia.com</a>
            </p>
        </div>
    </div>
</div>
`,
  };
  try {
    await sgMail.send(msg);
  } catch (error) {
    const codeError = "SENDGRID_ERROR";
    if (error.response) {
      throw new CustomError(
        "Error al enviar correo electronico",
        500,
        codeError,
        error.response.body.errors.map((item) => item.message)
      );
    }
    throw new CustomError(
      "Error desconocido al mandar el correo electronico",
      500,
      codeError,
      error
    );
  }
};
module.exports = { sendOTPByEmail };
