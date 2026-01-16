const {
  executeQuery,
  runTransaction,
  executeSP,
  executeTransaction,
} = require("../../../config/db");

const getProveedores = async (req, res) => {
  try {
    const {
      type = null,
      id = null,
      page = 1,
      size = 20,
      proveedor = null,
      estado = null,
      rfc = null,
    } = req.query;

    const [[{ total }], data] = await executeQuery(
      "call sp_filtro_proveedores(?,?,?,?,?,?,?)",
      [
        type,
        id,
        estado == null ? null : estado == "activo" ? 1 : 0,
        proveedor,
        rfc,
        page,
        size,
      ]
    );

    res.status(200).json({ message: "", data, metadata: { total } });
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
      `SELECT pdf.id, pdf.rfc, pdf.alias, pdf.razon_social FROM proveedores_datos_fiscales pdf
left join proveedores_datos_fiscales_relacion rel on rel.id_datos_fiscales = pdf.id
WHERE rel.id_proveedor = ?
group by pdf.id;`,
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

const getCuentas = async (req, res) => {
  try {
    const { id_proveedor } = req.query;
    console.log(req.query);
    const cuentas = await executeQuery(
      `select * from proveedores_cuentas where id_proveedor = ?;`,
      [id_proveedor]
    );
    res.status(200).json({ message: "", data: cuentas });
  } catch (error) {
    console.log(error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message, data: null, error });
  }
};

const getDatosFiscales = async (req, res) => {
  try {
    const { id } = req.query;

    const cuentas = await executeQuery(
      `select * from proveedores_cuentas where id_proveedor = ?`,
      [id]
    );

    res.status(200).json({
      message: "",
      data: cuentas,
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
      `select * from proveedores_cuentas where id_proveedor = ?;`,
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
    const id = req.body?.id;

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
      "ish",
      "tua",
      "iva",
      "saneamiento",
      "notas_tarifas_impuestos",
      "intermediario",
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
    const { auto, vuelo, ...body } = req.body;

    for (const [key, value] of Object.entries(body || {})) {
      if (key === "id") continue;
      if (!allowedFields.has(key)) continue;
      if (typeof value === "undefined") continue;

      updates.push(`${key} = ?`);
      values.push(value);
    }

    const update_proveedor = updates.length !== 0;
    const update_subproveedor = !!auto || !!vuelo;

    // Ejecutar UPDATE
    values.push(id);

    const sql = `
      UPDATE proveedores
      SET ${updates.join(", ")}
      WHERE id = ?
    `;

    await runTransaction(async (conn) => {
      try {
        if (update_proveedor) await conn.execute(sql, values);

        if (update_subproveedor) {
          if (!!auto) {
            const [[proveedor]] = await conn.execute(
              `SELECT 1 FROM proveedor_auto where id_proveedor = ?`,
              [id]
            );
            if (!proveedor && !!auto)
              await conn.execute(
                `INSERT INTO proveedor_auto (id_proveedor) VALUES (?)`,
                [id]
              );
            await conn.execute(
              `UPDATE proveedor_auto SET is_con_chofer = ?, is_sin_chofer = ?, is_chofer_bilingue = ?, notas_sin_chofer = ?, notas_con_chofer = ?, notas_chofer_bilingue = ?, incidencia = ?, notas_generales = ? WHERE id_proveedor = ?`,
              [
                auto.is_con_chofer || null,
                auto.is_sin_chofer || null,
                auto.is_chofer_bilingue || null,
                auto.notas_sin_chofer || null,
                auto.notas_con_chofer || null,
                auto.notas_chofer_bilingue || null,
                auto.incidencia || null,
                auto.notas_generales || null,
                id,
              ]
            );
          }
          if (!!vuelo) {
          }
        }
      } catch (error) {
        throw error;
      }
    });

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
      `select * from proveedores_cuentas where id_proveedor = ?;`,
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

const createProveedorCuenta = async (req, res) => {
  try {
    const { id_proveedor, cuenta, banco, titular, comentarios, alias } =
      req.body;

    // Validaciones básicas (NOT NULL)
    if (!id_proveedor) throw new Error("El ID del proveedor es obligatorio");
    if (!cuenta || !cuenta.trim()) throw new Error("La cuenta es obligatoria");

    // 2. Insertar la cuenta
    await executeQuery(
      `INSERT INTO proveedores_cuentas 
       (id_proveedor, cuenta, banco, titular, comentarios, alias)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id_proveedor,
        cuenta.trim(),
        banco?.trim().toUpperCase() || null,
        titular?.trim().toUpperCase() || null,
        comentarios || null,
        alias?.trim().toUpperCase() || null,
      ]
    );

    // 3. Regresar las cuentas del proveedor
    const response = await executeQuery(
      `SELECT * FROM proveedores_cuentas WHERE id_proveedor = ?`,
      [id_proveedor]
    );

    res.status(200).json({
      message: "Cuenta registrada con éxito",
      data: response,
    });
  } catch (error) {
    console.error("Error en createProveedorCuenta:", error);
    res.status(error.statusCode || 500).json({
      message: error.message || "Error interno del servidor",
      data: null,
    });
  }
};

const updateProveedorCuenta = async (req, res) => {
  try {
    const { id, id_proveedor, cuenta, banco, titular, comentarios, alias } =
      req.body;

    if (!id) throw new Error("ID de la cuenta no proporcionado");
    if (!cuenta || !cuenta.trim()) throw new Error("La cuenta es obligatoria");

    // 1. Validar que no exista otra cuenta igual para el mismo proveedor
    const [existente] = await executeQuery(
      `SELECT * FROM proveedores_cuentas 
       WHERE id_proveedor = ? AND cuenta = ? AND id <> ?`,
      [id_proveedor, cuenta.trim(), id]
    );

    if (existente) {
      throw new Error("Ya existe otra cuenta con ese número");
    }

    // 2. Actualizar la cuenta
    await executeQuery(
      `UPDATE proveedores_cuentas
       SET cuenta = ?, banco = ?, titular = ?, comentarios = ?, alias = ?
       WHERE id = ?`,
      [
        cuenta.trim(),
        banco?.trim().toUpperCase() || null,
        titular?.trim().toUpperCase() || null,
        comentarios || null,
        alias?.trim().toUpperCase() || null,
        id,
      ]
    );

    // 3. Regresar las cuentas del proveedor
    const response = await executeQuery(
      `SELECT * FROM proveedores_cuentas WHERE id_proveedor = ?`,
      [id_proveedor]
    );

    res.status(200).json({
      message: "Cuenta actualizada con éxito",
      data: response,
    });
  } catch (error) {
    console.error("Error en updateProveedorCuenta:", error);
    res.status(500).json({
      message: error.message || "Error interno del servidor",
      data: null,
    });
  }
};

//PROVEEDOR
const getProveedorType = async (req, res) => {
  try {
    const { type, id } = req.query;
    if (!type || !id) throw new Error("Falta el type o el id");

    const querys = {
      renta_carro: `SELECT is_con_chofer, is_sin_chofer, is_chofer_bilingue, notas_sin_chofer, notas_con_chofer, notas_chofer_bilingue, incidencia, notas_generales FROM proveedor_auto WHERE id_proveedor = ?`,
      vuelo: `SELECT id, id_proveedor, tarifa, articulo_personal, equipaje_mano_o_carry_on, equipaje_documentado, servicios_adicionales FROM proveedor_vuelo WHERE id_proveedor = ?`,
    };

    const prop = {
      renta_carro: "auto",
      vuelo: "vuelo",
    };

    if (!Object.keys(querys).includes(type))
      throw new Error(
        "No encontramos el tipo de proveedor, el que recibimos fue: " + type
      );

    const response = await executeQuery(querys[type], [id]);

    res.status(200).json({
      message: "",
      data: { [prop[type]]: type == "vuelo" ? response : response[0] },
    });
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
  crearSucursal,
  getSucursales,
  getDetalles,
  putEditar,
  updateDatosFiscales,
  createDatosFiscales,
  getDatosFiscales,
  getCuentas,
  updateProveedorCuenta,
  createProveedorCuenta,
  //Proveedor Type
  getProveedorType,
};
