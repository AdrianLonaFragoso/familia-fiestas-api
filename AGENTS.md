# AGENTS.md

## Contexto compartido

- **Antes de empezar, lee `../CONTEXT.md`.** Resume ambos proyectos y evita reexplorar el código.
- **Al terminar cualquier cambio, actualiza `CONTEXT.md`:**
  - la sección afectada, si cambió arquitectura, comportamiento, datos, esquema, variables o comandos;
  - una línea nueva en la bitácora con fecha y área (`BE`, `DB`, `REPO`, `DOCS`).
- Cambios triviales (typos, formato) no van a la bitácora.
- No dupliques lo que ya está en `README.md` o Swagger; enlázalo.
- **Nunca** escribas secretos ni cadenas de conexión en `CONTEXT.md`.

## Stack

- Node.js 22+ + Express 5 + TypeScript.
- Prisma 7 con `@prisma/adapter-pg` sobre PostgreSQL (Neon).
- Zod para validación, Pino para logs, Helmet/CORS/rate limit para seguridad.
- Vitest + Supertest para pruebas.
- Gestor de paquetes: **pnpm**. No generes `package-lock.json`, `yarn.lock` ni `bun.lock`.

## Comandos

- `pnpm dev` — servidor con recarga (`tsx watch`) en `http://localhost:3000`.
- `pnpm start` — servidor sin recarga.
- `pnpm build` — solo typecheck (`tsc --noEmit`); no emite JS. El runtime usa `tsx`.
- `pnpm test` / `pnpm test:watch` — Vitest.
- `pnpm db:generate`, `db:push`, `db:migrate`, `db:deploy`, `db:seed`, `db:studio`.
- La API debe estar corriendo para que el frontend (`../familia-fiestas-2026`) cargue datos.

## Reglas del proyecto

### Prisma y datos

- `prisma/schema.prisma` es la **única** fuente del esquema. El frontend no tiene Prisma.
- No cambies el esquema sin actualizar `CONTEXT.md` y, si aplica, el seed.
- `db:push` es solo para desarrollo. Cuando existan migraciones versionadas, usa `db:migrate` (local) y `db:deploy` (producción).
- El seed debe seguir siendo idempotente.
- `GuestPrivate` e `InvitationToken` no se exponen nunca en rutas públicas.
- Las tablas usan `snake_case` plural; los campos Prisma `camelCase` con `@map`.
- `status` y `category` son `String` con `CHECK` en la base; los valores válidos y etiquetas viven en `src/lib/labels.ts`.

### API

- Rutas delgadas: validación Zod en `src/schemas`, lógica en `src/services`, formato en `src/serializers`.
- Toda ruta de `/admin` debe pasar por el middleware de autenticación (`X-Admin-Key`).
- Las respuestas van en `snake_case`; `Decimal` como `number`; fechas como ISO strings.
- Los errores usan `src/lib/http-error.ts` y el formato `{ error: { code, message, details } }`.
- Al agregar o cambiar endpoints, actualiza `src/docs/openapi.ts` y `README.md` si cambia el contrato.
- Sigue la política de pruebas de `../AGENTS.md`: solo implementa tests por petición explícita; registra los casos pendientes en `../TESTS_PENDIENTES.md`.
- El backend calcula contadores, etiquetas, fechas formateadas, enlaces de mapas y calendarios; no empujes esa lógica al frontend.

### Entorno y seguridad

- `.env` no se versiona. Documenta variables nuevas en `.env.example` y valídalas en `src/config/env.ts`.
- No imprimas `ADMIN_API_KEY` ni cadenas de conexión en logs, pruebas o respuestas.
- Mantén `CORS_ORIGINS` alineado con el origen real del frontend.
