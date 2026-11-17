# Familia Fiestas API

API REST de la **Cena de Navidad 2026** y la **Cena de Año Nuevo 2027**. Concentra toda la lógica de negocio y el acceso a datos del proyecto; el frontend [`familia-fiestas-2026`](../familia-fiestas-2026) solo consume estos endpoints.

## Stack

- **Node.js 22+** + **Express 5** + **TypeScript**
- **Prisma 7** con el driver `@prisma/adapter-pg` sobre PostgreSQL (Neon)
- **Zod** para validación de entrada
- **Pino** para logs y **Helmet** / **CORS** / `express-rate-limit` para seguridad
- **Vitest + Supertest** para pruebas
- **Swagger UI** en `/api/docs` y OpenAPI en `/api/openapi.json`
- **pnpm** como gestor de paquetes

## Puesta en marcha

Requisitos: Node.js 22+ y pnpm 11+ (`corepack enable`).

```sh
pnpm install
cp .env.example .env        # pega DATABASE_URL, DIRECT_URL y ADMIN_API_KEY

pnpm db:push                # crea/actualiza las tablas en Neon
pnpm db:seed                # carga familias, invitados y celebraciones de ejemplo

pnpm dev                    # http://localhost:3000
```

`pnpm dev` usa `tsx watch`. Para ejecutar sin recarga: `pnpm start`.

> `pnpm db:push` es para desarrollo. Cuando existan migraciones versionadas usa `pnpm db:migrate` (local) y `pnpm db:deploy` (producción).

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `NODE_ENV` | `development`, `production` o `test`. |
| `PORT` | Puerto HTTP. Por defecto `3000`. |
| `DATABASE_URL` | Cadena de Neon con `-pooler` en el host. La usa la API en runtime. |
| `DIRECT_URL` | Cadena directa, sin pooler. La usa Prisma CLI para migraciones. |
| `ADMIN_API_KEY` | Clave que deben enviar los organizadores en `X-Admin-Key`. |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma. En desarrollo `http://localhost:8080`. |
| `LOG_LEVEL` | Nivel de Pino (`info`, `debug`, `silent`…). Opcional. |
| `RATE_LIMIT_WINDOW_MS` | Ventana del rate limit en ms. Opcional, por defecto `60000`. |
| `RATE_LIMIT_MAX` | Peticiones por ventana. Opcional, por defecto `60`. |

`.env` **no** se versiona. Solo `.env.example` va en el repo.

## Endpoints

Base: `http://localhost:3000/api/v1`.

### Públicos

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/health` | Estado del servicio. |
| `GET` | `/home` | Datos agregados del inicio: eventos con contadores, avisos, próxima celebración y avisos destacados. |
| `GET` | `/events` | Celebraciones con contadores de asistencia y `is_next`. |
| `GET` | `/events/:slug` | Bundle completo: evento, asistencias, anfitriones, menú, responsabilidades, actividades y avisos. |
| `GET` | `/events/:slug/calendar.ics` | Archivo iCalendar de la celebración. |
| `GET` | `/events/:slug/calendar/google` | URL de Google Calendar. |
| `GET` | `/announcements` | Avisos activos ordenados. Filtros: `event_id`, `priority`, `limit`. |
| `GET` | `/families` | Familias con número de integrantes. |
| `GET` | `/participants` | Directorio público limitado: nombre, avatar, familia, etiqueta y estado por evento. |

El directorio público **no** expone notas privadas, datos dietéticos ni tokens de invitación.

### Inscripciones públicas

| Método | Ruta | Body |
| --- | --- | --- |
| `POST` | `/registrations` | `{ "event_id": "...", "full_name": "...", "email": "...", "avatar": "avatar-1", "participates_in_exchange": false, "gift_suggestions": null }` |

Busca o crea el invitado por correo y registra su asistencia (`pending`) en una transacción. Un correo puede inscribirse una vez por celebración; el duplicado responde `409`. Límite: 10 solicitudes por 10 minutos por IP.

`avatar` es opcional y pertenece al invitado, no al evento: admite `avatar-1` … `avatar-6` o `null` (sin avatar). Se acepta también en `POST/PATCH /admin/guests`. Al reutilizar un invitado, omitirlo conserva el anterior; enviarlo actualiza su avatar para todas sus celebraciones y `null` lo quita. Un ID ajeno a la galería responde `422`. El avatar viaja como ID en las respuestas de invitados, participantes e inscripciones; las imágenes las sirve el frontend.

### Invitaciones personales

El token viaja en el body, nunca en la URL.

| Método | Ruta | Body |
| --- | --- | --- |
| `POST` | `/invitations/resolve` | `{ "token": "<64 hex>" }` |
| `PATCH` | `/invitations/rsvp` | `{ "token": "...", "event_id": "...", "status": "pending \| confirmed \| declined" }` |
| `POST` | `/invitations/calendar.ics` | `{ "token": "...", "event_id": "..." }` |

Las respuestas de invitación se envían con `Cache-Control: no-store`.

### Administración

Todas requieren el header `X-Admin-Key`.

```sh
curl -H "X-Admin-Key: $ADMIN_API_KEY" http://localhost:3000/api/v1/admin/stats
```

| Recurso | Rutas |
| --- | --- |
| Eventos | `GET/POST /admin/events`, `PATCH/DELETE /admin/events/:id` |
| Sedes | `GET/POST /admin/venues`, `PATCH/DELETE /admin/venues/:id` |
| Familias | `GET/POST /admin/families`, `PATCH/DELETE /admin/families/:id` |
| Invitados | `GET/POST /admin/guests`, `GET/PATCH/DELETE /admin/guests/:id` — `email` único opcional, `avatar` de la galería y `event_ids` para inscribir en celebraciones |
| Notas privadas | `PUT /admin/guests/:id/private` |
| Asistencias | `GET /admin/event-guests`, `PATCH /admin/event-guests/:id` |
| Inscripciones | `GET /admin/registrations` (filtros `event_id`, `search`) |
| Anfitriones | `GET/POST /admin/events/:eventId/hosts`, `PATCH/DELETE /admin/hosts/:id` |
| Menú | `GET/POST /admin/events/:eventId/menu-items`, `PATCH/DELETE /admin/menu-items/:id` |
| Responsabilidades | `GET/POST /admin/events/:eventId/responsibilities`, `PATCH/DELETE /admin/responsibilities/:id` |
| Actividades | `GET/POST /admin/events/:eventId/activities`, `PATCH/DELETE /admin/activities/:id` |
| Avisos | `GET/POST /admin/announcements`, `PATCH/DELETE /admin/announcements/:id` |
| Tokens | `GET/POST /admin/invitation-tokens`, `POST /admin/invitation-tokens/:id/revoke` |
| Métricas | `GET /admin/stats` |

La especificación completa, con esquemas y ejemplos, está en **`http://localhost:3000/api/docs`**.

