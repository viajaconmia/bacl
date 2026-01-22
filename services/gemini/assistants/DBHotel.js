const { Type } = require("@google/genai");
const { Assistant } = require("./Assistant");
const { executeSP } = require("../../../config/db");
const { GeneralAssistant } = require("./General");

class DBHotel extends Assistant {
  constructor() {
    super({
      instrucciones: PROMPT,
      dependencias: {
        tools: [
          {
            functionDeclarations: [routeToAssistantFunctionDeclaration],
          },
        ],
      },
      name: "db_hotel",
    });
  }

  async call(task, history, stack) {
    try {
      // console.log("🏨 DBHotel.call INICIADO =======================");
      // console.log("📋 Historial recibido:", history?.length || 0, "entradas");
      // console.log("📦 Task recibida:", {
      //   tarea: task?.functionCall?.tarea,
      //   args: task?.functionCall?.args,
      //   id: task?.functionCall?.id,
      // });

      const { functionCall } = task;
      const { args } = functionCall;

      // Extraer parámetros
      const params = Array.isArray(args.items)
        ? args.items[0]
        : args.items || {};

      // console.log("🎯 Parámetros extraídos:", params);

      // Preparar parámetros para el stored procedure
      const spParams = [
        params.p_nombre ?? null,
        params.p_estado ?? null,
        params.p_ciudad_zona ?? null,
        params.p_tipo_negociacion ?? null,
        params.p_tipo_pago ?? null,
        params.p_tipo_hospedaje ?? null,
        params.p_rfc ?? null,
        params.p_razon_social ?? null,
        params.p_correo ?? null,
        1, // p_activo siempre es 1
        typeof params.p_convenio !== "undefined" ? params.p_convenio : null,
        params.p_vigencia_inicio ?? null,
        params.p_vigencia_fin ?? null,
        params.p_precio_min ?? null,
        params.p_precio_max ?? null,
        params.p_costo_min ?? null,
        params.p_costo_max ?? null,
        params.p_incluye_desayuno ?? null,
        params.p_tipo_cuarto ?? null,
        params.p_mascotas ?? null,
        params.p_salones ?? null,
        params.p_transportacion ?? null,
      ];

      // console.log(
      //   "⚙️ Ejecutando SP con parámetros:",
      //   spParams.filter((p, i) => p !== null).length,
      //   "parámetros no nulos"
      // );

      // Ejecutar stored procedure
      const res = await executeSP("sp_filtrar_hoteles_avanzado", spParams);
      const result = res.slice(0, 4);

      // console.log("✅ SP ejecutado exitosamente");
      // console.log("📊 Resultados:", {
      //   total: result?.length || 0,
      //   primeros3: result?.slice(0, 3)?.map((h) => ({
      //     id: h.id_hotel?.substring(0, 8) + "...",
      //     nombre:
      //       h.nombre?.substring(0, 30) + (h.nombre?.length > 30 ? "..." : ""),
      //   })),
      // });

      // 1. Verificar si hay resultados
      if (!result || result.length === 0) {
        console.log("⚠️ No se encontraron hoteles");

        const noResultMessage =
          "No encontré hoteles con esos criterios. ¿Quieres intentar con otros parámetros?";

        return [
          {
            role: "assistant",
            functionCall: {
              status: "success",
              tarea: task?.functionCall?.tarea || null,
              assistant: "db_hotel",
              args: task?.functionCall?.args || null,
              id: task?.functionCall?.id || Date.now().toString(),
              resolucion: {
                hotelesEncontrados: 0,
              },
            },
          },
          {
            role: "assistant",
            text: noResultMessage,
          },
        ];
      }

      // 2. Formatear respuesta para el usuario (LO MÁS IMPORTANTE)
      // const userMessage = this.formatHotelResponse(result);

      // console.log("💬 Mensaje formateado para usuario (primeros 200 chars):");
      // console.log(
      //   userMessage.substring(0, 200) + (userMessage.length > 200 ? "..." : "")
      // );

      // 3. Generar XML técnico (para otros agentes si es necesario)
      // Pero NO lo retornamos al frontend directamente
      const hotelIds = result
        .map((hotel) => hotel.id_hotel || hotel.id)
        .filter((id) => id);

      if (hotelIds.length > 0) {
        console.log("📄 Generando XML técnico con", hotelIds.length, "IDs");

        const xmlTechnical = `<root><type>db_hotel</type><seleccionados>${hotelIds
          .map((id) => `<id>${id}</id>`)
          .join("")}</seleccionados></root>`;

        // console.log(
        //   "🔧 XML técnico generado (primeros 100 chars):",
        //   xmlTechnical.substring(0, 100) + "..."
        // );

        // 4. Si necesitas procesar con GeneralAssistant para flujos posteriores
        //   try {
        //     const promptData = prompt_to_general(JSON.stringify(hotelIds));
        //     console.log("🤖 Llamando a GeneralAssistant para procesamiento XML");

        //     const agente = new GeneralAssistant();
        //     const parts = await agente.execute(
        //       [{ text: promptData }],
        //       new Historial()
        //     );

        //     if (parts && parts[0]?.text) {
        //       console.log("✅ GeneralAssistant procesó XML exitosamente");
        //       console.log(
        //         "📋 Respuesta de GeneralAssistant:",
        //         parts[0].text.substring(0, 100) + "..."
        //       );

        //       // Puedes agregar esto al stack si es necesario para flujos posteriores
        //       if (stack && Array.isArray(stack)) {
        //         // Solo agregar si hay function calls en las partes
        //         const newTasks = parts.filter((part) => part.functionCall);
        //         if (newTasks.length > 0) {
        //           stack.push(...newTasks);
        //           console.log(
        //             "📥 Agregadas",
        //             newTasks.length,
        //             "nuevas tareas al stack"
        //           );
        //         }
        //       }
        //     }
        //   } catch (genError) {
        //     console.warn(
        //       "⚠️ Error con GeneralAssistant (no crítico):",
        //       genError.message
        //     );
        //     // No fallamos por esto, solo continuamos
        //   }
        // }

        return [
          // {
          //   role: "assistant",
          //   functionCall: {
          //     status: "success",
          //     tarea: task?.functionCall?.tarea || null,
          //     assistant: "db_hotel",
          //     args: task?.functionCall?.args || null,
          //     id: task?.functionCall?.id || Date.now().toString(),
          //     resolucion: {
          //       userMessage: userMessage,
          //       hotelesEncontrados: result.length,
          //       rawData: result, // opcional para debugging
          //     },
          //   },
          // },
          {
            role: "assistant",
            text: xmlTechnical,
            componente: undefined,
          },
        ];
      }
    } catch (error) {
      console.error("❌ ERROR en DBHotel.call:", {
        mensaje: error.message,
        stack: error.stack,
        task: task,
      });

      // Retornar siempre array procesable incluso en error
      return [
        {
          role: "assistant",
          functionCall: {
            status: "error",
            tarea: task?.functionCall?.tarea || null,
            assistant: "db_hotel",
            args: task?.functionCall?.args || null,
            id: task?.functionCall?.id || Date.now().toString(),
            resolucion: {
              hotelesEncontrados: 0,
              error: error.message,
            },
          },
        },
        {
          role: "assistant",
          text: "Lo siento, ocurrió un error al buscar hoteles en nuestra base de datos. Por favor, intenta de nuevo o contacta con soporte técnico.",
          componente: undefined,
        },
      ];
    }
  }

