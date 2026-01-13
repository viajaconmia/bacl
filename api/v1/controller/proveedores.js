const { executeQuery, runTransaction } = require("../../../config/db");

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
      `SELECT * FROM proveedores_datos_fiscales pdf
      left join proveedores_datos_fiscales_relacion rel on rel.id_datos_fiscales = pdf.id
      where rel.id_proveedor =?`,
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
const getDatosFiscales = async (req, res) => {
  try {
    // Opcional: paginación
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 100);
    const offset = (page - 1) * limit;

    const rows = await executeQuery(
      `SELECT *
       FROM proveedores
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Opcional: total para paginación
    const [{ total }] = await executeQuery(
      `SELECT COUNT(*) AS total
       FROM proveedores`
    );

    res.status(200).json({
      message: "",
      data: rows,
      meta: { page, limit, total },
    });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};
const createProveedor = async (req, res) => {
  try {
    const { nombre, type } = req.body;
    if (!nombre.trim()) throw new Error("Viene vacio el nombre");
    const [proveedor] = await executeQuery(
      `SELECT * FROM proveedores WHERE proveedor = ?`,
      [(nombre || "").toUpperCase()]
    );
    if (proveedor) throw new Error("Ya existe ese proveedor");

    await executeQuery(
      `INSERT INTO proveedores (proveedor, type) VALUES (?, ?)`,
      [(nombre || "").trim().toUpperCase(), type || null]
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
    const { rfc, alias, id_proveedor, razon_social } = req.body;

    // Validaciones básicas de campos obligatorios (NOT NULL en tu tabla)
    if (!rfc || !rfc.trim()) throw new Error("El RFC es obligatorio");
    if (!id_proveedor) throw new Error("El ID de proveedor es obligatorio");

    // 1. Verificar si ya existe el RFC (porque es UNIQUE en tu tabla)
    const [existente] = await executeQuery(
      `SELECT * FROM proveedores_datos_fiscales WHERE rfc = ?`,
      [rfc.trim().toUpperCase()]
    );

    if (existente) {
      throw new Error("Ya existe un registro fiscal con este RFC");
    }

    // 2. Insertar los nuevos datos fiscales
    // Nota: Uso los nombres de columnas exactos de tu CREATE TABLE (RFC, TITULAR, ALIAS, etc.)
    await runTransaction(async (conn) => {
      try {
        const response = await conn.execute(
          `INSERT INTO proveedores_datos_fiscales (rfc, alias, razon_social) VALUES (?, ?, ?)`,
          [
            rfc.trim().toUpperCase(),
            alias.trim().toUpperCase() || null,
            razon_social.trim().toUpperCase(),
          ]
        );
        await conn.execute(
          `INSERT INTO proveedores_datos_fiscales_relacion (id_proveedor, id_datos_fiscales) VALUES (?,?)`,
          [id_proveedor, response[0].insertId]
        );
      } catch (error) {
        throw error;
      }
    });
    const response = await executeQuery(
      `SELECT * FROM proveedores_datos_fiscales pdf
      left join proveedores_datos_fiscales_relacion rel on rel.id_datos_fiscales = pdf.id
      where rel.id_proveedor =?`,
      [id_proveedor]
    );

    res.status(200).json({
      message: "Datos fiscales registrados con éxito",
      data: response,
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
    const { id, rfc, alias, id_proveedor, razon_social } = req.body;

    if (!id) throw new Error("ID de registro no proporcionado");

    const [proveedor] = await executeQuery(
      `SELECT * FROM proveedores_datos_fiscales WHERE rfc = ? and id <> ?`,
      [rfc.trim().toUpperCase(), id]
    );

    if (proveedor) throw new Error("Ya existe ese rfc");

    // 2. Actualizar el registro
    await executeQuery(
      `UPDATE proveedores_datos_fiscales 
       SET rfc = ?, alias = ?, razon_social = ?
       WHERE ID = ?`,
      [
        rfc.trim().toUpperCase(),
        alias || null,
        razon_social.trim().toUpperCase(),
        id,
      ]
    );

    const response = await executeQuery(
      `SELECT * FROM proveedores_datos_fiscales pdf
      left join proveedores_datos_fiscales_relacion rel on rel.id_datos_fiscales = pdf.id
      where rel.id_proveedor =?`,
      [id_proveedor]
    );

    res.status(200).json({
      message: "Datos fiscales actualizados con éxito",
      data: response,
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
  getDatosFiscales,
};
