const React = require("react");
const { formatLargeDate } = require("../../../lib/utils/formats");

async function generarPDFHotel(data) {
  // 🔥 import dinámico (clave para Vercel)
  const ReactPDF = await import("@react-pdf/renderer");

  const { Document, Page, Text, View, StyleSheet, renderToBuffer } = ReactPDF;

  // =========================
  // 🎨 STYLES
  // =========================
  const styles = StyleSheet.create({
    page: {
      padding: 20,
      fontSize: 11,
      flexDirection: "row",
      alignItems: "stretch",
    },
    main: {
      flex: 1,
    },
    container: {
      borderWidth: 1,
      borderColor: "#e5e7eb",
      flex: 1,
    },
    header: {
      backgroundColor: "#0b5fa5",
      color: "white",
      padding: 12,
      fontSize: 14,
      fontWeight: "bold",
    },
    section: {
      padding: 12,
    },
    row: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderColor: "#ddd",
    },
    label: {
      width: "40%",
      backgroundColor: "#f1f5ff",
      padding: 6,
      fontWeight: "bold",
    },
    value: {
      width: "60%",
      padding: 6,
      textAlign: "center",
    },
    footer: {
      backgroundColor: "#00a3c4",
      padding: 10,
      fontSize: 10,
      fontWeight: "bold",
    },
    note: {
      fontSize: 9,
      color: "#444",
    },
    notesBox: {
      width: 160,
      marginLeft: 6,
      borderWidth: 1,
      borderColor: "#aaa",
      borderStyle: "dashed",
      borderLeftWidth: 2,
      borderLeftColor: "#555",
      padding: 8,
    },
    notesHeader: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#0b5fa5",
      marginBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: "#ccc",
      paddingBottom: 4,
    },
    notesContent: {
      fontSize: 9,
      color: "#333",
    },
  });

  // =========================
  // 🔧 COMPONENTES (SIN ASYNC)
  // =========================
  const Row = ({ label, value, note }) =>
    React.createElement(
      View,
      { style: styles.row },
      React.createElement(Text, { style: styles.label }, label),
      React.createElement(
        View,
        { style: styles.value },
        React.createElement(Text, null, value || "-"),
        note ? React.createElement(Text, { style: styles.note }, note) : null,
      ),
    );

  const HotelPDF = ({ data }) =>
    React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: [800, 400], style: styles.page },

        // CONTENIDO PRINCIPAL
        React.createElement(
          View,
          { style: styles.main },
          React.createElement(
            View,
            { style: styles.container },

            // HEADER
            React.createElement(
              View,
              { style: styles.header },
              React.createElement(Text, null, "HOSPEDAJE 2026"),
            ),

            // CONTENT
            React.createElement(
              View,
              { style: styles.section },
              React.createElement(Row, {
                label: "HOTEL:",
                value: data.hotel,
              }),
              React.createElement(Row, {
                label: "HABITACIÓN:",
                value: "SENCILLA",
              }),
              React.createElement(Row, {
                label: "CHECK-IN:",
                value: formatLargeDate(data.checkin),
              }),
              React.createElement(Row, {
                label: "CHECK-OUT:",
                value: formatLargeDate(data.checkout),
              }),
              React.createElement(Row, {
                label: "SUBTOTAL:",
                value: `$ ${data.subtotal}`,
                note: "Precio sin impuestos por noche",
              }),
              React.createElement(Row, {
                label: "PRECIO TOTAL:",
                value: `$ ${data.total}`,
                note: "Precio con impuestos por noche",
              }),
              React.createElement(Row, {
                label: "DESAYUNO INCLUIDO:",
                value: data.desayuno ? "SI" : "NO",
              }),
              React.createElement(Row, {
                label: "DIRECCIÓN:",
                value: data.direccion,
              }),
            ),

            // FOOTER
            React.createElement(
              View,
              { style: styles.footer },
              React.createElement(Text, null, "Tarifa no reembolsable"),
            ),
          ),
        ),

        // CUADRO DE NOTAS (orilla derecha, recortable)
        React.createElement(
          View,
          { style: styles.notesBox },
          React.createElement(
            Text,
            { style: styles.notesHeader },
            "NOTAS",
          ),
          React.createElement(
            Text,
            { style: styles.notesContent },
            data.notas || "",
          ),
        ),
      ),
    );

  // =========================
  // 🧾 GENERAR PDF
  // =========================
  const buffer = await renderToBuffer(React.createElement(HotelPDF, { data }));

  return buffer;
}

module.exports = { generarPDFHotel };