  /**
   * Formatea los resultados de hoteles para mostrarlos al usuario
   * @param {Array} hotels - Array de hoteles del SP
   * @returns {string} - Mensaje formateado para el usuario
   */
  formatHotelResponse(hotels) {
    console.log("🎨 Formateando respuesta para", hotels.length, "hoteles");

    if (!hotels || hotels.length === 0) {
      return "No se encontraron hoteles con esos criterios.";
    }

    // Si es solo un hotel, dar información detallada
    if (hotels.length === 1) {
      return this.formatSingleHotel(hotels[0]);
    }

    // Si son múltiples hoteles, dar un resumen
    return this.formatMultipleHotels(hotels);
  }

  /**
   * Formatea un solo hotel con detalles completos
   */
  formatSingleHotel(hotel) {
    console.log("🔍 Formateando hotel individual:", hotel.nombre);

    // Precio más relevante
    let precioInfo = "Consultar precio";
    let precioNumero = null;

    if (
      hotel.precio_doble &&
      hotel.precio_doble !== "0.00" &&
      hotel.precio_doble !== "0"
    ) {
      precioNumero = parseFloat(hotel.precio_doble);
      precioInfo = `$${precioNumero.toFixed(2)} MXN (habitación doble)`;
    } else if (
      hotel.precio_sencilla &&
      hotel.precio_sencilla !== "0.00" &&
      hotel.precio_sencilla !== "0"
    ) {
      precioNumero = parseFloat(hotel.precio_sencilla);
      precioInfo = `$${precioNumero.toFixed(2)} MXN (habitación sencilla)`;
    }

    // Servicios
    const servicios = [];
    if (hotel.desayuno_doble || hotel.desayuno_sencilla)
      servicios.push("☕ Desayuno incluido");
    if (hotel.mascotas === "SI") servicios.push("🐾 Acepta mascotas");
    if (hotel.Transportacion === "SI")
      servicios.push("🚗 Transportación disponible");
    if (hotel.salones === "SI") servicios.push("🏛️ Salones para eventos");

    // Dirección corta
    let direccionCorta = hotel.direccion || "Dirección no disponible";
    if (direccionCorta.length > 60) {
      direccionCorta = direccionCorta.substring(0, 57) + "...";
    }

    // Construir respuesta
    let response = `✨ **${hotel.nombre || "Hotel encontrado"}** ✨\n\n`;
    response += `📍 **Ubicación**: ${
      hotel.Ciudad_Zona || "Playa del Carmen"
    }\n`;
    response += `🏠 **Dirección**: ${direccionCorta}\n`;
    response += `💰 **Precio por noche**: ${precioInfo}\n`;

    if (servicios.length > 0) {
      response += `🎯 **Servicios incluidos**:\n`;
      servicios.forEach((servicio) => {
        response += `   • ${servicio}\n`;
      });
    }

    // Contacto si está disponible
    if (hotel.contacto_recepcion) {
      const contacto =
        hotel.contacto_recepcion.length > 40
          ? hotel.contacto_recepcion.substring(0, 37) + "..."
          : hotel.contacto_recepcion;
      response += `\n📞 **Información de contacto**: ${contacto}\n`;
    }

    response += `\n¿Te gustaría reservar este hotel o necesitas más información?`;

    return response;
  }

