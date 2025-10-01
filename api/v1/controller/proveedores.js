const { executeQuery } = require("../../../config/db");

const getProveedores = async (req, res) => {
  try {
    const { type } = req.query;
    const proveedores = await executeQuery(
      `SELECT * FROM proveedores where type = ?`,
      [type]
    );
    res.status(200).json({ message: "", data: proveedores });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};

const createProveedor = async (req, res) => {
  try {
    const { nombre, pais, rfc, telefono, email, sitio_web, type } = req.body;
    if (!nombre.trim()) throw new Error("Viene vacio el nombre");
    const [proveedor] = await executeQuery(
      `SELECT * FROM proveedores WHERE nombre = ?`,
      [(nombre || "").toUpperCase()]
    );
    if (proveedor) throw new Error("Ya existe ese proveedor");

    await executeQuery(
      `INSERT INTO proveedores (nombre, pais, rfc, telefono, email, sitio_web, type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        (nombre || "").toUpperCase(),
        pais || null,
        rfc || null,
        telefono || null,
        email || null,
        sitio_web || null,
        type || null,
      ]
    );

    const proveedores = await executeQuery(
      `SELECT * FROM proveedores where type = ?`,
      [type]
    );
    res.status(200).json({ message: "Creado con exito", data: proveedores });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};

module.exports = {
  getProveedores,
  createProveedor,
};
