


const { generatePresignedUploadUrl } = require("../utils/subir-imagen");

exports.cargarArchivos = async (req, res) => {
  try {
    const { ruta } = req.params;                        
    const { filename, filetype } = req.query;                 

    if (!ruta || !filename || !filetype) {
      return res.status(400).json({
        success: false,
        message: "Faltan parámetros: ruta (vía params), filename y filetype (vía query)"
      });
    }


    const safeRuta = ruta.replace(/[^a-zA-Z0-9/_-]/g, "");
    const timestamp = Date.now();
    const key = `${safeRuta}/${timestamp}_${filename}`;

    // Usa tu helper de presigned URL
    const { url, key: newKey, publicUrl } = await generatePresignedUploadUrl(key, filetype);

    return res.json({
      success: true,
      url,        
      key: newKey, 
      publicUrl  
    });
  } catch (error) {
    console.error("Error en cargarArchivos:", error);
    return res.status(500).json({
      success: false,
      message: "Error generando URL de subida",
      error: error.message
    });
  }
};