  /**
   * Formatea múltiples hoteles en un resumen
   */
  formatMultipleHotels(hotels) {
    console.log("📊 Formateando", hotels.length, "hoteles en resumen");

    // Limitar para no saturar
    const displayLimit = Math.min(6, hotels.length);
    const displayHotels = hotels.slice(0, displayLimit);

    let response = `🏨 **Encontré ${hotels.length} hoteles disponibles** 🏨\n\n`;

    // Encabezado de la lista
    response += "| # | Hotel | Precio | Servicios |\n";
    response += "|---|-------|--------|-----------|\n";

    displayHotels.forEach((hotel, index) => {
      // Nombre corto
      const nombreCorto = hotel.nombre
        ? hotel.nombre.length > 25
          ? hotel.nombre.substring(0, 22) + "..."
          : hotel.nombre
        : "Hotel";

      // Precio
      let precio = "Consultar";
      if (
        hotel.precio_doble &&
        hotel.precio_doble !== "0.00" &&
        hotel.precio_doble !== "0"
      ) {
        precio = `$${parseFloat(hotel.precio_doble).toFixed(0)}`;
      } else if (
        hotel.precio_sencilla &&
        hotel.precio_sencilla !== "0.00" &&
        hotel.precio_sencilla !== "0"
      ) {
        precio = `$${parseFloat(hotel.precio_sencilla).toFixed(0)}`;
      }

      // Iconos de servicios
      const iconos = [
        hotel.desayuno_doble || hotel.desayuno_sencilla ? "☕" : "",
        hotel.mascotas === "SI" ? "🐾" : "",
        hotel.Transportacion === "SI" ? "🚗" : "",
      ]
        .filter((i) => i !== "")
        .join(" ");

      response += `| ${index + 1} | ${nombreCorto} | ${precio} | ${
        iconos || "-"
      } |\n`;
    });

    response += "\n";

    // Si hay más hoteles de los mostrados
    if (hotels.length > displayLimit) {
      response += `... y ${hotels.length - displayLimit} hoteles más.\n\n`;
    }

    // Hoteles destacados (los primeros 3 con mejor información)
    const destacados = hotels
      .slice(0, 3)
      .filter((h) => h.nombre && h.precio_doble);
    if (destacados.length > 0) {
      response += `💎 **Algunas opciones destacadas:**\n\n`;

      destacados.forEach((hotel, index) => {
        const precio = hotel.precio_doble
          ? `$${parseFloat(hotel.precio_doble).toFixed(0)}`
          : "Consultar";

        response += `${index + 1}. **${hotel.nombre}** - ${precio} MXN/noche\n`;

        // Servicios destacados
        const serviciosDest = [];
        if (hotel.desayuno_doble || hotel.desayuno_sencilla)
          serviciosDest.push("Desayuno");
        if (hotel.mascotas === "SI") serviciosDest.push("Mascotas");
        if (hotel.Transportacion === "SI") serviciosDest.push("Transporte");

        if (serviciosDest.length > 0) {
          response += `   ✅ ${serviciosDest.join(", ")}\n`;
        }

        response += `   📍 ${hotel.Ciudad_Zona || "Playa del Carmen"}\n\n`;
      });
    }

    // Opciones para el usuario
    response += `🔍 **¿Qué te gustaría hacer?**\n`;
    response += `1. Ver detalles de algún hotel específico (dime el número)\n`;
    response += `2. Filtrar por precio máximo (ej: "menos de $2000")\n`;
    response += `3. Buscar hoteles con desayuno incluido\n`;
    response += `4. Ver más opciones\n\n`;

    response += `Solo dime qué necesitas 😊`;

    return response;
  }
}

