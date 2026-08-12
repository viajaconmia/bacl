const { applyLike, applyExact, applyDateRange } = require("./filters");

class BookingInclude {
  apply(builder, filters) {
    builder.addSelect(
      "vw.type",
      "vw.created_at as created_at_booking",
      "vw.nombre_agente AS cliente",
      "vw.codigo_confirmacion",
      "vw.id_proveedor",
      "vw.proveedor",
      "vw.check_in",
      "vw.check_out",
      "GREATEST(DATEDIFF(vw.check_out, vw.check_in), 1) AS noches",
      "vw.costo_total",
      "((vw.total - vw.costo_total) / vw.total) * 100 AS markup",
      "vw.total",
      "vw.negociacion_proveedor",
      "inter.id AS id_intermediario",
      "inter.proveedor AS intermediario",
      "inter.negociacion AS negociacion_intermediario",
    );
    builder.addJoin(
      "LEFT JOIN vw_new_details_booking vw ON spp.id_booking = vw.id_booking",
    );
    builder.addJoin(
      "LEFT JOIN proveedores inter ON inter.id = vw.id_intermediario",
    );

    applyLike(builder, "vw.codigo_confirmacion", filters.codigo_confirmacion);
    applyLike(builder, "vw.nombre_agente", filters.cliente);
    applyLike(builder, "vw.proveedor", filters.proveedor);
    applyLike(builder, "vw.negociacion_proveedor", filters.tipo_negociacion);
    applyExact(builder, "vw.type", filters.servicio);
    applyDateRange(
      builder,
      "vw.check_in",
      filters.checkin_inicio,
      filters.checkin_fin,
    );
  }
}

class FacturasInclude {
  apply(builder, filters) {
    builder.addSelect(
      "fpp.rfc_emisor AS rfc",
      "fpp.uuid_cfdi AS uuid",
      "fpp.id_factura_proveedor AS id_factura",
      "pfp.monto_facturado_final AS asignado_a_factura",
      "pfp.monto_propina",
      "pfp.monto_impsan",
      `ROW_NUMBER() OVER (
        PARTITION BY spp.id_solicitud_proveedor
        ORDER BY pfp.id
      ) AS indice_factura`,
      `COUNT(pfp.id) OVER (
        PARTITION BY spp.id_solicitud_proveedor
      ) AS total_facturas`,
    );
    builder.addJoin(
      "LEFT JOIN pagos_facturas_proveedores pfp ON pfp.id_solicitud = spp.id_solicitud_proveedor",
    );
    builder.addJoin(
      "LEFT JOIN facturas_pago_proveedor fpp ON fpp.id_factura_proveedor = pfp.id_factura",
    );
    builder.addGroupBy("pfp.id");

    if (filters.rfc) {
      builder.addWhere(
        `spp.id_solicitud_proveedor IN (
          SELECT pfp2.id_solicitud FROM pagos_facturas_proveedores pfp2
          INNER JOIN facturas_pago_proveedor fpp2 ON fpp2.id_factura_proveedor = pfp2.id_factura
          WHERE fpp2.rfc_emisor LIKE ?
        )`,
        `%${filters.rfc}%`,
      );
    }
    if (filters.uuid) {
      builder.addWhere(
        `spp.id_solicitud_proveedor IN (
          SELECT pfp2.id_solicitud FROM pagos_facturas_proveedores pfp2
          INNER JOIN facturas_pago_proveedor fpp2 ON fpp2.id_factura_proveedor = pfp2.id_factura
          WHERE fpp2.uuid_cfdi LIKE ?
        )`,
        `%${filters.uuid}%`,
      );
    }
  }
}

module.exports = { BookingInclude, FacturasInclude };
