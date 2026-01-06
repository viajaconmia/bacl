const { executeQuery } = require("../../../config/db");

const getProveedores = async (req, res) => {
  try {
    const { type, id } = req.query;
    let proveedores;
    if (type != null) {
      proveedores = await executeQuery(
        `SELECT * FROM proveedores where type = ?`,
        [type]
      );
    } else if (id != null) {
      proveedores = await executeQuery(
        `SELECT * FROM proveedores where id = ?`,
        [id]
      );
    } else {
      proveedores = await executeQuery(`SELECT * FROM proveedores`);
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

const getDetalles = async (req, res) => {
  try {
    const { id_proveedor } = req.query;
    const sucursales = await executeQuery(
      `SELECT * FROM proveedores_datos_fiscales where id_proveedor =?`,
      [id_proveedor]
    );
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

const createDatosFiscales = async (req, res) => {
  try {
    const { rfc, titular, alias, id_proveedor, cuenta, banco } = req.body;

    // Validaciones básicas de campos obligatorios (NOT NULL en tu tabla)
    if (!rfc || !rfc.trim()) throw new Error("El RFC es obligatorio");
    if (!cuenta || !cuenta.trim()) throw new Error("La cuenta es obligatoria");
    if (!id_proveedor) throw new Error("El ID de proveedor es obligatorio");

    // 1. Verificar si ya existe el RFC (porque es UNIQUE en tu tabla)
    const [existente] = await executeQuery(
      `SELECT * FROM proveedores_datos_fiscales WHERE RFC = ?`,
      [rfc.trim().toUpperCase()]
    );

    if (existente) {
      throw new Error("Ya existe un registro fiscal con este RFC");
    }

    // 2. Insertar los nuevos datos fiscales
    // Nota: Uso los nombres de columnas exactos de tu CREATE TABLE (RFC, TITULAR, ALIAS, etc.)
    await executeQuery(
      `INSERT INTO proveedores_datos_fiscales (RFC, TITULAR, ALIAS, ID_PROVEEDOR, CUENTA, BANCO) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        rfc.trim().toUpperCase(),
        titular ? titular.toUpperCase() : null,
        alias || null,
        id_proveedor,
        cuenta.trim(),
        banco ? banco.toUpperCase() : null,
      ]
    );

    // 3. Obtener todos los datos fiscales de ese proveedor para refrescar la tabla en el frontend
    const datosActualizados = await executeQuery(
      `SELECT * FROM proveedores_datos_fiscales WHERE ID_PROVEEDOR = ?`,
      [id_proveedor]
    );

    res.status(200).json({
      message: "Datos fiscales registrados con éxito",
      data: datosActualizados,
    });
  } catch (error) {
    console.error("Error en createDatosFiscales:", error);
    res.status(error.statusCode || 500).json({
      message: error.message || "Error interno del servidor",
      data: null,
    });
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
      "proveedor",
      "type",
      "imagen",
      "convenio",
      "negociacion",
      "vigencia_convenio",
      "estatus",
      "internacional",
      "notas_internacional",
      "bilingue",
      "notas_bilingue",
      "notas_proveedor",
      "estado",
      "ciudad",
      "codigo_postal",
      "pais",
      "calle",
      "numero",
      "colonia",
      "municipio",
      "contactos_convenio",
      "formas_solicitar_disponibilidad",
      "formas_reservar",
      "notas_pagos",
      "notas_tipo_pago",
      "tipo_pago",
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

const updateDatosFiscales = async (req, res) => {
  try {
    const { id, rfc, titular, alias, cuenta, banco, id_proveedor } = req.body;

    if (!id) throw new Error("ID de registro no proporcionado");

    // 1. Validar si el RFC ya existe en OTRO registro (para evitar conflictos de UNIQUE)
    const [existente] = await executeQuery(
      `SELECT * FROM proveedores_datos_fiscales WHERE RFC = ? AND ID != ?`,
      [rfc.trim().toUpperCase(), id]
    );

    if (existente) {
      throw new Error("El RFC ya está registrado en otra cuenta");
    }

    // 2. Actualizar el registro
    await executeQuery(
      `UPDATE proveedores_datos_fiscales 
       SET RFC = ?, TITULAR = ?, ALIAS = ?, CUENTA = ?, BANCO = ? 
       WHERE ID = ?`,
      [
        rfc.trim().toUpperCase(),
        titular ? titular.toUpperCase() : null,
        alias || null,
        cuenta.trim(),
        banco ? banco.toUpperCase() : null,
        id,
      ]
    );

    // 3. Retornar la lista actualizada de este proveedor para refrescar la UI
    const datosActualizados = await executeQuery(
      `SELECT * FROM proveedores_datos_fiscales WHERE ID_PROVEEDOR = ?`,
      [id_proveedor]
    );

    res.status(200).json({
      message: "Datos fiscales actualizados con éxito",
      data: datosActualizados,
    });
  } catch (error) {
    console.error("Error en updateDatosFiscales:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProveedores,
  createProveedor,
  crearSucursal,
  getSucursales,
  getDetalles,
  putEditar,
  updateDatosFiscales,
  createDatosFiscales,
};
