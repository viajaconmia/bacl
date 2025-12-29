const { executeQuery } = require("../../../config/db");

const getProveedores = async (req, res) => {
  try {
    const { type, id } = req.query;
        let proveedores
    if (type != null) {
      proveedores = await executeQuery(
      `SELECT * FROM proveedores where type = ?`,
      [type]
      );
    }
    else if (id != null){
proveedores = await executeQuery(
      `SELECT * FROM proveedores where id = ?`,
      [id]
      ); 
    }
    else{
      proveedores = await executeQuery(
      `SELECT * FROM proveedores`,
      
    );
    }
    res.status(200).json({ message: "", data: proveedores });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};
const getSucursales = async (req, res) => {
  try {
    const { type } = req.query;
    const sucursales = await executeQuery(`SELECT * FROM sucursales`);
    res.status(200).json({ message: "", data: sucursales });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};

const getDetalles = async(req,res)=>{
  try {
    const { id_proveedor } = req.query;
    const sucursales = await executeQuery(`SELECT * FROM proveedores_datos_fiscales where id_proveedor =?`,[id_proveedor]);
    res.status(200).json({ message: "", data: sucursales });
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
const crearSucursal = async (req, res) => {
  try {
    const {
      proveedor,
      calle,
      ciudad,
      colonia,
      direccion,
      estado,
      horarios,
      latitud,
      longitud,
      nombre,
      pais,
      postal_code,
      telefono,
    } = req.body;
    if (!proveedor) throw new Error("Falta el proveedor");

    await executeQuery(
      `INSERT INTO sucursales (id_proveedor, nombre, calle, colonia, codigo_postal, ciudad, estado, pais, latitud, longitud, telefono, activo, horario, direccion) VALUES
(?,?,?,?,?,?,?,?,?,?,?,?,?,?);
`,
      [
        proveedor.id,
        nombre,
        calle,
        colonia,
        postal_code,
        ciudad,
        estado,
        pais,
        latitud,
        longitud,
        telefono,
        true,
        horarios,
        direccion,
      ]
    );

    const sucursales = await executeQuery(`SELECT * FROM sucursales`);
    res.status(200).json({ message: "Creado con exito", data: sucursales });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};
const putEditar = async (req, res) => {
  const response = { message: "", data: null, error: null };

  try {
    const id = req.params?.id ?? req.body?.id;

    if (!id) {
      response.message = "Falta el id del proveedor";
      response.data = null;
      return res.status(400).json(response);
    }

    // Campos permitidos (whitelist) para evitar que intenten actualizar columnas no deseadas
    const allowedFields = new Set([
      "nombre",
      "pais",
      "telefono",
      "email",
      "sitio_web",
      "type",
      "tarifas",
      "cobertura",
      "bilingue",
      "extranjero",
      "credito",
      "nombre_contacto",
      // "creado_en" normalmente NO se edita; si quieres permitirlo, agrégalo aquí
    ]);

    // Body -> construir SET dinámico con solo campos permitidos y definidos
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(req.body || {})) {
      if (key === "id") continue;
      if (!allowedFields.has(key)) continue;
      if (typeof value === "undefined") continue;

      updates.push(`${key} = ?`);
      values.push(value);
    }

    if (updates.length === 0) {
      response.message =
        "No se recibieron campos válidos para actualizar (revisa el body).";
      response.data = null;
      return res.status(400).json(response);
    }

    // Ejecutar UPDATE
    values.push(id);

    const sql = `
      UPDATE proveedores
      SET ${updates.join(", ")}
      WHERE id = ?
    `;

    const result = await executeQuery(sql, values);

    // Dependiendo de tu driver, result puede ser OkPacket/ResultSetHeader
    const affectedRows = result?.affectedRows ?? 0;

    if (!affectedRows) {
      response.message = `No se encontró el proveedor con id=${id} (o no hubo cambios).`;
      response.data = { id, affectedRows };
      return res.status(404).json(response);
    }

    // Traer el registro actualizado (opcional pero útil)
    const updated = await executeQuery(
      `SELECT * FROM proveedores WHERE id = ?`,
      [id]
    );

    response.message = "Proveedor actualizado correctamente";
    response.data = updated?.[0] ?? null;
    return res.status(200).json(response);
  } catch (err) {
    response.message = err?.message
      ? `Error al actualizar proveedor: ${err.message}`
      : "Error desconocido al actualizar proveedor";

    response.data = null;

    // Error completo serializado
    response.error = {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
      errno: err?.errno,
      sqlState: err?.sqlState,
      sqlMessage: err?.sqlMessage,
      ...err,
    };

    return res.status(err?.statusCode || 500).json(response);
  }
};

const putEditarCuenta = async (req, res) => {
  const response = { message: "", data: null, error: null };

  try {
    const id = req.params?.id ?? req.body?.id;
    const id_proveedor = req.params?.id_proveedor ?? req.body?.id_proveedor;

    if (!id || !id_proveedor) {
      response.message = "Faltan parámetros: id e id_proveedor son requeridos";
      response.data = null;
      return res.status(400).json(response);
    }

    // Campos editables (whitelist)
    const allowedFields = new Set(["RFC", "TITULAR", "ALIAS", "CUENTA", "BANCO"]);
    // Si también quieres permitir editar la FK, agrega: "ID_PROVEEDOR"

    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(req.body || {})) {
      if (key === "id" || key === "id_proveedor") continue;
      if (!allowedFields.has(key)) continue;
      if (typeof value === "undefined") continue;

      updates.push(`${key} = ?`);
      values.push(value);
    }

    if (updates.length === 0) {
      response.message = "No se recibieron campos válidos para actualizar";
      response.data = null;
      return res.status(400).json(response);
    }

    // Update protegido por (ID y ID_PROVEEDOR)
    const sql = `
      UPDATE proveedores_datos_fiscales
      SET ${updates.join(", ")}
      WHERE ID = ? AND ID_PROVEEDOR = ?
    `;

    values.push(id, id_proveedor);

    const result = await executeQuery(sql, values);
    const affectedRows = result?.affectedRows ?? 0;

    if (!affectedRows) {
      response.message =
        "No se encontró el registro con ese ID para el proveedor indicado (o no hubo cambios)";
      response.data = { id, id_proveedor, affectedRows };
      return res.status(404).json(response);
    }

    // Regresar el registro actualizado
    const updated = await executeQuery(
      `SELECT * FROM proveedores_datos_fiscales WHERE ID = ? AND ID_PROVEEDOR = ?`,
      [id, id_proveedor]
    );

    response.message = "Cuenta/Datos fiscales actualizados correctamente";
    response.data = updated?.[0] ?? null;
    return res.status(200).json(response);
  } catch (err) {
    response.message = err?.message
      ? `Error al actualizar cuenta/datos fiscales: ${err.message}`
      : "Error desconocido al actualizar cuenta/datos fiscales";

    response.data = null;
    response.error = {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
      errno: err?.errno,
      sqlState: err?.sqlState,
      sqlMessage: err?.sqlMessage,
      ...err,
    };

    return res.status(err?.statusCode || 500).json(response);
  }
};

const postCrearCuenta = async (req, res) => {
  const response = { message: "", data: null, error: null };

  try {
    // Puedes recibir id_proveedor por params o body (soporta ambos)
    const id_proveedor = req.params?.id_proveedor ?? req.body?.ID_PROVEEDOR ?? req.body?.id_proveedor;

    const {
      RFC = null,
      TITULAR = null,
      ALIAS = null,
      CUENTA = null,
      BANCO = null,
    } = req.body || {};

    // Validaciones mínimas (ajusta a tu gusto)
    if (!id_proveedor) {
      response.message = "Falta ID_PROVEEDOR (id_proveedor)";
      return res.status(400).json(response);
    }

    // Si quieres obligatorios:
    if (!RFC || !TITULAR || !CUENTA || !BANCO) {
      response.message = "Faltan campos requeridos: RFC, TITULAR, CUENTA y BANCO son obligatorios";
      return res.status(400).json(response);
    }

    const insertSql = `
      INSERT INTO proveedores_datos_fiscales
        (RFC, TITULAR, ALIAS, ID_PROVEEDOR, CUENTA, BANCO)
      VALUES
        (?, ?, ?, ?, ?, ?)
    `;

    const result = await executeQuery(insertSql, [
      RFC,
      TITULAR,
      ALIAS,
      id_proveedor,
      CUENTA,
      BANCO,
    ]);

    const insertedId = result?.insertId;

    // Regresar el registro creado (útil para UI)
    const created = await executeQuery(
      `SELECT * FROM proveedores_datos_fiscales WHERE ID = ?`,
      [insertedId]
    );

    response.message = "Cuenta/Datos fiscales creados correctamente";
    response.data = created?.[0] ?? { ID: insertedId };
    return res.status(201).json(response);
  } catch (err) {
    response.message = err?.message
      ? `Error al crear cuenta/datos fiscales: ${err.message}`
      : "Error desconocido al crear cuenta/datos fiscales";

    response.data = null;

    response.error = {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
      errno: err?.errno,
      sqlState: err?.sqlState,
      sqlMessage: err?.sqlMessage,
      ...err,
    };

    return res.status(err?.statusCode || 500).json(response);
  }
};


module.exports = {
  getProveedores,
  createProveedor,
  crearSucursal,
  getSucursales,
  getDetalles,
  putEditar,
  putEditarCuenta,
  postCrearCuenta,
};
