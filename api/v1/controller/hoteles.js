const {executeSP, executeQuery} = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");
const model = require("../model/hoteles")


const AgregarHotel = async (req, res) => {
  console.log('Llegó al endpoint de agregar hotel');
  console.log('Body recibido:', JSON.stringify(req.body, null, 2)); // Log completo del body
  
  try {
    // Extraer datos del cuerpo de la solicitud con valores por defecto
    const {
      id_excel,
      tipo_negociacion = null,
      nombre,
      id_cadena,
      correo = null,
      telefono = null,
      rfc = null,
      razon_social = null,
      direccion,
      latitud = null,
      longitud = null,
      estado,
      ciudad_zona,
      codigoPostal = null,
      colonia = null,
      tipo_hospedaje = 'hotel',
      cuenta_de_deposito = null,
      vigencia_convenio = null,
      tipo_pago = null,
      disponibilidad_precio = null,
      contacto_convenio = null,
      contacto_recepcion = null,
      menoresEdad = null,
      paxExtraPersona = null,
      transportacion = null,
      transportacionComentarios = null,
      urlImagenHotel = null,
      urlImagenHotelQ = null,
      urlImagenHotelQQ = null,
      calificacion = null,
      activo = 1,

      tarifas = {
        general: {
          costo_q: null,
          precio_q: null,
          costo_qq: null,
          precio_qq: null,
          precio_persona_extra: null,
          sencilla: {
            incluye: false,
            tipo_desayuno: null,
            precio: null,
            comentarios: null,
            precio_noche_extra: null
          },
          doble: {
            incluye: false,
            tipo_desayuno: null,
            precio: null,
            comentarios: null,
            precio_persona_extra: null,
            precio_noche_extra: null
          }
        },
        preferenciales: []
      },
      Comentarios,
      id_sepomex = null,
      iva,
      ish,
      otros_impuestos,
      comentario_pago,
      mascotas,
      salones,
      comentario_vigencia,
      otros_impuestos_porcentaje,
      pais,
      score_operaciones,
      score_sistemas
    } = req.body;
    const { preferenciales } = tarifas;
    // Función para asegurar valores numéricos
    const safeNumber = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = Number(value);
      return isNaN(num) ? null : num;
    };
    let otros_impuestos2= otros_impuestos== null? 0 : otros_impuestos;
    let otros_impuestos_porcentaje2= otros_impuestos_porcentaje== null? 0 : otros_impuestos_porcentaje;
    let score_operaciones2= score_operaciones== null? 0 : score_operaciones;
    let score_sistemas2= score_sistemas== null? 0 : score_sistemas;
    //si el pais es null se asigna Mexico
    const pais2= pais === null ? "MEXICO" : pais;
    // Procesar tarifas preferenciales - VERSIÓN CORREGIDA
    const processTarifasPreferenciales = () => {
      if (!Array.isArray(preferenciales)) return [];
      
      return preferenciales.map(tarifa => {
        // Conservar la estructura completa de las tarifas
        const tarifaPreferencial = {
          id_agente: tarifa.id_agente || null,
          costo_q: safeNumber(tarifa.costo_q),
          precio_q: safeNumber(tarifa.precio_q),
          costo_qq: safeNumber(tarifa.costo_qq),
          precio_qq: safeNumber(tarifa.precio_qq),
          sencilla: {
            // Usamos el valor directamente sin operador || para evitar sobrescribir true
            incluye: tarifa.sencilla?.incluye !== undefined ? tarifa.sencilla.incluye : false,
            tipo_desayuno: tarifa.sencilla?.tipo_desayuno || null,
            precio: safeNumber(tarifa.sencilla?.precio),
            comentarios: tarifa.sencilla?.comentarios || null,
            precio_noche_extra: safeNumber(tarifa.sencilla?.precio_noche_extra)
          },
          doble: {
            // Mismo tratamiento para doble
            incluye: tarifa.doble?.incluye !== undefined ? tarifa.doble.incluye : false,
            tipo_desayuno: tarifa.doble?.tipo_desayuno || null,
            precio: safeNumber(tarifa.doble?.precio),
            comentarios: tarifa.doble?.comentarios || null,
            precio_noche_extra: safeNumber(tarifa.doble?.precio_noche_extra),
            precio_persona_extra: safeNumber(tarifa.doble?.precio_persona_extra)
          }
        };

        console.log('Tarifa preferencial procesada:', JSON.stringify(tarifaPreferencial, null, 2));
        return tarifaPreferencial;
      });
    };

    const tarifasPreferenciales = processTarifasPreferenciales();
    const tarifas_preferenciales_json = JSON.stringify(tarifasPreferenciales);
    console.log('Tarifas preferenciales finales:', tarifas_preferenciales_json);

    // Formatear fecha de vigencia del convenio si existe
    const formatVigenciaConvenio = (dateString) => {
      if (!dateString) return null;
      const [day, month, year] = dateString.split('-');
      return `${year}-${month}-${day}`;
    };
    
    // Extraer datos específicos de tarifas generales
    const { 
      general: {
        costo_q,
        precio_q,
        costo_qq,
        precio_qq,
        sencilla = {},
        doble = {}
      }
    } = tarifas;

    // Validar que los campos esenciales estén presentes
    if (!nombre || !direccion || !estado || !ciudad_zona ||!tipo_negociacion) {
      console.log('Error: Faltan campos obligatorios');
      return res.status(400).json({
        success: false,
        
        message: "Faltan campos obligatorios: nombre, id_cadena, direccion, estado, ciudad_zona,tipo_negociacion, vigencia_convenio"
      });
    }

    // Llamada al stored procedure (descomentar cuando esté listo)
  
    const result = await executeSP("sp_inserta_hotel3", [
      id_excel || null,
      tipo_negociacion,
      nombre,
      id_cadena,
      correo,
      telefono,
      rfc,
      razon_social,
      direccion,
      latitud,
      longitud,
      estado,
      ciudad_zona,
      codigoPostal,
      colonia,
      tipo_hospedaje,
      cuenta_de_deposito,
      formatVigenciaConvenio(vigencia_convenio),
      tipo_pago,
      disponibilidad_precio,
      contacto_convenio,
      contacto_recepcion,
      menoresEdad,
      safeNumber(paxExtraPersona),
      transportacion,
      transportacionComentarios,
      urlImagenHotel,
      urlImagenHotelQ,
      urlImagenHotelQQ,
      safeNumber(calificacion),
      activo,
      safeNumber(iva),
      safeNumber(ish),
      safeNumber(otros_impuestos2),
      comentario_pago,
      mascotas,
      salones,
      comentario_vigencia,
      safeNumber(otros_impuestos_porcentaje2),
      // Datos de desayuno sencilla
      sencilla.incluye === true,
      sencilla.tipo_desayuno || null,
      safeNumber(sencilla.precio),
      sencilla.comentarios || null,
      // Datos de desayuno doble
      doble.incluye === true,
      doble.tipo_desayuno || null,
      safeNumber(doble.precio),
      doble.comentarios || null,
      // Tarifas generales
      safeNumber(costo_q),
      safeNumber(precio_q),
      safeNumber(costo_qq),
      safeNumber(precio_qq),
      // Precio persona extra en doble (nuevo parámetro)
      safeNumber(doble.precio_persona_extra),
      // Tarifas preferenciales
      tarifas_preferenciales_json,
      // Notas y sepomex
      Comentarios || "",
      safeNumber(id_sepomex),
      pais2,
      safeNumber(score_operaciones2),
      safeNumber(score_sistemas2)
    ], false);
    
    res.status(200).json({ 
      success: true, 
      data: {
        hotel_creado: result,
        message: "Hotel creado exitosamente"
      } 
    });
    

  } catch (error) {
    console.error('Error en AgregarHotel:', error);
    res.status(500).json({
      success: false,
      message: "Error al crear el hotel",
      error: error.message
    });
  }
};
const consultaHoteles= async (req,res) => {
    //console.log("Verificando que llegamos a est endpoint")
    try {
      const hoteles = await executeSP("sp_nuevo_get_hoteles",[],false);
      if(!hoteles){
        res.status(404).json({message: "No se encontraron hoteles registrados"});
      }else{
        res.status(200).json({message: "Hoteles recuperados con exito",data: hoteles});
      }
    } catch (error) {
      res.status(500).json({message: "Error interno del srvidor"});
    }
  }
  const actualizaHotel = async (req, res) => {
    const {
      id_hotel,
      id_cadena,
      nombre,
      correo,
      telefono,
      rfc,
      razon_social,
      direccion,
      latitud,
      longitud,
      calificacion,
      tipo_hospedaje,
      cuenta_de_deposito,
      Estado,
      Ciudad_Zona,
      Colonia,
      MenoresEdad,
      PaxExtraPersona,
      Transportacion,
      TransportacionComentarios,
      URLImagenHotel,
      URLImagenHotelQ,
      URLImagenHotelQQ,
      Activo,
      Comentarios,
      CodigoPostal,
      Id_hotel_excel,
      Id_Sepomex,
      comentario_pago,
      iva,
      ish,
      otros_impuestos,
      otros_impuestos_porcentaje,
      tipo_negociacion,
      vigencia_convenio,
      tipo_pago,
      disponibilidad_precio,
      contacto_convenio,
      contacto_recepcion,
      mascotas,
      salones,
      comentario_vigencia,
      pais,
      score_operaciones,
      score_sistemas
    } = req.body;

    console.log("Datos recibidos:", req.body);
    const pais2= pais === null ? "MEXICO" : pais;
    let score_operaciones2= score_operaciones== null? 0 : score_operaciones;
    let score_sistemas2= score_sistemas== null? 0 : score_sistemas;
    try {
      const hotel_actualizado = await executeSP("sp_actualizar_hotel2", [
        id_hotel,
        id_cadena,
        nombre,
        correo,
        telefono,
        rfc,
        razon_social,
        direccion,
        latitud,
        longitud,
        calificacion,
        tipo_hospedaje,
        cuenta_de_deposito,
        Estado,
        Ciudad_Zona,
        Colonia,
        MenoresEdad,
        PaxExtraPersona,
        Transportacion,
        TransportacionComentarios,
        URLImagenHotel,
        URLImagenHotelQ,
        URLImagenHotelQQ,
        Activo,
        Comentarios,
        CodigoPostal,
        Id_hotel_excel,
        Id_Sepomex,
        comentario_pago,
        iva,
        ish,
        otros_impuestos,
        otros_impuestos_porcentaje,
        tipo_negociacion,
        vigencia_convenio,
        tipo_pago,
        disponibilidad_precio,
        contacto_convenio,
        contacto_recepcion,
        mascotas,
        salones,
        comentario_vigencia,
        pais2,
        score_operaciones2,
        score_sistemas2
      ], false);

      res.status(200).json({
        success: true,
        message: "Hotel actualizado correctamente",
        data: hotel_actualizado
      });
    } catch (error) {
      console.error("Error al actualizar hotel:", error);
      res.status(500).json({
        success: false,
        message: "Error al actualizar el hotel",
        error: error.message
      });
    }
};
  const getTarifasByIdHotel = async (req,res) => {
    const {id_hotel}  = req.params;
    console.log(id_hotel)
    try {
      const tarifas = await executeSP("sp_get_tarifas_by_id_hotel",[id_hotel],false);
      if (!tarifas) {
        res.status(404).json({message: "No se encontraron tarifas asociadas a este hotel"});
      } else {
        res.status(200).json({message: "Tarifas recuperadas exitosamente", tarifas: tarifas});
      }
    } catch (error) {
      res.status(500).json({message: "Error en el servidor", error: error});
    }
    
  }
  const eliminaHotelLogico = async (req,res) => {
    const {id_hotel}= req.body;
    try {
      const borrado = await executeSP("elimina_hotel_logico",[id_hotel],false);
      res.status(200).json({message: "Eliminacion exitosa del hotel ",data_borrada: borrado})
    } catch (error) {
      res.status(500).json({message: "error interno del servidor", error:error});
    }
  }
  const consultaPrecioSencilla = async (req, res) => {
    // Tomamos el id_hotel desde params o query
    const id_hotel = req.params.id_hotel || req.query.id_hotel;
  
    //console.log("ID hotel recibido:", id_hotel);
  
    if (!id_hotel) {
      return res.status(400).json({ message: "Falta el parámetro id_hotel" });
    }
  
    try {
      const result = await executeSP("get_precio_habitacion_sencilla", [id_hotel],false);
      //console.log(result)
      const precio_sencilla = result?.[0]?.precio_sencilla  
      if (precio_sencilla === undefined) {
        return res
          .status(404)
          .json({ message: "No se encontró el precio de la habitación sencilla" });
      }
  
      res.status(200).json({ message: "Precio encontrado", precio: precio_sencilla });
    } catch (error) {
      console.error("Error ejecutando SP:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  };
  
  const consultaPrecioDoble = async (req, res) => {
    // Tomamos el id_hotel desde params o query
    const id_hotel = req.params.id_hotel || req.query.id_hotel;
  
    //console.log("ID hotel recibido:", id_hotel);
  
    if (!id_hotel) {
      return res.status(400).json({ message: "Falta el parámetro id_hotel" });
    }
  
    try {
      const result = await executeSP("get_precio_habitacion_doble", [[id_hotel]],false);
  
      // Si el resultado viene como: [ { precio_doble: '4200.00' } ]
      const precio_doble = result?.[0]?.precio_doble;
  
      if (precio_doble == null) {
        return res
          .status(404)
          .json({ message: "No se encontró el precio de la habitación doble" });
      }
  
      res.status(200).json({
        message: "Precio encontrado",
        precio: parseFloat(precio_doble),
      });
    } catch (error) {
      console.error("Error ejecutando SP:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  const filtra_hoteles = async (req,res) => {
    const opc = req.params;
    if(opc==1){
      try {
        const hoteles_activos = await executeSP("sp_hoteles_activos",[],false);
        res.status(200).json({message: "Hoteles activos recuperados",data: hoteles_activos});
      } catch (error) {
        res.status(500).json({message: "Error interno del servidor", errorinfo: error})
      }
    }else if(opc==2){
      try {
        const hoteles_inactivos = await executeSP("sp_hoteles_inactivos",[],false);
        res.status(200).json({message: "Hoteles inactivos recuperados",data: hoteles_inactivos});
      } catch (error) {
        res.status(500).json({message: "Error interno del servidor", errorinfo: error})
      }
    }
    
  };
  const  idcadena_por_codigo = async (req,res) => {
    
  }
  
const paginacion = async (req, res) => {
  const {pagina} = req.query;
  try {
    const result = await executeSP("SP_Hoteles_Paginacion",[pagina],true);
    if (!result[0]) {
      res.status(404).json({message: "No se encontraron hoteles para la pagina solicitada"});

    } else {
      const hoteles = result;
      const paginationRows = result[1] ?? [];
      const info_paginacion = paginationRows[0] ?? {
        pagina: Number(pagina),
        total_paginas: 0,
        total_registros: 0
      };
      res.status(200).json({message: "Hoteles recuerados con exito",
        hoteles: hoteles, info:info_paginacion});

    }
  } catch (error) {
    res.status(500).json({message: "Error interno del servidor"});

  }  
}

const BuscaHotelesPorTermino = async (req,res) => {
  const {termino} = req.query;
  try {
    const result = await executeSP("sp_Hoteles_Buscar",[termino],false);
  if (!result) {
    res.status(404).json({message: "No se encontraron hoteles con esa busqueda"});

  } else {
    res.status(200).json({message: "Mostrando los hoteles coincidentes",hoteles: result});

  }
  } catch (error) {
    res.status(500).json({message: "No se encontraron hoteles para esa busqueda"});

  }
}
const readGroupByHotel = async (req, res) => {
  try {
    const agentes = await model.getHotelesWithCuartos()
    res.status(200).json(agentes)
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}
const get_hotel_tarifas_by_nombre = async (req, res) => {
  const { nombre } = req.query;  // Asegúrate de acceder correctamente al parámetro 'nombre' desde la query
  const nombre_up = nombre.toUpperCase();
  try {
    const result = await executeSP("sp_get_hotel_tarifas_por_nombre", [nombre_up], false);

    if (!result || result.length === 0) {
      return res.status(404).json({ message: "No se encontraron hoteles con esa búsqueda" });
    }

    // Organizar la respuesta estructurando los datos
    const hotels = result.map(row => ({
      nombre_hotel: row.hotel_nombre,
      hotel_info: {
        id_hotel: row.id_hotel,
        nombre: row.hotel_nombre,
        correo: row.hotel_correo,
        telefono: row.hotel_telefono,
        rfc: row.hotel_rfc,
        razon_social: row.hotel_razon_social,
        direccion: row.hotel_direccion,
        latitud: row.hotel_latitud,
        longitud: row.hotel_longitud,
        convenio: row.hotel_convenio,
        descripcion: row.hotel_descripcion,
        calificacion: row.hotel_calificacion,
        tipo_hospedaje: row.hotel_tipo_hospedaje,
        cuenta_de_deposito: row.hotel_cuenta_de_deposito,
        estado: row.hotel_estado,
        ciudad_zona: row.hotel_ciudad_zona,
        noktosq: row.hotel_noktosq,
        noktosqq: row.hotel_noktosqq,
        menoresedad: row.hotel_menoresedad,
        paxextrapersona: row.hotel_paxextrapersona,
        desayunoincluido: row.hotel_desayunoincluido,
        desayunocomentarios: row.hotel_desayunocomentarios,
        desayunoprecioporpersona: row.hotel_desayunoprecioporpersona,
        transportacion: row.hotel_transportacion,
        transportacioncomentarios: row.hotel_transportacioncomentarios,
        urlimagenhotel: row.hotel_urlimagenhotel,
        urlimagenhotelq: row.hotel_urlimagenhotelq,
        urlimagenhotelqq: row.hotel_urlimagenhotelqq,
        activo: row.hotel_activo,
        comentarios: row.hotel_comentarios,
        id_sepomex: row.hotel_id_sepomex,
        codigopostal: row.hotel_codigopostal,
        id_hotel_excel: row.hotel_id_hotel_excel,
        colonia: row.hotel_colonia,
        tipo_negociacion: row.hotel_tipo_negociacion,
        vigencia_convenio: row.hotel_vigencia_convenio,
        tipo_pago: row.hotel_tipo_pago,
        disponibilidad_precio: row.hotel_disponibilidad_precio,
        contacto_convenio: row.hotel_contacto_convenio,
        contacto_recepcion: row.hotel_contacto_recepcion,
        impuestos_porcentaje: row.hotel_impuestos_porcentaje,
        impuestos_moneda: row.hotel_impuestos_moneda,
        tarifas_hotel: result.filter(item => item.id_hotel === row.id_hotel)
          .map(tarifa => ({
            id_tarifa: tarifa.id_tarifa,
            id_agente: tarifa.id_agente,
            precio: tarifa.precio,
            costo:tarifa.costo,
            tipo_cuarto:tarifa.tipos_cuartos=1 ? "SENCILLO": "DOBLE",
            incluye_desayuno: tarifa.incluye_desayuno,
            precio_desayuno:tarifa.precio_desayuno,
            tipo_desayuno: tarifa.tipo_desayuno,
            comentario_desayuno: tarifa.comentario_desayuno,
            precio_noche_extra: tarifa.precio_noche_extra,
            precio_persona_extra: tarifa.precio_persona_extra,
          }))
      }
    }));

    // Devolver la respuesta estructurada
    res.status(200).json({ message: "Información recuperada correctamente", hotels });

  } catch (error) {
    console.error("Error al recuperar la información:", error);
    res.status(500).json({ message: "Error al recuperar la información del hotel" });
  }
};

const readHotelesWithTarifa = async (req, res) => {
  try {
    const hoteles = await model.getHotelesWithTarifas();
    res.status(200).json({ data: hoteles })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Error en el servidor', details: error })
  }
}

const actualizarTarifa = async (req, res) => {
  try {
    const {
      id_tarifa,
      precio,
      costo,
      incluye_desayuno,
      precio_desayuno,
      precio_noche_extra,
      comentario_desayuno,
      precio_persona_extra,
      tipo_desayuno,
    } = req.body;
    // console.log("veamos que estamos enviando",req.body)
    // console.log("Creo no manda la id_tarifa",req.body.id_tarifa)


    const result = await executeSP("sp_actualiza_tarifa", [
      id_tarifa,
      precio,
      costo,
      incluye_desayuno,
      precio_desayuno,
      precio_noche_extra,
      comentario_desayuno,
      precio_persona_extra,
      tipo_desayuno,
    ],false);

    res.status(200).json({
      success: true,
      message: "Tarifa actualizada exitosamente",
      data: result,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al actualizar la tarifa",
      error: error.message,
    });
  }
};

const eliminarLogicaTarifa = async (req, res) => {
  try {
    console.log("LLegamos al endpoint");

    const {id_tarifa_preferencial_sencilla, id_tarifa_preferencial_doble} = req.body;
    //console.log("Verifiquemos si pasa el id_tarifa",id_tarifa);

    const result = await executeSP("sp_eliminacion_logica_tarifa", [
      id_tarifa_preferencial_sencilla, id_tarifa_preferencial_doble
    ],false);

    res.status(200).json({
      success: true,
      message: "Eliminación lógica de tarifa preferencial exitosa",
      data: result,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al realizar la eliminación lógica de la tarifa",
      error: error.message,
    });
  }
};

const filtroAvanzado = async (req, res) => {
  const {
    desayuno,
    activo,
    acepta_mascotas,
    correo,
    doble_costo_max,
    doble_costo_min,
    doble_precio_max,
    doble_precio_min,
    estado,
    hay_convenio,
    nombre,
    rfc,
    razon_social,
    sencilla_costo_max,
    sencilla_costo_min,
    sencilla_precio_max,
    sencilla_precio_min,
    tipo_hospedaje,
    tipo_negociacion,
    tipo_pago,
    tiene_transportacion,
    pais
  } = req.body;

  // Utilidad para convertir a mayúsculas si es string
  const toUpperOrNull = (val) =>
    typeof val === "string" ? val.toUpperCase() : val ?? null;

  try {
    const result = await executeSP("filtro_completo", [
      toUpperOrNull(desayuno),
      activo ?? null,
      toUpperOrNull(acepta_mascotas),
      toUpperOrNull(correo),
      doble_costo_max ?? null,
      doble_costo_min ?? null,
      doble_precio_max ?? null,
      doble_precio_min ?? null,
      toUpperOrNull(estado),
      toUpperOrNull(hay_convenio),
      toUpperOrNull(nombre),
      toUpperOrNull(rfc),
      toUpperOrNull(razon_social),
      sencilla_costo_max ?? null,
      sencilla_costo_min ?? null,
      sencilla_precio_max ?? null,
      sencilla_precio_min ?? null,
      toUpperOrNull(tipo_hospedaje),
      toUpperOrNull(tipo_negociacion),
      toUpperOrNull(tipo_pago),
      toUpperOrNull(tiene_transportacion),
      toUpperOrNull(pais)
    ], true);

    if (!result) {
      res.status(404).json({ message: "No se encontraron hoteles con esa búsqueda" });
    } else {
      res.status(200).json({ message: "Hoteles recuperados con éxito", data: result });
    }
  } catch (error) {
    console.error("Error al ejecutar filtro_completo:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};


module.exports = {
  readGroupByHotel,
  AgregarHotel,consultaHoteles,actualizaHotel,
    eliminaHotelLogico,consultaPrecioSencilla,consultaPrecioDoble,filtra_hoteles,getTarifasByIdHotel,
    paginacion,BuscaHotelesPorTermino,get_hotel_tarifas_by_nombre,
  readHotelesWithTarifa,actualizarTarifa,eliminarLogicaTarifa,filtroAvanzado

}