// Prompts y funciones auxiliares
const prompt_to_general = (data) => `
<SISTEMA>
Eres un motor de transformación de datos "headless". Tu única función es convertir arrays JSON de entrada en una estructura XML específica. No tienes personalidad, no conversas, solo procesas datos.
</SISTEMA>

<CONTEXTO>
Recibirás un input que contiene un array JSON de IDs (ejemplo: ["id1", "id2"]). Tu tarea es mapear cada elemento de ese array a la estructura XML definida en la plantilla.
</CONTEXTO>

<PLANTILLA_EXITO>
<root>
    <type>"db_hotel"</type>
    <seleccionados>
        <id>{VALOR_ID}</id>
    </seleccionados>
</root>
</PLANTILLA_EXITO>

<REGLAS_CRITICAS>
1. SALIDA PURA: Tu respuesta debe ser EXCLUSIVAMENTE el código XML.
   - PROHIBIDO usar bloques de código markdown (\`\`\`xml).
   - PROHIBIDO escribir frases como "Aquí está el XML".
   - Empieza inmediatamente con <root>.

2. LOGICA DE ITERACION:
   - Debes generar una etiqueta <id> por cada elemento existente en el array JSON.
   - Si el array tiene 3 elementos, debe haber 3 etiquetas <id>.

3. MANEJO DE CASOS BORDE:
   - Caso Array Vacío ([]): Devuelve la estructura con <seleccionados/> (autocerrado) o vacío.
   - Caso Null/Invalido: Si la entrada no es un array o es ilegible, devuelve: <error>INPUT_INVALIDO</error>.

4. FORMATO:
   - El valor de <type> siempre debe incluir las comillas dobles internas: "db_hotel".
   - Mantén la indentación para legibilidad.
</REGLAS_CRITICAS>

<INPUT_USUARIO>
${data}
</INPUT_USUARIO>
`;

