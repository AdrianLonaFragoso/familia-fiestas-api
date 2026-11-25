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
| `CORS_ORIGINS` | Orígenes adicionales permitidos, separados por coma. Por defecto `http://localhost:8080`. El frontend principal `https://familia-fiestas-2026.vercel.app` está permitido explícitamente. |
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
| `GET` | `/participants` | Directorio privado de organizadores: nombre, avatar, familia, etiqueta y estado por evento. |

El directorio **no** expone notas privadas, datos dietéticos ni tokens de invitación.

### Inscripciones públicas

| Método | Ruta | Body |
| --- | --- | --- |
| `POST` | `/registrations` | `{ "event_id": "...", "full_name": "...", "email": "...", "avatar": "avatar-1", "participates_in_exchange": false, "gift_suggestions": null }` |

Busca o crea el invitado por correo y registra su asistencia confirmada (`confirmed`) en una transacción. La inscripción es la confirmación: guarda `registered_at` y `responded_at` con el mismo instante, incluso al reutilizar una asistencia creada previamente por administración; no requiere confirmar después. Un correo puede inscribirse una vez por celebración; el duplicado responde `409`. Límite: 10 solicitudes por 10 minutos por IP.

Para niños, enviar `is_child: true` permite omitir `email` o enviarlo `null`/vacío; para adultos sigue siendo obligatorio. Sin correo, la API busca por nombre completo (sin distinguir mayúsculas) entre perfiles sin correo y serializa esas inscripciones con un bloqueo transaccional. Los perfiles nuevos se etiquetan `Niño/a`; se reutilizan perfiles con etiqueta `Niño`, `Niña` o `Niño/a`. Si hay homónimos o el único perfil existente no está identificado como niño, responde `409` y deriva la inscripción al panel para no unir personas incorrectas. Un niño puede inscribirse en varios eventos; el reintento en el mismo evento responde `409` sin modificar avatar ni regalos. No requiere migración: `Guest.email` ya admite `null`.

`avatar` es opcional y pertenece al invitado, no al evento: admite `avatar-1` … `avatar-25` o `null` (sin avatar). Se acepta también en `POST/PATCH /admin/guests`. Al reutilizar un invitado, omitirlo conserva el anterior; enviarlo actualiza su avatar para todas sus celebraciones y `null` lo quita. Un ID ajeno a la galería responde `422`. El avatar viaja como ID en las respuestas de invitados, participantes e inscripciones; las imágenes las sirve el frontend.

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

Los eventos aceptan `gift_exchange_enabled` (boolean; `false` al crear). Este campo controla la disponibilidad del intercambio del evento; el registro familiar público añade la restricción de adultos y Navidad el 24 de diciembre. Desactivarlo conserva las participaciones y regalos existentes; el sorteo sigue pendiente.

`PUT /api/v1/admin/events/:id/guests` con `{ "guest_ids": ["<uuid>"] }` reemplaza la lista de un evento en una transacción. Conserva el estado de asistentes que permanecen y no modifica otras celebraciones. Los retirados pierden la asistencia/inscripción y datos de intercambio de ese evento; el perfil del invitado se conserva. Requiere `X-Admin-Key`.

Para bases existentes sin historial de migraciones, aplicar una vez (se puede reejecutar) `pnpm exec prisma db execute --file prisma/patches/20261117_event_exchange.sql` y ejecutar `pnpm db:generate`. El parche añade la columna e inicializa Navidad con intercambio habilitado sin ejecutar el seed. En bases nuevas, `db:push` crea el campo y el seed inicializa Navidad al crearla.

`GET /api/v1/admin/options` entrega las categorías/prioridades de avisos y estados RSVP con sus etiquetas, para que los formularios no dupliquen las reglas de la API.

### Registro general y confirmación de fechas

`POST /api/v1/registrations/batch` recibe `{ event_ids: ["<uuid>", "<uuid>"], full_name, email?, is_child?, avatar?, participates_in_exchange?, gift_suggestions? }` y devuelve `{ registrations: [...] }`. Exige al menos una fecha, sin IDs duplicados (máximo 20). Guarda todas las asistencias como `confirmed` en una única transacción; si una fecha ya estaba inscrita o no existe, revierte todo el envío. Un duplicado incluye `details.event_name` para que el usuario pueda desmarcar esa fecha y confirmar otra. Las fechas no seleccionadas no cambian. Conserva el endpoint individual para clientes anteriores.