## Formato de respuesta

- Todas las claves viajan en `snake_case`, listas para el frontend.
- `Decimal` se serializa como `number` y las fechas como ISO strings.
- El backend entrega cálculos ya resueltos: contadores de asistencia, etiquetas legibles, fechas y horas formateadas en español, enlaces de Google Maps/Waze, URLs de calendario e ICS.
- Los errores tienen forma uniforme:

```json
{
  "error": {
    "code": "not_found",
    "message": "Celebración no encontrada.",
    "details": null
  }
}
```

Códigos usados: `validation_error` (422), `unauthorized` (401), `forbidden` (403), `not_found` (404), `rate_limited` (429), `internal_error` (500).

## Estructura

```text
src/
  app.ts               # Express, CORS, seguridad, Swagger y montaje de rutas
  server.ts            # arranque y cierre graceful
  config/              # lectura y validación de variables de entorno
  db/                  # cliente Prisma con adapter-pg
  docs/                # documento OpenAPI
  lib/                 # errores HTTP, fechas, ICS, logger
  middleware/          # auth, validación, errores, rate limit
  routes/              # públicos, invitaciones y administración
  schemas/             # esquemas Zod
  serializers/         # snake_case, etiquetas y cálculos de presentación
  services/            # lógica de negocio y consultas Prisma
prisma/
  schema.prisma        # dueño único del esquema
  seed.ts              # datos iniciales
tests/                 # Vitest + Supertest
```

## Scripts

| Script | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor con recarga (`tsx watch`). |
| `pnpm start` | Servidor sin recarga. |
| `pnpm build` | Genera el cliente Prisma y comprueba tipos (`tsc --noEmit`), incluso con caché de dependencias. |
| `pnpm test` | Vitest. |
| `pnpm test:watch` | Vitest en modo watch. |
| `pnpm db:generate` | Genera el cliente Prisma. |
| `pnpm db:push` | Sincroniza el esquema con la base. |
| `pnpm db:migrate` | Crea migraciones en desarrollo. |
| `pnpm db:deploy` | Aplica migraciones en producción. |
| `pnpm db:seed` | Carga datos iniciales. |
| `pnpm db:studio` | Abre Prisma Studio. |

## Pruebas

```sh
pnpm test
```

Las pruebas cubren estado del servicio, OpenAPI, autenticación de administración, validación y resolución de invitaciones, serializadores y generación de ICS. No necesitan conexión a Neon: los servicios se mockean donde hace falta.

## Despliegue

1. Configura las variables de entorno del proveedor.
2. Ejecuta `pnpm db:deploy` contra la base de producción.
3. Arranca con `pnpm start` detrás de un proxy que termine TLS.
4. Ajusta `CORS_ORIGINS` al dominio real del frontend.

`/api/docs` queda público. Si no quieres exponerlo en producción, monta `swaggerUi` condicionado por `NODE_ENV`.

## Configuración de eventos

Los eventos aceptan `gift_exchange_enabled` (boolean; `false` al crear). Este campo controla el registro y la edición de participantes en cualquier evento, independientemente del slug. Desactivarlo conserva las participaciones y regalos existentes; el sorteo sigue pendiente.

`PUT /api/v1/admin/events/:id/guests` con `{ "guest_ids": ["<uuid>"] }` reemplaza la lista de un evento en una transacción. Conserva el estado de asistentes que permanecen y no modifica otras celebraciones. Los retirados pierden la asistencia/inscripción y datos de intercambio de ese evento; el perfil del invitado se conserva. Requiere `X-Admin-Key`.

Para bases existentes sin historial de migraciones, aplicar una vez (se puede reejecutar) `pnpm exec prisma db execute --file prisma/patches/20261117_event_exchange.sql` y ejecutar `pnpm db:generate`. El parche añade la columna e inicializa Navidad con intercambio habilitado sin ejecutar el seed. En bases nuevas, `db:push` crea el campo y el seed inicializa Navidad al crearla.

`GET /api/v1/admin/options` entrega las categorías/prioridades de avisos y estados RSVP con sus etiquetas, para que los formularios no dupliquen las reglas de la API.