const routeToAssistantFunctionDeclaration = {
  name: "conectar_a_buscador_hoteles_db",
  description: "Look for hotels matches in local db data.",
  parameters: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        p_nombre: { type: Type.STRING, description: "Nombre del hotel" },
        p_estado: { type: Type.STRING, description: "Estado" },
        p_ciudad_zona: { type: Type.STRING, description: "Ciudad o zona" },
        p_tipo_hospedaje: {
          type: Type.STRING,
          description: "Tipo de hospedaje",
        },
        p_activo: { type: Type.INTEGER, description: "Activo (1/0)" },
        p_precio_min: { type: Type.NUMBER, description: "Precio mínimo" },
        p_precio_max: { type: Type.NUMBER, description: "Precio máximo" },
        p_incluye_desayuno: {
          type: Type.STRING,
          description: 'Incluye desayuno: "SI" / "NO"',
        },
        p_tipo_cuarto: { type: Type.STRING, description: "Tipo de cuarto" },
        p_mascotas: { type: Type.STRING, description: "Mascotas: 'SI'/'NO'" },
        p_salones: { type: Type.STRING, description: "Salones: 'SI'/'NO'" },
        p_transportacion: {
          type: Type.STRING,
          description: "Transportación: 'SI'/'NO'",
        },
      },
      required: [],
    },
  },
};

const PROMPT = `<INSTRUCCION_AGENTE_DB_HOTEL>
  <ROL>
    Eres el Agente DB_HOTEL, un especialista en parametrización de consultas a bases de datos.
    Tu OBJETIVO ÚNICO es traducir las instrucciones de búsqueda recibidas (XML o texto) en una ejecución precisa de la herramienta 'conectar_a_buscador_hoteles_db'.
  </ROL>

  <REGLAS_DE_PARAMETRIZACION>
    1. **INTERPRETACIÓN DE DATOS**: Analiza el bloque <DATOS_ENTRADA> recibido. Extrae ubicación, precios y servicios solicitados.
    
    2. **MAPEO DE CAMPOS OBLIGATORIO**:
       - **p_ciudad_zona**: Es el campo más importante. Extrae la ciudad y zona (ej. "Monterrey Centro", "Guadalajara").
       - **p_activo**: SIEMPRE debe ser **1** (Integer).
       - **p_estado**: Solo si el usuario menciona explícitamente el estado (ej. "Nuevo León").
    
    3. **MAPEO DE FILTROS OPCIONALES**:
       - **p_precio_min / p_precio_max**:
          - Si el usuario dice "barato" o "económico", usa p_precio_max: 1500.
          - Si el usuario dice "lujo", usa p_precio_min: 4000.
          - Si da un rango ("entre 1000 y 2000"), úsalos literalmente.
       - **SERVICIOS (Strings "SI" / "NO")**:
          - **p_incluye_desayuno**: "SI" si pide desayuno/alimentos.
          - **p_mascotas**: "SI" si menciona perros/gatos/mascotas.
          - **p_salones**: "SI" si menciona eventos/conferencias.
          - **p_transportacion**: "SI" si menciona aeropuerto/traslado.

    4. **ESTRUCTURA DE LLAMADA**:
       - Tu función espera un **ARRAY** de objetos. Asegúrate de pasar una lista, incluso si es un solo criterio.
       - Ejemplo estructura JSON esperada en la tool: \`[ { "p_ciudad_zona": "Monterrey", "p_activo": 1, ... } ]\`

    5. **COMPORTAMIENTO**: NO hables. NO expliques. Solo invoca la herramienta.
  </REGLAS_DE_PARAMETRIZACION>

  <REGLAS_DE_RESPUESTA>
  1.  MANEJO DE DATA: Deberas revisar la data obtenida de la herramienta 'conectar_a_buscador_hoteles_db' y verificar que cumpla con lo pedido
  2.  FORMATEAR DATA: Deberas darle el formato a la data de un array escrito como se muestra en la plantilla exito
  3.  SIN HOTELES: SI NO EXISTEN HOTELES DEBERAS MANDAR LA LABEL DE lista_id_hoteles VACIA
  4.  SOLO SE DEBERAN PONER LOS ID DE LOS HOTELS QUE TE TRAIGA LA RESPUESTA NINGUNO OTRO
  </REGLAS_DE_RESPUESTA>

  <PLANTILLA_EXITO>
  <root>
  <lista_id_hoteles>
  <id_hotel>[ej. abdc51...]</id_hotel>
  </lista_id_hoteles>
  </root>
  </PLANTILLA_EXITO>

</INSTRUCCION_AGENTE_DB_HOTEL>`;

// Clase Historial auxiliar si no está importada
class Historial {
  constructor() {
    this.entries = [];
  }

  get length() {
    return this.entries.length;
  }

  update(...parts) {
    this.entries.push(...parts);
  }
}

module.exports = { DBHotel };