El intercambio público es exclusivamente para adultos que asistan a Navidad el 24 de diciembre y con intercambio habilitado en ese evento. En un envío con ambas fechas, la participación y regalos solo se guardan en Navidad. Se valida tanto `is_child` como la etiqueta infantil del perfil existente; no se recategorizan ni modifican registros anteriores. `registration_exchange_enabled` en los eventos es la disponibilidad derivada que usa el formulario. No hay migración de base de datos.

### Liberación y contenido de eventos

Los eventos nuevos nacen sin liberar (`is_released: false`). Administración lista todos; público lista solo liberados. `/home.upcoming_events` menciona los no liberados hasta terminar su fecha en America/Mexico_City, sin enlaces ni registro. Desliberar conserva invitados e inscripciones; páginas y calendarios públicos responden 404. Contenido editable: `dress_code`, `contributions`, `exchange_rules`, `additional_activities` y `registration_deadline` (informativa, sin cierre automático). Aplicar el parche aditivo `prisma/patches/20261122_event_release.sql` del backend antes de desplegar.

## Niveles de acceso (2026-11-23)

- **Público:** homepage con fecha, horarios, lugar y anfitriones; registro y avisos publicados. Sin contadores, directorio, familias, próximos eventos ni páginas completas. Las bases del intercambio son información del registro.
- **Anfitrión:** clave propia, varios eventos asignables y varias cuentas por evento. Gestiona datos, sede, anfitriones visibles, invitados/asistencias, inscripciones, actividades y avisos de esos eventos. No crea, borra ni libera eventos, ni cambia su slug. No administra cuentas de anfitrión ni avisos globales ni invitaciones con tokens. Sí gestiona accesos de invitados de sus eventos.
- **Superusuario:** `ADMIN_API_KEY` actual, con acceso total y sección «Usuarios y accesos». No es necesario cambiar la clave ni crear una cuenta inicial en DB.

### Flujo de cuentas y claves

Entrar a `/admin` con la clave actual → Usuarios y accesos → Crear anfitrión → nombre, correo opcional y casillas de eventos → guardar y copiar la clave mostrada una sola vez. La entrega al anfitrión es manual. Se puede editar, reasignar, desactivar/reactivar, reemplazar claves (revoca todas las previas) o revocar una clave concreta. Desactivar no borra información; reactivar permite usar claves no revocadas. Se guarda SHA-256 de una clave aleatoria de 256 bits; GET nunca entrega clave completa ni digest. No hay contraseñas ni JWT.

### Alcance y perfiles compartidos

Express comprueba identidad y asignaciones en cada petición, IDs anidados y cuerpos de escritura. Las listas, métricas y estados se limitan a eventos asignados. Un anfitrión puede crear perfiles nuevos vinculados a sus eventos y editar perfiles/familias/sedes exclusivos de su alcance; los compartidos con eventos ajenos requieren superusuario para modificar sus datos globales. Retirar una persona desde la lista de invitados del evento no elimina su perfil. El borrado global de invitados, familias o sedes es exclusivo del superusuario. Las notas privadas de perfiles compartidos y todos los tokens se ocultan a anfitriones.

Las familias/sedes creadas por un anfitrión se identifican con `created_by_account_id` para ser visibles antes de vincular invitados/eventos. El texto público de «Anfitriones» y las cuentas de acceso son relaciones distintas: mostrar un nombre nunca otorga permisos.

### API y despliegue

Aplicar primero `prisma/patches/20261123_access_levels.sql` del backend; el parche es aditivo e idempotente. No ejecutar el seed global. Tablas nuevas: access_accounts, access_keys y account_events. Cero cambios a claves actuales, invitados o confirmaciones.

`GET /admin/me` devuelve id, name, role, event_ids y guest_id para invitados. Solo superusuario crea/edita anfitriones y asignaciones. GET /admin/accounts lista todas las cuentas para superusuario y solo accesos de invitados propios para anfitriones; activar/desactivar, rotar o revocar estos accesos respeta el mismo alcance. Cuentas y claves usan respuestas snake_case.

