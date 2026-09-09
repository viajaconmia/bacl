# 📝 Bitácora de Diseño y Discusión Técnica: Servidor MCP de Consultas

**Fecha:** 31 de Agosto de 2026  
**Participantes:** Ángel (Desarrollo Backend / Arquitectura) & Antigravity (AI Pair Programmer)  
**Propósito:** Registrar el proceso de análisis, las opciones evaluadas, las ideas discutidas y las justificaciones técnicas detrás del diseño final del servidor MCP.

---

## 1. Contexto Inicial y Punto de Partida

El objetivo inicial consistía en analizar el backend (`bacl`) para documentar todos los endpoints de lectura (`GET` y `POST` de búsqueda/filtrado) con el fin de crear un **servidor MCP (Model Context Protocol)** de consultas, evitando incluir endpoints de mutación (`POST` de creación, `PATCH`, `DELETE`) para ahorrar tokens.

**Resultado del relevamiento:** Se documentaron más de 40 endpoints en el archivo maestro [API_CONTRACT.md](./API_CONTRACT.md).

---

## 2. Debate Técnico: ¿Por qué NO incluir los 40+ endpoints en el MCP?

Durante la sesión de diseño técnico, analizamos la viabilidad de exponer la totalidad del catálogo en el MCP. Se concluyó que hacerlo representaría un **grave antipatrón** por las siguientes razones:

### A. Sobrecarga Crítica de Tokens (Context Bloat)

Cada herramienta (_tool_) expuesta en un servidor MCP requiere un esquema JSON (nombre, descripción detallada y lista de parámetros). 40 herramientas inyectarían **miles de tokens fijos en cada petición del usuario**, encareciendo la operación y ralentizando el tiempo de respuesta del LLM.

### B. Confusión de Selección de Herramientas (_Tool Hallucination_)

Tener múltiples endpoints que resuelven variantes de una misma consulta (ej. `Consultar-precio-sencilla`, `Consultar-precio-doble`, `Consultar-hoteles`, `allowed`, `Filtro-avanzado`) provoca que el modelo dude o elija herramientas incompletas o erróneas.

### C. Restricción de Autenticación (Solo `x-api-key`)

Las rutas administrativas (`/v1/admin/*`) dependen de cookies de sesión de usuario (`access-token`) y permisos en base de datos (`vw_permisos_by_user`). Para una primera versión de pruebas basada únicamente en `x-api-key`, estas rutas debían descartarse.

---

## 3. Giro Estratégico: El Enfoque en el Cliente (Travel Concierge)

### El Requerimiento Clave

Durante la discusión se clarificó el caso de uso real: **el agente de IA actuará como asistente del cliente/agencia**, no como un super-administrador de backoffice.

De este principio derivaron las siguientes decisiones de diseño:

### 1. Inyección Segura de `id_agente` en el MCP

- **Decisión:** El `id_agente` no debe ser enviado libremente por el usuario en cada prompt; el servidor MCP lo manejará como variable de entorno o parámetro inyectado por defecto.
- **Justificación:** Garantiza aislamiento multi-tenant estricto para esta fase de pruebas, impidiendo que el asistente consulte datos de otras agencias.

### 2. Filtros Forzosos en `consultar_reservas` (Anti-Dumps)

- **Debate:** ¿Debería el modelo poder pedir _"todas las reservas de mi empresa"_ sin filtros?
- **Decisión:** **No.** Se acordó forzar al modelo a proporcionar al menos 2 filtros:
  - **Temporalidad:** Obligatorio decidir entre `'proximas'` (check-in futuro/hoy), `'pasadas'` (históricas) o `'todas'` con rango de fechas.
  - **Filtro discriminador:** `id_viajero`, `tipo_servicio` (hotel/vuelo/auto) o `codigo_confirmacion`.
- **Justificación:** Protege la base de datos contra escaneos masivos y evita que el modelo reciba respuestas gigantescas de 500 filas que agoten su ventana de contexto.

### 3. Separación de Cupones por Tipo de Servicio

- **Decisión:** En lugar de un solo endpoint genérico, crear herramientas específicas para cupones:
  - `obtener_cupon_hotel` (Hotel, noches, tipo habitación, confirmación).
  - `obtener_cupon_vuelo` (Tramos aéreos, escalas, aerolíneas, horarios, equipaje).
  - `obtener_cupon_auto` (Arrendadora, modelo, sucursales, conductor).
- **Justificación:** Cada servicio tiene una estructura de datos muy diferente. Respuestas limpias y estructuradas facilitan que el LLM redacte respuestas claras al usuario.

### 4. Herramienta de Apoyo: `listar_viajeros`

- **Decisión:** Incluir la consulta de viajeros del cliente.
- **Justificación:** Permite el flujo en dos pasos: cuando el usuario pregunta _"¿Qué vuelos tiene María?"_, el LLM primero busca a María en `listar_viajeros`, obtiene su `id_viajero` y luego llama a `consultar_reservas` con ese ID.

### 5. Consulta Financiera: `consultar_saldo_credito`

- **Decisión:** Exponer saldo a favor en wallet y crédito disponible.
- **Justificación:** Es una de las preguntas más recurrentes de los clientes hacia atención a clientes.

---

## 4. Resumen de Decisiones y Acuerdos

| Tema Discutido             | Propuesta Inicial                     | Decisión Final Acordada                             | Razón Principal                                                      |
| :------------------------- | :------------------------------------ | :-------------------------------------------------- | :------------------------------------------------------------------- |
| **Alcance de Endpoints**   | Exponer los 40+ endpoints de v1 y v2. | **Reducir a 6 herramientas prioritarias.**          | Evitar saturación de tokens, latencia y alucinación de herramientas. |
| **Rol del Asistente**      | Admin / Backoffice general.           | **Cliente / Agencia (Travel Concierge).**           | Casos de uso de consulta más claros y seguros.                       |
| **Seguridad Multi-Tenant** | Recibir `id_agente` libremente.       | **Inyectar `id_agente` por default en el MCP.**     | Aislamiento estricto de datos entre agencias.                        |
| **Autenticación**          | Soporte mixto (JWT + API Key).        | **Solo `x-api-key` para la V1.**                    | Simplicidad y rapidez en fase de pruebas.                            |
| **Consulta de Reservas**   | Búsqueda abierta por agencia.         | **Filtros obligatorios de temporalidad y viajero.** | Control de costos y evitar volcados masivos.                         |
| **Backend V2**             | Reusar vistas existentes de v1.       | **Crear endpoint optimizado v2 para cliente.**      | Mayor velocidad y formato limpio para el MCP.                        |

---

## 5. Documentación Resultante

1. [API_CONTRACT.md](./API_CONTRACT.md): Inventario técnico exhaustivo de todos los endpoints de lectura de v1, v2 y admin.
2. [PROPUESTA_MCP_CLIENTE.md](./PROPUESTA_MCP_CLIENTE.md): Propuesta ejecutiva y técnica formal para revisión y aprobación de liderazgo.
3. [BITACORA_DISENO_MCP.md](./BITACORA_DISENO_MCP.md): Este documento, con la justificación y memoria técnica del proyecto.
