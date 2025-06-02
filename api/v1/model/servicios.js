const { executeTransaction } = require("../../../config/db");
const { v4: uuidv4 } = require("uuid");

const crearServicio = async (data) => {
  try {
    const {
      total,
      subtotal,
      impuestos,
      otros_impuestos,
      is_credito = false,
      fecha_limite_pago,
      check_in,
      check_out,
      impuestos_booking,
      estado_booking,
      fecha_pago_proveedor,
      costo_total,
      costo_subtotal,
      costo_impuestos,
      fecha_limite_cancelacion,
    } = data;

    const id_servicio = `ser-${uuidv4()}`;
    const queryServicio = `
      INSERT INTO servicios (id_servicio, total, subtotal, impuestos, otros_impuestos, is_credito, fecha_limite_pago)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    let paramsServicio = [
      id_servicio,
      total,
      subtotal,
      impuestos,
      otros_impuestos,
      is_credito,
      fecha_limite_pago,
    ];

    // Crear el servicio y luego crear el booking dentro de la transacción
    let response = await executeTransaction(queryServicio, paramsServicio, async (results, connection) => {
      console.log("Servicio creado con éxito");

      // Una vez creado el servicio, se genera el id_booking
      const id_booking = `ser-${uuidv4()}`; // Generar un id_booking con prefijo

      const queryBooking = `
        INSERT INTO bookings (id_booking, id_servicio, check_in, check_out, total, subtotal, impuestos, estado, fecha_pago_proveedor, costo_total, costo_subtotal, costo_impuestos, fecha_limite_cancelacion, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;

      const paramsBooking = [
        id_booking,
        id_servicio, // El id_servicio que acabamos de crear
        check_in,
        check_out,
        total,
        subtotal,
        impuestos_booking,
        estado_booking,
        fecha_pago_proveedor,
        costo_total,
        costo_subtotal,
        costo_impuestos,
        fecha_limite_cancelacion,
      ];

      // Insertar el booking usando la misma conexión de la transacción
      await connection.execute(queryBooking, paramsBooking);
      console.log("Booking creado con éxito");
    });

    return response;

  } catch (error) {
    console.error("Error al crear el servicio o el booking:", error);
    throw error;
  }
};

//ELIMINAR LO QUE HAY AQUI ABAJO, NO SIRVE DE NADA

let empresa = {
  id_empresa: "uuid",
  razon_social: "noktos",
  rfc: "",
  nombre_comercial: "",
  direccion: "",
  direccion_fiscal: "",
  codigo_postal: "42942",
  regimen_fiscal: "",
}

let viajero = {
  id_viajero: "uuid",
  id_empresa: "uuid",
  primer_nombre: "",
  segundo_nombre: "",
  apellido_paterno: "",
  apellido_materno: "",
  correo: "",
  fecha_nacimiento: "2000-12-12",
  genero: "m/f",
  telefono: 551637163,
}


let respuesta = {
  total: 0, //Suma de todas las noches
  impuestos: 0, //Suma total de los impuestos
  is_credito: false, // por si lo pago con credito
  fecha_limite_pago: "2025-11-12", //Fecha limite de pago mas proxima
  booking: {
    check_in: "2025-11-10",
    check_out: "2025-11-10",
    total: 0, //Total de noches
    nombre_hotel: "", //nombre del hotel
    cadena_hotel: "", //Por ahora se queda vacia
    tipo_cuarto: "",
    numero_habitacion: "", //Falta agregar un campo para esto
    noches: "", //Total de noches
    is_rembolsable: false, //Falta agregar un checkbox, pero por ahora sera false
    monto_penalizacion: 0, //Falta agregar un input, pero por ahora sera 0
    conciliado: false, //Siempre es false
    credito: false, //depende del checkbox is_credito
    codigo_reservacion_hotel: "", //del input
    estado: "pending",
    costo_total: 0, //Falta agregar input
    costo_impuestos: 0, //Falta agregar input
    costo_subtotal: 0, //Falta agregar input
    fecha_limite_pago: "2025-11-21",
    fecha_limite_cancelacion: "2025-11-21",
    items: [
      {
        id_item: 0,
        total: 0,
        subtotal: 0,
        impuestos: [
          {
            id_impuesto: 0,
            name: "iva",
            total: 0,
            base: 0,
            rate: .16
          }
        ],
      }
    ],
    viajeros: [
      {
        id_viajero: 0,
        is_principal: true
      },
      {
        id_viajero: 1,
        is_principal: false
      },
    ]
  }
}