/home y /events devuelven una proyección pública o autorizada según X-Admin-Key; no se deben tratar todos sus campos como públicos. Bundle, calendario, directorio y familias requieren clave. /families e invitaciones con token quedan solo para superusuario; anfitriones usan /admin/families. Accesos privados usan Cache-Control: no-store. El frontend limpia consultas al salir/cambiar de cuenta y consulta nuevamente la identidad al volver a la pestaña. La UI adapta menús y controles; la autorización efectiva pertenece a Express.

Desplegar ambas capas coordinadamente por el cambio del contrato público. La migración ya se aplicó en Neon el 2026-11-23, en un solo intento HTTPS sin error. Las nuevas cuentas se crean desde el panel después del despliegue. La verificación de permisos utiliza fixtures en memoria; no crea cuentas de prueba en Neon.


## Perfil de invitados (2026-11-25)

`/profile/:guestId` pide la clave personal recibida por correo o WhatsApp. El enlace solo contiene el UUID del invitado; la clave se pega aparte y se envía en `X-Admin-Key`. La sesión dura hasta cerrar la pestaña. El rol `guest` permite editar únicamente el propio nombre, correo, avatar, familia existente y respuestas a eventos invitados. No accede al panel, a otros perfiles, a directorios ni a páginas completas de eventos. También muestra fecha, hora, sede y anfitriones de sus invitaciones. Adultos conservan correo obligatorio; niños pueden omitirlo. No permite crear familias ni editar etiquetas/roles.

En `/admin` → **Usuarios y accesos** → **Accesos e invitaciones de invitados**, superusuario y anfitriones pueden buscar personas existentes y marcar su invitación al evento seleccionado. Invitar conserva una respuesta existente o crea una pendiente; retirar elimina la asistencia/inscripción e intercambio de ese evento, conservando el perfil, la cuenta y otros eventos. Los anfitriones solo modifican sus eventos y generan/gestionan accesos de personas invitadas a ellos. La búsqueda entrega únicamente nombre, avatar, familia y vínculo a eventos en alcance. El formulario público de registro no cambia.

**Generar acceso y compartir** muestra la clave una sola vez en un modal con enlace e instrucciones. **Copiar correo para Gmail** copia HTML y texto alternativo; abre un mensaje nuevo en Gmail, deja desactivado «Modo de texto sin formato» y pega normalmente en el cuerpo. Plantilla de tablas con estilos inline y fuentes del sistema; incluye el logo PNG de Eventos LOVE desde `https://familia-fiestas-2026.vercel.app/social/eventos-love-v1.png`, con tamaño adaptable y texto alternativo para correo. El asunto sugerido se copia aparte. **Copiar mensaje** y **Compartir por WhatsApp** (`wa.me`) permiten entrega manual. No hay envío automático ni servicio de correo. Para compartir otra vez hay que generar una nueva clave: invalida las anteriores y reactiva el acceso. Desactivar o revocar no borra el perfil.

API Express (requiere clave; respuestas privadas `no-store`):

| Método | Ruta | Contrato |
| --- | --- | --- |
| GET/PATCH | `/api/v1/profile/:guestId` | Perfil propio; patch `full_name`, `email`, `avatar`, `family_id` existente o null. |
| PATCH | `/api/v1/profile/:guestId/events/:eventId` | `status`, `participates_in_exchange`, `gift_suggestions`; solo invitaciones existentes. |
| GET | `/api/v1/admin/accounts/directory?search=` | Hasta 50 personas; proyección mínima y permisos en alcance. |
| POST | `/api/v1/admin/accounts/guest-access` | `{ guest_id, replace?: false }`; `exists:true` si ya existe, o clave nueva una vez. |
| PUT | `/api/v1/admin/accounts/guest-invitations` | `{ guest_id, event_id, invited }`, idempotente. |

El intercambio mantiene las reglas de adultos confirmados en Navidad con intercambio habilitado; al participar se exigen regalos. Pasar a pendiente/declinado desactiva participación y conserva sugerencias. La clave de invitado no concede permisos de organización, aunque use el mismo header.

Antes de desplegar el backend, aplicar el parche aditivo `prisma/patches/20261125_guest_profiles.sql` y regenerar Prisma. Añade `AccessAccount.role` (host por defecto) y `guest_id` único, enlazado con `Guest`; las claves siguen guardándose únicamente como hashes SHA-256. No modifica cuentas/claves previas ni el registro público. Aplicado a Neon el 2026-11-25 en el primer intento, sin incidencias. Desplegar ambas capas para habilitar la nueva página y el panel.
