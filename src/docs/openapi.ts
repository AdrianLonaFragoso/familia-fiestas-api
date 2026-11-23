import { AVATAR_IDS } from "../schemas/common.js";

const adminSecurity = [{ AdminKey: [] }];

const errorResponse = {
  description: "Error",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
};

const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};

const eventIdParam = {
  name: "eventId",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};

const slugParam = {
  name: "slug",
  in: "path",
  required: true,
  schema: { type: "string" },
};

const okJson = (description: string) => ({
  description,
  content: { "application/json": { schema: { type: "object" } } },
});

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Familia Fiestas API",
    version: "1.0.0",
    description:
      "API de eventos. Público: inicio reducido, registro y avisos publicados. X-Admin-Key identifica superusuario (ADMIN_API_KEY vigente) o anfitrión con eventos asignados. Solo el superusuario crea, borra y libera eventos y administra cuentas. Familias/directorio ya no son públicos; anfitriones usan /admin/families y /participants con alcance por evento. Invitaciones personales: solo superusuario.",
  },
  servers: [{ url: "/api/v1", description: "Servidor actual" }],
  tags: [
    { name: "Público" },
    { name: "Invitaciones" },
    { name: "Administración" },
  ],
  components: {
    securitySchemes: {
      AdminKey: {
        type: "apiKey",
        in: "header",
        name: "X-Admin-Key",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "object", nullable: true },
            },
          },
        },
      },
      RsvpStatus: {
        type: "string",
        enum: ["pending", "confirmed", "declined"],
      },
      Calendar: {
        type: "object",
        properties: {
          available: { type: "boolean" },
          missing_reason: { type: "string", nullable: true },
          google_url: { type: "string", nullable: true },
          ics_url: { type: "string", nullable: true },
          start_instant: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          end_instant: { type: "string", format: "date-time", nullable: true },
        },
      },
    },
  },
  paths: {
    "/admin/me": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Cuenta, nivel y eventos asignados de la clave actual",
        responses: {
          "200": okJson("Identidad sin credenciales"),
          "401": errorResponse,
        },
      },
    },
    "/admin/accounts": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Lista cuentas de anfitrión (solo superusuario)",
        responses: {
          "200": okJson(
            "Cuentas con event_ids y prefijos de claves; nunca hashes ni claves completas",
          ),
          "403": errorResponse,
        },
      },
      post: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Crea anfitrión y su primera clave (solo superusuario)",
        description:
          "Body: name, email opcional, event_ids (UUID únicos). Devuelve account y key una sola vez. La cuenta nace activa; no se envían correos.",
        responses: {
          "201": okJson("Cuenta y clave recién generada"),
          "403": errorResponse,
        },
      },
    },
    "/admin/accounts/{id}": {
      patch: {
        tags: ["Administración"],
        security: adminSecurity,
        parameters: [idParam],
        summary:
          "Edita cuenta, activa/desactiva o reemplaza asignaciones (solo superusuario)",
        description:
          "Body parcial: name, email, is_active, event_ids. Los cambios se consultan en cada petición.",
        responses: {
          "200": okJson("Cuenta sin clave completa"),
          "403": errorResponse,
        },
      },
    },
    "/admin/accounts/{id}/rotate-key": {
      post: {
        tags: ["Administración"],
        security: adminSecurity,
        parameters: [idParam],
        summary: "Revoca las claves vigentes y genera otra (solo superusuario)",
        responses: {
          "200": okJson("key mostrada una sola vez"),
          "403": errorResponse,
        },
      },
    },
    "/admin/accounts/{id}/revoke-key/{keyId}": {
      post: {
        tags: ["Administración"],
        security: adminSecurity,
        parameters: [
          idParam,
          {
            name: "keyId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        summary: "Revoca una clave de la cuenta (solo superusuario)",
        responses: { "200": okJson("Clave revocada"), "403": errorResponse },
      },
    },
    "/health": {
      get: {
        tags: ["Público"],
        summary: "Estado del servicio",
        responses: { "200": okJson("Servicio disponible") },
      },
    },
    "/home": {
      get: {
        tags: ["Público"],
        summary: "Datos agregados de la página de inicio",
        description:
          "Público: events liberados con fecha/hora/lugar/anfitriones, sin contadores ni datos organizativos. Con clave, los contadores/datos completos se entregan solo para eventos autorizados; upcoming_events es vacío para público y restringido a asignaciones para anfitriones; incluye slug para identificar su imagen y contiene solo menciones de eventos no liberados cuya fecha aún no termina en America/Mexico_City. También incluye avisos ordenados, próxima celebración liberada y avisos destacados.",
        responses: { "200": okJson("Contenido de inicio") },
      },
    },
    "/events": {
      get: {
        tags: ["Público"],
        summary: "Lista de celebraciones liberadas con contadores",
        responses: { "200": okJson("Celebraciones") },
      },
    },
    "/events/{slug}": {
      get: {
        security: adminSecurity,
        tags: ["Público"],
        summary: "Detalle completo de una celebración",
        parameters: [slugParam],
        responses: {
          "200": okJson("Bundle de la celebración"),
          "404": errorResponse,
        },
      },
    },
    "/events/{slug}/calendar.ics": {
      get: {
        security: adminSecurity,
        tags: ["Público"],
        summary: "Descargar calendario ICS de una celebración",
        parameters: [slugParam],
        responses: {
          "200": {
            description: "Archivo iCalendar",
            content: { "text/calendar": { schema: { type: "string" } } },
          },
          "422": errorResponse,
          "404": errorResponse,
        },
      },
    },
    "/events/{slug}/calendar/google": {
      get: {
        security: adminSecurity,
        tags: ["Público"],
        summary: "URL de Google Calendar de una celebración",
        parameters: [slugParam],
        responses: {
          "200": okJson("Enlace de calendario"),
          "404": errorResponse,
        },
      },
    },
    "/announcements": {
      get: {
        tags: ["Público"],
        summary: "Avisos activos ordenados",
        parameters: [
          {
            name: "event_id",
            in: "query",
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "priority",
            in: "query",
            schema: {
              type: "string",
              enum: ["normal", "importante", "urgente"],
            },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100 },
          },
        ],
        responses: { "200": okJson("Avisos") },
      },
    },
    "/families": {
      get: {
        security: adminSecurity,
        tags: ["Público"],
        summary: "Familias con número de integrantes",
        responses: { "200": okJson("Familias") },
      },
    },
    "/participants": {
      get: {
        security: adminSecurity,
        tags: ["Público"],
        summary: "Directorio público limitado de participantes",
        description:
          "Solo expone nombre, familia, etiqueta y estado por evento. No incluye notas privadas ni tokens.",
        parameters: [
          {
            name: "event_id",
            in: "query",
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "family_id",
            in: "query",
            schema: { type: "string", format: "uuid" },
          },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": okJson("Participantes") },
      },
    },
    "/registrations/batch": {
      post: {
        tags: ["Público"],
        summary: "Registrar una persona y confirmar una o varias fechas",
        description:
          "Confirma todas las fechas en una transacción y devuelve {registrations: [...]}. Si una fecha es inválida o está duplicada, no guarda ninguna. No modifica fechas no seleccionadas. Adultos requieren correo; niños admiten is_child=true sin correo. El intercambio es opcional, solo para adultos que confirmen Navidad el 24 de diciembre, y solo se guarda en esa asistencia.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["event_ids", "full_name"],
                properties: {
                  event_ids: {
                    type: "array",
                    minItems: 1,
                    maxItems: 20,
                    uniqueItems: true,
                    items: { type: "string", format: "uuid" },
                  },
                  full_name: { type: "string", minLength: 2, maxLength: 120 },
                  email: {
                    type: "string",
                    nullable: true,
                    description:
                      "Obligatorio y válido para adultos; opcional para niños.",
                  },
                  is_child: { type: "boolean", default: false },
                  avatar: {
                    type: "string",
                    nullable: true,
                    enum: [...AVATAR_IDS, null],
                  },
                  participates_in_exchange: { type: "boolean", default: false },
                  gift_suggestions: {
                    type: "string",
                    maxLength: 500,
                    nullable: true,
                    description: "Obligatorio al participar.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": okJson("Fechas confirmadas"),
          "404": errorResponse,
          "409": errorResponse,
          "422": errorResponse,
          "429": errorResponse,
        },
      },
    },
    "/registrations": {
      post: {
        tags: ["Público"],
        summary: "Inscribir a una persona en una celebración",
        description:
          "Crea o reutiliza el invitado y confirma su asistencia (status=confirmed, registered_at y responded_at al inscribirse); no requiere RSVP posterior. Adultos requieren correo único por evento. Con is_child=true se permite omitir email o enviarlo null/vacío: se identifica por nombre completo sin correo; homónimos o perfiles sin etiqueta de niño se resuelven en administración. El intercambio del registro familiar es solo para adultos en Navidad el 24 de diciembre, con intercambio habilitado.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["event_id", "full_name"],
                anyOf: [
                  {
                    required: ["is_child"],
                    properties: { is_child: { enum: [true] } },
                  },
                  {
                    required: ["email"],
                    properties: {
                      email: { type: "string", format: "email", minLength: 1 },
                    },
                  },
                ],
                properties: {
                  event_id: { type: "string", format: "uuid" },
                  full_name: { type: "string", minLength: 2, maxLength: 120 },
                  email: {
                    anyOf: [
                      { type: "string", format: "email", maxLength: 160 },
                      { type: "string", nullable: true, enum: ["", null] },
                    ],
                    description:
                      "Obligatorio para adultos; opcional para niños con is_child=true.",
                  },
                  is_child: {
                    type: "boolean",
                    default: false,
                    description:
                      "Permite registrar a un niño o niña sin correo.",
                  },
                  avatar: {
                    type: "string",
                    nullable: true,
                    enum: [...AVATAR_IDS, null],
                    description:
                      "Avatar elegido de la galería; null significa sin avatar.",
                  },
                  participates_in_exchange: { type: "boolean", default: false },
                  gift_suggestions: {
                    type: "string",
                    maxLength: 500,
                    nullable: true,
                    description:
                      "Obligatorio cuando participates_in_exchange es true y el evento tiene intercambio.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": okJson("Inscripción creada"),
          "404": errorResponse,
          "409": errorResponse,
          "422": errorResponse,
          "429": errorResponse,
        },
      },
    },
    "/invitations/resolve": {
      post: {
        security: adminSecurity,
        tags: ["Invitaciones"],
        summary: "Resolver enlace personal de invitación",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token"],
                properties: {
                  token: { type: "string", pattern: "^[a-f0-9]{64}$" },
                },
              },
            },
          },
        },
        responses: {
          "200": okJson("Invitación"),
          "404": errorResponse,
          "422": errorResponse,
          "429": errorResponse,
        },
      },
    },
    "/invitations/rsvp": {
      patch: {
        security: adminSecurity,
        tags: ["Invitaciones"],
        summary: "Actualizar asistencia del invitado dueño del token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "event_id", "status"],
                properties: {
                  token: { type: "string", pattern: "^[a-f0-9]{64}$" },
                  event_id: { type: "string", format: "uuid" },
                  status: {
                    type: "string",
                    enum: ["pending", "confirmed", "declined"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": okJson("Asistencia actualizada"),
          "401": errorResponse,
          "403": errorResponse,
          "422": errorResponse,
          "429": errorResponse,
        },
      },
    },
    "/invitations/calendar.ics": {
      post: {
        security: adminSecurity,
        tags: ["Invitaciones"],
        summary: "Descargar ICS de una celebración para el invitado",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "event_id"],
                properties: {
                  token: { type: "string", pattern: "^[a-f0-9]{64}$" },
                  event_id: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Archivo iCalendar",
            content: { "text/calendar": { schema: { type: "string" } } },
          },
          "401": errorResponse,
          "404": errorResponse,
          "422": errorResponse,
        },
      },
    },
    "/admin/options": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Opciones y etiquetas para los formularios administrativos",
        responses: {
          "200": okJson("Categorías, prioridades y estados RSVP"),
          "401": errorResponse,
        },
      },
    },
    "/admin/events": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Listar celebraciones",
        responses: { "200": okJson("Celebraciones"), "401": errorResponse },
      },
      post: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Crear celebración",
        description:
          "Solo superusuario. Acepta is_released (false por defecto), dress_code, contributions, exchange_rules, additional_activities, registration_deadline (informativa), slug (minúsculas, números y guiones), name, event_date, horarios, descripción, venue_id y gift_exchange_enabled (boolean, false por defecto).",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "201": okJson("Celebración creada"),
          "401": errorResponse,
          "422": errorResponse,
        },
      },
    },
    "/admin/events/{id}": {
      patch: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Editar celebración",
        description:
          "Anfitrión: solo eventos asignados, sin editar slug/is_released; crear, borrar y liberar corresponde al superusuario. Actualización parcial; is_released controla cards, menú y registro sin borrar asistencias. No liberados vigentes se mencionan en home.upcoming_events; sus páginas y calendarios públicos responden 404 y no aceptan inscripciones. gift_exchange_enabled activa o desactiva el intercambio sin borrar participaciones ni sugerencias. El sorteo no está implementado.",
        parameters: [idParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": okJson("Celebración actualizada"),
          "401": errorResponse,
          "404": errorResponse,
        },
      },
      delete: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Eliminar celebración",
        parameters: [idParam],
        responses: {
          "204": { description: "Eliminada" },
          "401": errorResponse,
          "404": errorResponse,
        },
      },
    },
    "/admin/events/{id}/guests": {
      put: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Reemplazar invitados de un evento",
        parameters: [idParam],
        description:
          "Operación atómica. Conserva RSVP e intercambio de miembros que permanecen. Elimina asistencias/inscripciones de quienes se retiran, sin borrar perfiles ni tocar otros eventos.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["guest_ids"],
                properties: {
                  guest_ids: {
                    type: "array",
                    maxItems: 200,
                    items: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": okJson("Invitados actualizados"),
          "401": errorResponse,
          "404": errorResponse,
          "422": errorResponse,
        },
      },
    },
    "/admin/venues": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Listar sedes",
        responses: { "200": okJson("Sedes") },
      },
      post: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Crear sede",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "201": okJson("Sede creada") },
      },
    },
    "/admin/venues/{id}": {
      patch: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Editar sede",
        parameters: [idParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": okJson("Sede actualizada") },
      },
      delete: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Eliminar sede",
        parameters: [idParam],
        responses: { "204": { description: "Eliminada" } },
      },
    },
    "/admin/families": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Listar familias",
        responses: { "200": okJson("Familias") },
      },
      post: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Crear familia",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "201": okJson("Familia creada") },
      },
    },
    "/admin/families/{id}": {
      patch: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Editar familia",
        parameters: [idParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": okJson("Familia actualizada") },
      },
      delete: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Eliminar familia",
        parameters: [idParam],
        responses: { "204": { description: "Eliminada" } },
      },
    },
    "/admin/guests": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Listar invitados con datos privados",
        parameters: [
          {
            name: "family_id",
            in: "query",
            schema: { type: "string", format: "uuid" },
          },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": okJson("Invitados") },
      },
      post: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Crear invitado",
        description:
          "`email` es único y opcional. `event_ids` crea las asistencias del invitado en esas celebraciones (estado `pending`).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["full_name"],
                properties: {
                  full_name: { type: "string", maxLength: 120 },
                  email: {
                    type: "string",
                    format: "email",
                    nullable: true,
                    maxLength: 160,
                  },
                  avatar: {
                    type: "string",
                    nullable: true,
                    enum: [...AVATAR_IDS, null],
                  },
                  family_id: { type: "string", format: "uuid", nullable: true },
                  tag: { type: "string", nullable: true, maxLength: 40 },
                  event_ids: {
                    type: "array",
                    items: { type: "string", format: "uuid" },
                    description:
                      "Celebraciones a las que se inscribe al invitado.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": okJson("Invitado creado"),
          "409": errorResponse,
          "422": errorResponse,
        },
      },
    },
    "/admin/guests/{id}": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Detalle de invitado",
        parameters: [idParam],
        responses: { "200": okJson("Invitado"), "404": errorResponse },
      },
      patch: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Editar invitado",
        description:
          "Acepta los mismos campos que la creación; `avatar` admite la galería de avatares o `null` para quitarlo.",
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  full_name: { type: "string", maxLength: 120 },
                  email: {
                    type: "string",
                    format: "email",
                    nullable: true,
                    maxLength: 160,
                  },
                  avatar: {
                    type: "string",
                    nullable: true,
                    enum: [...AVATAR_IDS, null],
                  },
                  family_id: { type: "string", format: "uuid", nullable: true },
                  tag: { type: "string", nullable: true, maxLength: 40 },
                  event_ids: {
                    type: "array",
                    items: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": okJson("Invitado actualizado"),
          "409": errorResponse,
          "422": errorResponse,
        },
      },
      delete: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Eliminar invitado",
        parameters: [idParam],
        responses: { "204": { description: "Eliminado" } },
      },
    },
    "/admin/guests/{id}/private": {
      put: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Guardar notas privadas del invitado",
        parameters: [idParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": okJson("Notas guardadas") },
      },
    },
    "/admin/event-guests": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Listar asistencias",
        parameters: [
          {
            name: "event_id",
            in: "query",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: { "200": okJson("Asistencias") },
      },
    },
    "/admin/event-guests/{id}": {
      patch: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Actualizar asistencia e intercambio",
        description:
          "Permite cambiar el estado, la nota pública y el intercambio de regalos. Activar el intercambio exige regalos y solo aplica a celebraciones con intercambio (Navidad). Al desactivarlo, los regalos se conservan.",
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    enum: ["pending", "confirmed", "declined"],
                  },
                  public_note: {
                    type: "string",
                    nullable: true,
                    maxLength: 200,
                  },
                  participates_in_exchange: { type: "boolean" },
                  gift_suggestions: {
                    type: "string",
                    nullable: true,
                    maxLength: 500,
                  },
                  responded_at: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": okJson("Asistencia actualizada"),
          "422": errorResponse,
        },
      },
    },
    "/admin/events/{eventId}/hosts": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Listar anfitriones",
        parameters: [eventIdParam],
        responses: { "200": okJson("Anfitriones") },
      },
      post: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Crear anfitrión",
        parameters: [eventIdParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "201": okJson("Anfitrión creado") },
      },
    },
    "/admin/events/{eventId}/menu-items": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Listar menú",
        parameters: [eventIdParam],
        responses: { "200": okJson("Menú") },
      },
      post: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Crear platillo",
        parameters: [eventIdParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "201": okJson("Platillo creado") },
      },
    },
    "/admin/events/{eventId}/responsibilities": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Listar responsabilidades",
        parameters: [eventIdParam],
        responses: { "200": okJson("Responsabilidades") },
      },
      post: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Crear responsabilidad",
        parameters: [eventIdParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "201": okJson("Responsabilidad creada") },
      },
    },
    "/admin/events/{eventId}/activities": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Listar actividades",
        parameters: [eventIdParam],
        responses: { "200": okJson("Actividades") },
      },
      post: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Crear actividad",
        parameters: [eventIdParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "201": okJson("Actividad creada") },
      },
    },
    "/admin/announcements": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Listar todos los avisos",
        responses: { "200": okJson("Avisos") },
      },
      post: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Crear aviso",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "201": okJson("Aviso creado") },
      },
    },
    "/admin/announcements/{id}": {
      patch: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Editar aviso",
        parameters: [idParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": okJson("Aviso actualizado") },
      },
      delete: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Eliminar aviso",
        parameters: [idParam],
        responses: { "204": { description: "Eliminado" } },
      },
    },
    "/admin/invitation-tokens": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Listar tokens de invitación",
        parameters: [
          {
            name: "guest_id",
            in: "query",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: { "200": okJson("Tokens") },
      },
      post: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Generar token de invitación",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["guest_id"],
                properties: { guest_id: { type: "string", format: "uuid" } },
              },
            },
          },
        },
        responses: { "201": okJson("Token creado") },
      },
    },
    "/admin/invitation-tokens/{id}/revoke": {
      post: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Revocar token de invitación",
        parameters: [idParam],
        responses: { "200": okJson("Token revocado") },
      },
    },
    "/admin/registrations": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Listar inscripciones públicas",
        description:
          "Solo incluye asistencias creadas desde el formulario público (registered_at no nulo).",
        parameters: [
          {
            name: "event_id",
            in: "query",
            schema: { type: "string", format: "uuid" },
          },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": okJson("Inscripciones"), "401": errorResponse },
      },
    },
    "/admin/stats": {
      get: {
        tags: ["Administración"],
        security: adminSecurity,
        summary: "Métricas generales",
        responses: { "200": okJson("Métricas") },
      },
    },
  },
};
