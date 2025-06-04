const { supabase } = require('../../../config/auth') // o la ruta relativa correcta


const impersonateUser = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Falta el correo del usuario a impersonar' })
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: 'https://mia-gray.vercel.app/impersonado' 
      }
    })

    if (error) {
      console.error('Error al generar magic link:', error)
      return res.status(500).json({ error: 'Error al generar el link de impersonación' })
    }

    return res.status(200).json({ link: data.properties?.action_link })
  } catch (err) {
    console.error('Error interno en impersonación:', err)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}

module.exports = {
  impersonateUser
}
