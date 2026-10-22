# Plan: cliente web `biblia-web` (Vite + React + TanStack en Cloudflare)

> Este archivo vive en `C:\ezequiel\biblia-project\PLAN-BIBLIA-WEB.md`, fuera de `biblia-web/`, para que el scaffold arranque con la carpeta vacía. Después del scaffold se mueve a `biblia-web/docs/PLAN-BIBLIA-WEB.md`.

## Contexto

Hoy el proyecto tiene dos piezas:
- **`agente-biblia`**: Worker Hono `logosagent-api`, publicado en `https://logosagent-api.ekiolivier.workers.dev`.
  - Tiene un único endpoint para clientes, `POST /api/bible-ai/stream`, que devuelve JSON o SSE según `mode`.
  - Es **pública**: `x-api-key` es opcional, CORS es `*` y hay un rate limit de 30/min por IP.
- **`biblia-ntv-app`**: app Expo/React Native.
  - Navegación: Libros → Capítulos → Versículos → Lector.
  - IA sobre 1 a 10 versículos (menú, reflexión, historia, estructura, palabras clave).
  - Traducciones NVI y RV1960, con el texto tomado directo de `bolls.life`.
  - Tema claro/oscuro.

El objetivo es un **cliente web** con el mismo diseño y la misma lógica, adaptado a escritorio y servido por Cloudflare. El acceso queda así:
- **La lectura de la Biblia es pública**: cualquiera entra sin login.
- **La IA (inferencia y menú de opciones) exige login** con correo y código de un solo uso de Cloudflare Access. Solo pueden entrar los correos de una **whitelist**.
- **Cada correo de la whitelist está habilitado o deshabilitado.** Solo los habilitados usan la IA. Por ahora **no se borran**: se deshabilitan.
- **Vos (`ekiolivier@gmail.com`) sos el administrador**: gestionás la whitelist desde la propia web.
- **La API de IA se cierra del todo**: solo se puede llamar desde el Worker web.

### Decisiones tomadas
| Tema | Decisión |
|---|---|
| Hosting | Worker `biblia-web` con Static Assets en **workers.dev** (`biblia-web.ezeo-cloud.workers.dev`), sin dominio propio |
| Stack | Vite + React 19 + **TanStack Router** (file-based) + **TanStack Query** v5, SPA, `@cloudflare/vite-plugin` |
| Layout | Mismo diseño, **adaptado a escritorio**: barra lateral desde 1024 px y columna de lectura centrada |
| Reutilización | **Copiar** los módulos TS puros de la app a `biblia-web/src/core/` (cada proyecto tiene su propio git) |
| Lectura | **Pública**. Texto desde `bolls.life`, igual que la app |
| IA | Solo con sesión y correo en la whitelist. El navegador llama a `/api/*` en el mismo origen y el Worker reenvía a `logosagent-api` por **Service Binding** |
| Login | **Cloudflare Access como proveedor OIDC** (aplicación SaaS) con login method **One-time PIN**. Sesión propia de **30 días** |
| Roles | **Admin** (`ekiolivier@gmail.com`, en el secreto `ADMIN_EMAIL`): usa la IA y administra la whitelist en `/admin`. **Usuario**: solo usa la IA, mientras esté habilitado |
| Whitelist | Fuente de verdad en **D1**. Cada correo está **habilitado o deshabilitado** y en v1 no se borra. Se sincroniza con la política de Access para que solo los habilitados reciban código |
| Sin sesión | Selección de versículos y botón de IA visibles. Al tocarlo aparece "Iniciá sesión para usar la IA" |
| API de IA | **Cerrada**: `logosagent-api` sin URL pública (`workers_dev = false`), alcanzable solo por Service Binding |
| App móvil | **Se queda sin IA** hasta que tenga login (v2). Antes de cerrar la API se publica una build que oculta la IA |

### Por qué Access como OIDC y no Access sobre el Worker
- **Access a nivel Worker** (pestaña Access del Worker) protege **todo** el Worker: no deja la lectura pública.
- **Access por ruta** (aplicación self-hosted con path, por ejemplo `/api/*`) exige un **dominio propio** activo en la cuenta, y workers.dev no lo es.
- **Una aplicación SaaS de Access con OIDC** sí funciona con cualquier URL de callback. Access sigue mostrando la pantalla de correo, mandando el código y aplicando la política (whitelist). El Worker recibe un `id_token` firmado y crea su propia sesión.

---

## Arquitectura

```
Navegador ──► biblia-web.ezeo-cloud.workers.dev  (público)
   Worker biblia-web
     ├─ /auth/login     → redirige a Access (OIDC: code + PKCE + state + nonce)
     ├─ /auth/callback  → canjea el code, verifica el id_token, chequea la whitelist en D1 → cookie de sesión
     ├─ /auth/logout    → borra la sesión
     ├─ /api/me                       (público)  → { authenticated, email?, role? }
     ├─ /api/bible-ai/stream          (sesión + whitelist + rate limit) → Service Binding → logosagent-api (SSE sin buffer)
     ├─ /api/admin/allowed-emails     (solo admin) → D1 + sincroniza la política de Access por la API de Cloudflare
     └─ resto → Static Assets (SPA, fallback a index.html)

Access (team).cloudflareaccess.com: pantalla de correo → código OTP, solo a correos de la política
Navegador ──► https://bolls.life (texto bíblico; CORS * verificado)
logosagent-api: SIN URL pública; solo la llama biblia-web por Service Binding
```

### Flujo de login
1. Sin sesión, el usuario toca "Analizar con IA" y ve "Iniciá sesión para usar la IA".
2. Al tocar **Ingresar**, la SPA guarda en `sessionStorage` la selección pendiente (ruta y versículos) y navega a `/auth/login?returnTo=/juan/3?v=16`.
3. El Worker genera `state`, `nonce` y `code_verifier` (PKCE). Los guarda en una cookie corta y firmada `__Host-bw_oidc` (10 min, HttpOnly, Secure, SameSite=Lax) y redirige a `{issuer}/authorization`.
4. Access pide el correo. **Solo si está en la política** manda el código, el usuario lo pega, y Access redirige a `/auth/callback?code&state`.
5. El Worker:
   - valida `state`;
   - canjea el `code` en `{issuer}/token` (client secret + `code_verifier`);
   - verifica el `id_token` con jose (`{issuer}/jwks`, `iss`, `aud = client_id`, `nonce`);
   - comprueba que el email sea el admin o figure en D1 **habilitado**;
   - emite la cookie de sesión `__Host-bw_session` (JWT HS256 firmado con `SESSION_SECRET`, 30 días, HttpOnly, Secure, SameSite=Lax, Path=/);
   - redirige a `returnTo`, que tiene que ser una ruta relativa validada.
6. La SPA restaura la selección pendiente y abre el panel de IA.

---

## Estructura de carpetas (`C:\ezequiel\biblia-project\biblia-web`, con git propio)

```
wrangler.jsonc  vite.config.ts  vitest.config.ts  vitest.worker.config.ts  index.html
.dev.vars.example   migrations/0001_init.sql   public/{favicon.svg, theme-init.js}
scripts/gen-theme-css.ts                      # tokens → src/styles/theme.css
worker/  index.ts  app.ts (createApp(deps), Hono)
         auth/   oidc.ts  session.ts  authz.ts  middleware.ts (requireSession, requireAllowed, requireAdmin)
         access/ policySync.ts                 # PUT de la política de Access por la API de Cloudflare
         db/     allowedEmails.ts              # consultas D1
         middleware/sameOrigin.ts
         routes/ auth.ts  me.ts  aiProxy.ts  admin.ts
         lib/    headers.ts  returnTo.ts
src/     main.tsx  router.tsx  routeTree.gen.ts
         routes/ __root.tsx  index.tsx  admin.tsx  $book/index.tsx  $book/$chapter/index.tsx  $book/$chapter/versiculos.tsx
         core/        ← copia de biblia-ntv-app/src con la misma estructura (las rutas relativas siguen sirviendo)
         platform/    storage.ts  network.ts  clipboard.ts  notify.ts
         web/         auth/ (useMe, AuthProvider, LoginPrompt, pendingSelection.ts)
                      layout/  pages/ (incluye AdminPage)  components/  ui/  hooks/
         styles/      theme.css (generado)  global.css
tests/   unit/  dom/  worker/ (+ wrangler.test.jsonc)  setup/dom.ts
```

**Dependencias:**
- Runtime: `react`, `react-dom`, `@tanstack/react-router`, `@tanstack/react-query`, `eventsource-parser`, `hono` (^4.11, igual que el server), `jose`, `clsx`.
- Dev: `vite`, `@vitejs/plugin-react`, `@cloudflare/vite-plugin`, `@tanstack/router-plugin`, `wrangler@4`, `typescript`, `vitest`, el plugin de Vitest para Workers de Cloudflare (verificar el nombre vigente al instalar), `@testing-library/{react,user-event,jest-dom}`, `jsdom`, `tsx`.
- Node ≥ 22.

**Scripts:**
- `dev` = `vite`
- `build` = `gen:theme && tsc -b && vite build`
- `deploy` = `npm run build && wrangler deploy`. Nunca corras `wrangler deploy` solo, porque subiría la configuración generada vieja.
- `test` = `vitest run && vitest run -c vitest.worker.config.ts`
- `db:migrate` = `wrangler d1 migrations apply biblia-web-db --remote`
- `cf-typegen` = `wrangler types`

Todos los scripts tienen que funcionar en Windows.

## `wrangler.jsonc`
```jsonc
{
  "name": "biblia-web",
  "main": "./worker/index.ts",
  "compatibility_date": "<fecha del scaffold>",
  "workers_dev": true,
  "preview_urls": false,
  "assets": { "not_found_handling": "single-page-application", "run_worker_first": ["/api/*", "/auth/*"] },
  "services": [{ "binding": "API", "service": "logosagent-api", "remote": true }],
  "d1_databases": [{ "binding": "DB", "database_name": "biblia-web-db", "database_id": "<id>", "migrations_dir": "migrations" }],
  "ratelimits": [{ "name": "AI_RATE_LIMITER", "namespace_id": "1001", "simple": { "limit": 20, "period": 60 } }],
  "vars": {
    "OIDC_ISSUER": "https://<team>.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<client_id>",
    "OIDC_CLIENT_ID": "<client_id>",
    "CF_ACCOUNT_ID": "<account_id>",
    "ACCESS_POLICY_ID": "<id de la política reutilizable>"
  },
  "observability": { "enabled": true },
  "upload_source_maps": true
}
```
**Secretos** (`wrangler secret put`), nunca en el repo:
- `OIDC_CLIENT_SECRET`: el secreto de la aplicación SaaS de Access.
- `SESSION_SECRET`: 32 bytes aleatorios o más, para firmar las cookies.
- `ADMIN_EMAIL`: `ekiolivier@gmail.com`. Va como secreto para que no quede en el código ni en `wrangler.jsonc`.
- `CF_API_TOKEN`: token con permiso **Access: Apps and Policies → Edit**, solo para esta cuenta. Solo lo usan las rutas de admin para sincronizar la política.

**`.dev.vars`** (solo local, nunca se sube): `DEV_AUTH_BYPASS=true`, `DEV_USER_EMAIL=ekiolivier@gmail.com`, `ADMIN_EMAIL=ekiolivier@gmail.com`, `SESSION_SECRET=<local>`.

## Base de datos D1 (`migrations/0001_init.sql`)
```sql
CREATE TABLE allowed_emails (
  email      TEXT PRIMARY KEY,                   -- siempre en minúsculas
  enabled    INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  added_by   TEXT NOT NULL,
  added_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT,
  updated_at TEXT
);
CREATE TABLE admin_audit (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  actor  TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('add','enable','disable','sync')),
  email  TEXT,
  ok     INTEGER NOT NULL,
  at     TEXT NOT NULL DEFAULT (datetime('now'))
);
```
- **Admin.** No está en la tabla: sale de `ADMIN_EMAIL`, siempre tiene acceso y no se puede deshabilitar desde la UI.
- **Sin borrado en v1.** No hay `DELETE`: un correo que ya no debe usar la IA se deshabilita (`enabled = 0`). Así queda el historial y se puede reactivar.

## Worker (Hono)
**`auth/oidc.ts`:**
- `buildAuthorizationUrl` arma la URL con `response_type=code`, `scope=openid email`, `state`, `nonce` y `code_challenge` S256.
- `exchangeCode` hace el canje del code.
- `verifyIdToken` usa `createRemoteJWKSet({issuer}/jwks)` cacheado a nivel de módulo. Valida `iss`, `aud`, `nonce`, `exp` y `RS256`, y exige `email`.

**`auth/session.ts`:**
- `issueSession` y `readSession` usan jose `SignJWT` / `jwtVerify` con HS256.
- La sesión dura 30 días.
- La cookie lleva el prefijo `__Host-`.

**`auth/authz.ts`.** Calcula el rol **en cada request**, no lo guarda en la cookie:
- `role = email === ADMIN_EMAIL ? 'admin' : (existe en D1 con enabled = 1 ? 'user' : null)`.
- Así, deshabilitar un correo le corta la IA al instante, aunque su cookie siga vigente, y rehabilitarlo se la devuelve sin que tenga que volver a entrar.

**Middlewares:**
| Middleware | Sin cumplir | Código |
|---|---|---|
| `requireSession` | Sin cookie, o cookie inválida o vencida | 401 `UNAUTHENTICATED` |
| `requireAllowed` | Con sesión pero fuera de la whitelist o deshabilitado | 403 `NOT_ALLOWED` |
| `requireAdmin` | No es el admin | 403 `FORBIDDEN` |
| `sameOrigin` (en todo lo que no sea GET) | `Origin` o `sec-fetch-site` de otro origen | 403 |

**Bypass de desarrollo:** solo si `DEV_AUTH_BYPASS === "true"` **y** el host es `localhost`, `127.0.0.1` o `[::1]`. En ese caso `/auth/login` crea directamente la sesión de `DEV_USER_EMAIL`.

**Rutas:**
- **`GET /auth/login?returnTo=`**: redirige a Access. `returnTo` solo acepta rutas relativas que empiezan con `/` y no con `//`.
- **`GET /auth/callback`**:
  - Si falta `state` o no coincide: 400 con una página simple "No se pudo iniciar sesión, probá de nuevo".
  - Si el correo no está habilitado (no debería pasar si la política está sincronizada): redirige a `/?login=denied`.
- **`POST /auth/logout`**: borra la cookie y redirige a `/`. La sesión global de Access puede seguir viva, así que el próximo login puede no pedir código hasta que venza.
- **`GET /api/me`**: devuelve `{ authenticated:false }` o `{ authenticated:true, email, role }`, con `no-store`. `role` es `'admin'`, `'user'` o `null` (sesión válida pero correo deshabilitado).
- **`POST /api/bible-ai/stream`** (`requireSession` → `requireAllowed` → rate limit por email con `AI_RATE_LIMITER`, que da 429 `RATE_LIMIT_EXCEEDED`):
  - Exige `content-type: application/json` (si no, 415) y un body de 64 KB como máximo (si no, 413).
  - Headers que se envían al server, construidos desde cero: `content-type`, `accept`, `x-request-id` y `cf-connecting-ip`. **Nunca** se reenvían `cookie` ni `authorization`.
  - Hace `env.API.fetch(...)`. Si falla, responde 502 `UPSTREAM_UNAVAILABLE`.
  - La respuesta es `new Response(upstream.body, { status })` con headers en lista blanca: `content-type`, `x-request-id`, `retry-after`, `cache-control: no-cache, no-transform` y `nosniff`. **Sin `compress()` y sin `.text()`**.
- **`GET /api/admin/allowed-emails`** (`requireAdmin`): devuelve la lista con su estado (`enabled`) y el estado de la última sincronización.
- **`POST /api/admin/allowed-emails`** con `{ email }`: valida el formato y pasa a minúsculas. Si el correo es nuevo, lo inserta habilitado; si ya existe deshabilitado, lo rehabilita. Después sincroniza.
- **`PATCH /api/admin/allowed-emails/:email`** con `{ enabled: boolean }`: habilita o deshabilita y sincroniza. Si se intenta con `ADMIN_EMAIL`, responde 400.
- **No hay `DELETE`** en v1.
- **`POST /api/admin/sync`**: reintenta la sincronización.
- Cualquier otra ruta bajo `/api/*` devuelve un 404 JSON. Los 500 también son JSON, con el mismo formato del server.

**`access/policySync.ts`:**
- Hace `PUT /accounts/{CF_ACCOUNT_ID}/access/policies/{ACCESS_POLICY_ID}` con `decision: allow` e `include` = el admin más los correos **habilitados** de D1. Los deshabilitados quedan fuera, así que Access deja de mandarles código. Antes de implementar, verificar el body exacto contra el esquema actual de la API.
- Primero se escribe D1 y después se sincroniza. Si la sincronización falla, la respuesta es `{ saved:true, synced:false, error }` y la UI muestra "Guardado, pero no se pudo actualizar Cloudflare Access" con un botón **Reintentar**.
- Cada operación queda registrada en `admin_audit`.

## Lógica reutilizada (copiada a `src/core/`)
Cada archivo copiado lleva el comentario `// Ported from biblia-ntv-app/src/...`, y el README tiene una tabla de procedencia.
- **Se copian tal cual:**
  - `types/{ai,bible,translation}.ts`. A `bible.ts` se le saca `RootStackParamList`.
  - `data/bibleStructure.ts`
  - `api/BollsBibleClient.ts`
  - `repositories/*`
  - `lib/{passageBuilder,bollsText,features,wordDefinitionsCache}.ts`
  - `hooks/{useBibleQueries,useBibleAISelection,useWordsAnalysis}.ts`
  - `providers/QueryProvider.tsx`, con `refetchOnWindowFocus: false`.
- **Se adaptan:**
  - `theme/index.ts`: solo tokens, sin imports de React Native.
  - `ThemeProvider`: usa `localStorage`, la misma clave `theme-mode`, claro por defecto y `data-theme` en `<html>`. Además, `public/theme-init.js` aplica el tema antes de pintar para que no haya parpadeo.
  - `DatabaseProvider`: la traducción se guarda en `localStorage` (clave `bible-translation`, validada).
- **Se extraen y exportan:** el parser de `MarkdownText` va a `lib/markdown.ts` y los helpers de IDs a `lib/ids.ts`. Además se agrega `lib/bookSlugs.ts` (slugs en español sin tildes).
- **`lib/aiClient.ts` se reescribe por dentro con las mismas exportaciones y firmas**, para que los hooks se copien sin cambios:
  - Llama al mismo origen (`/api/bible-ai/stream`) y nunca manda `x-api-key`. Se elimina el `askBibleAI` deprecado.
  - El transporte pasa a `fetch` + `TextDecoderStream` + `EventSourceParserStream`.
  - Se mantienen `settled`, `cleanup`, `finishWithError` y `getAbortError`, el timeout total de 60 s y el abort externo.
  - Los errores no-2xx de los streams se leen como JSON y conservan el código real: `UNAUTHENTICATED`, `NOT_ALLOWED`, `RATE_LIMIT_EXCEEDED`, `INVALID_TRANSLATION`, etc.
  - El evento `quality` se ignora explícitamente.
- **`platform/`:** AsyncStorage → `localStorage`, NetInfo → `navigator.onLine`, expo-clipboard → `navigator.clipboard`, `Alert.alert` → `notify()` con un Toast.

## Autenticación en el frontend
- **`useMe()`** usa TanStack Query con la clave `['me']` contra `/api/me`. `AuthProvider` expone `{ status, email, role }`.
- **`LoginPrompt`** se ve dentro del panel de IA cuando no hay sesión, o cuando una llamada devuelve `UNAUTHENTICATED`. Muestra "Iniciá sesión para usar la IA" y el botón **Ingresar con tu correo**.
- **`NOT_ALLOWED`** muestra "Tu correo no tiene acceso a la IA. Pedíselo al administrador."
- **`pendingSelection.ts`** guarda `{ path, verseIds, translation }` en `sessionStorage` antes de ir a `/auth/login`. Al volver, si la ruta coincide, restaura la selección y abre el panel. Si no coincide, lo descarta.
- **`AccountBox`** (barra lateral en escritorio, arriba a la derecha en móvil):
  - sin sesión: "Ingresar";
  - con sesión: el email y "Salir", que es un `<form method="post" action="/auth/logout">`;
  - si sos admin, además: "Administrar accesos".
- **`?login=denied`** muestra un toast "Ese correo no tiene acceso".

## Página de administración (`/admin`)
- **Acceso.** `beforeLoad` espera a `me`: sin sesión redirige a `/auth/login?returnTo=/admin`, y si no sos admin, a `/`.
- **Contenido.** Usa el mismo diseño (tokens y componentes):
  - lista de correos con fecha, quién los agregó y un interruptor **Habilitado / Deshabilitado**. Deshabilitar pide confirmación;
  - los deshabilitados se ven atenuados, y hay un filtro **Todos / Habilitados / Deshabilitados**;
  - **no hay botón de borrar** en v1;
  - formulario **Agregar correo**. Si el correo ya existe deshabilitado, ofrece rehabilitarlo;
  - estado de la sincronización con Access y un botón **Reintentar**;
  - `ekiolivier@gmail.com` aparece fijo, como "Administrador", sin interruptor.
- **Datos.** Las mutaciones usan TanStack Query (`invalidateQueries(['admin','emails'])`).

## Rutas y layout
| Pantalla móvil | Ruta web |
|---|---|
| Books | `/` |
| Chapters | `/$book` (ej. `/juan`) |
| Verses | `/$book/$chapter/versiculos` |
| ChapterReader (+focus) | `/$book/$chapter?v=16` |
| (nueva) | `/admin` |

- **Validación.** Se hace en `beforeLoad`: un slug o capítulo inválido da `notFound()`, y `/43/3` redirige al slug canónico. `validateSearch` acepta `v` solo como entero positivo.
- **Props.** Las rutas arman exactamente las mismas props que recibían las pantallas móviles, así el cuerpo de cada página se porta casi línea por línea.
- **Navegación.** Capítulo anterior/siguiente usa push en el historial (en la app era `replace`). La traducción no va en la URL en v1.
- **Layout `AppShell` en `__root.tsx`:**
  - **Desde 1024 px:** grilla `300px | 1fr`.
    - Barra lateral fija con "Biblia", ThemeToggle, TranslationSelector, TestamentFilter, la lista de libros y `AccountBox`.
    - Contenido con migas de pan y una columna centrada de 720 px como máximo.
  - **Menos de 1024 px:** igual que la app, con TopBar y "volver" al padre lógico.

## Diseño y estilos
- **Variables CSS.** `scripts/gen-theme-css.ts` genera `theme.css` a partir de `lightTheme` y `darkTheme`: `--color-*`, `--space-*`, `--radius-*` y `--font-*` bajo `:root[data-theme=...]`. Un test verifica que siga en sincronía.
- **CSS Modules.** Hay uno por componente, con clases que llevan el mismo nombre que las claves de `createStyles`, y se usa `clsx`. Fuentes del sistema; íconos SVG inline.
- **Correspondencia de componentes:**
  - **Se portan 1:1:** BookItem, ChapterItem, TestamentFilter, TranslationSelector, ThemeToggle, ChapterNavigationFooter, SelectionActionBar, StreamingText, MarkdownText (sin `dangerouslySetInnerHTML`) y WordList. Se mantienen los `data-testid` y los textos en español (voseo).
  - **VerseItem:**
    - Long-press de 400 ms con pointer events, y un círculo/✓ en el margen para el mouse.
    - Mientras hay selección, el clic alterna. El clic se ignora si hay texto seleccionado.
    - Teclado: Enter/Espacio y Esc. El foco `?v=` se resalta con una animación.
    - Las notas `[N]` son botones.
  - **BibleAiModal → `useBibleAiPanel` + `BibleAiPanel`:**
    - Misma máquina de estados, más un estado `login-required`.
    - Es un `<dialog>` nativo: pantalla completa en móvil y cajón derecho de `min(440px, 40vw)` en escritorio.
    - Auto-scroll que se pausa si el usuario sube.
  - **Notas al pie:** hoja inferior en móvil y popover en escritorio.

## Cambios en `agente-biblia` (cierre de la API)
- En `wrangler.toml` se agregan `workers_dev = false` y `preview_urls = false`. No tiene rutas ni dominios, así que queda **sin ninguna URL pública**, y el Service Binding de `biblia-web` sigue funcionando.
- El código del server no cambia. El CORS `*` queda inofensivo.
- **Consecuencia:** los endpoints `/admin/*` (indexación) ya no se pueden llamar por internet. Cuando haga falta, se usan con `wrangler dev --remote` en `agente-biblia`. Los scripts de `scripts/` hablan directo con la API de Cloudflare, así que no les afecta.
- **Orden:** se cierra **al final**, después de comprobar que la IA web funciona por el binding.

## Impacto en la app móvil (`biblia-ntv-app`)
- Al cerrar la API, la IA de la app deja de funcionar.
- **Recomendación:** antes de cerrar, publicar una build con un flag `ENABLE_AI = false` en `src/lib/features.ts` que oculte el botón y la selección para IA. Es un cambio chico, pero toca el proyecto móvil.
- **v2:** login en la app con la misma aplicación OIDC de Access (PKCE con `expo-auth-session`), llamando a `biblia-web/api/*` con `Authorization: Bearer`. El middleware de sesión del Worker se diseña para poder aceptar ese header más adelante.

## Tests
- **`unit`** (entorno node):
  - bollsText, passageBuilder, translation, theme, BollsBibleClient, BollsBibleRepository, useBibleAISelection, markdown, ids, bookSlugs, sincronía de `theme.css`, `returnTo`.
  - `aiClient` con `fetch` mockeado y frames SSE partidos: acumulación, `quality` ignorado, error, timeout, abort, 401 `UNAUTHENTICATED`, 403 `NOT_ALLOWED`, 429, EOF sin `end`.
- **`dom`** (entorno jsdom):
  - Ports: DatabaseProvider, ThemeProvider, ThemeToggle, VerseItem, SelectionActionBar, WordList y BibleAiPanel.
  - Nuevos: LoginPrompt, restauración de `pendingSelection`, AccountBox por rol y AdminPage (agregar, rehabilitar uno existente, habilitar/deshabilitar con confirmación, filtro, admin sin interruptor, error de sincronización con Reintentar).
- **Worker** (pool de workerd, D1 local, `env.API` mockeado):
  - **OIDC:** claves generadas con jose, Access simulado con mocks de `fetch` para `/token` y `/jwks`. Casos: state inválido, nonce inválido, `aud` o `iss` incorrectos, token vencido, correo fuera de la whitelist o deshabilitado (redirige con `denied`), `returnTo` malicioso (`//evil.com`, `https://...`) que cae en `/`.
  - **Sesión:** cookie válida, alterada, vencida. Deshabilitar en D1 corta la IA al instante y rehabilitar la devuelve.
  - **Roles:** usuario en `/api/admin/*` da 403; el admin sin estar en D1 tiene acceso; `PATCH` sobre `ADMIN_EMAIL` da 400; `DELETE` da 404.
  - **Sincronización:** el body del `PUT` lleva solo los habilitados; un fallo de la API da `synced:false`; cada acción (`add`, `enable`, `disable`, `sync`) queda en la auditoría.
  - **Proxy:** lista blanca de headers, pasamanos de estados, streaming **sin buffer**, 415, 413, 429 por email, origen cruzado (403), 502.
  - **Bypass de desarrollo:** permitido en localhost, rechazado en workers.dev.

## Hitos (cada uno se puede verificar)
0. **Scaffold** (template Vite + React + Hono de C3, git init) y mover este plan a `biblia-web/docs/`. Verificar: `npm run dev` sirve la SPA, y `/juan/3` recargado devuelve la SPA.
1. **Port del core y tests unitarios.** Verificar: `tsc -b` y los tests en verde.
2. **Tema, shell y rutas públicas.** Verificar: sin parpadeo de tema, el layout cambia al cruzar 1024 px y `/foo/999` muestra "no encontrado".
3. **Navegación y lector públicos** (Libros, Capítulos, Versículos, Lector, notas, selección, `?v=`). Verificar: todo funciona **sin sesión** a 375 px y a 1440 px.
4. **Worker: sesión, D1, authz y proxy** (con bypass de desarrollo). Verificar: `curl -N` a `localhost:5173/api/bible-ai/stream` sin cookie da 401, y con la sesión de desarrollo muestra el stream línea a línea.
5. **aiClient, SSE y panel de IA**, con LoginPrompt y restauración de la selección. Verificar: los cuatro modos funcionan contra la API real usando el bypass de desarrollo.
6. **OIDC real** (`/auth/login`, `/auth/callback`, `/auth/logout`) contra la aplicación SaaS de Access.
7. **Admin** (`/admin`, rutas de admin y sincronización de la política). Verificar: agregar un correo de prueba hace que reciba el código; deshabilitarlo le corta la IA y deja de recibir código; rehabilitarlo le devuelve el acceso.
8. **Deploy de `biblia-web`** (sección siguiente).
9. **App móvil:** build con la IA oculta.
10. **Cierre de `logosagent-api`.**
11. **Pulido:** CSP en `_headers` (`connect-src 'self' https://bolls.life`), atajos ← → y README con la tabla de archivos portados.

## Configuración de Cloudflare y despliegue
1. **Cuenta.** `npx wrangler whoami`. `biblia-web` tiene que estar en la **misma cuenta** que `logosagent-api`, porque así lo exige el Service Binding.
2. **Zero Trust.** Crear la organización si no existe (plan gratis) y activar **One-time PIN** en Integrations → Identity providers.
3. **Política reutilizable** "biblia-ia-whitelist": Allow → Include → Emails → **`ekiolivier@gmail.com`**. Anotar su ID en `ACCESS_POLICY_ID`. Desde ahí, la mantiene sincronizada `/admin`.
4. **Aplicación SaaS de Access (OIDC):** Access controls → Applications → Create → SaaS application → OIDC.
   - Redirect URL: `https://biblia-web.ezeo-cloud.workers.dev/auth/callback`. Si Access acepta `http://localhost:5173/auth/callback`, agregarla también; si no, se usa el bypass de desarrollo.
   - Scopes `openid` y `email`. **PKCE activado**.
   - Login methods: solo One-time PIN, con *instant authentication*.
   - Política: "biblia-ia-whitelist".
   - Copiar `client_id`, `client_secret` e issuer.
5. **D1:**
   - `npx wrangler d1 create biblia-web-db` y pegar el ID en `wrangler.jsonc`;
   - `npm run db:migrate`.
6. **Token de API:** Mi perfil → API Tokens → permiso de cuenta **Access: Apps and Policies → Edit**, limitado a esta cuenta.
7. **Secretos:** `wrangler secret put` para `OIDC_CLIENT_SECRET`, `SESSION_SECRET`, `ADMIN_EMAIL` (= `ekiolivier@gmail.com`) y `CF_API_TOKEN`.
8. **Deploy:** `npm run deploy`. **No** se activa Access en la pestaña del Worker, porque el sitio es público.
9. **App móvil:** publicar la build sin IA.
10. **Cerrar la API:** en `agente-biblia` agregar `workers_dev = false` y `preview_urls = false`, y hacer `npm run deploy`.
11. **Rollback:** `npx wrangler rollback` en cada Worker. Para reabrir la API, volver a `workers_dev = true` y deployar.

## Verificación de punta a punta
- **Pruebas automáticas:** `npm test`, que corre los tests unitarios, los de DOM y los del Worker.
- **Ventana de incógnito sin sesión:**
  - se lee cualquier capítulo y anda el cambio NVI/RV1960;
  - seleccionar versículos y tocar IA muestra "Iniciá sesión para usar la IA";
  - `curl -i -X POST .../api/bible-ai/stream` da 401.
- **Login con `ekiolivier@gmail.com`:**
  - llega el código y volvés al mismo capítulo con la selección restaurada;
  - el stream es progresivo (DevTools → Network → EventStream);
  - `/api/me` dice `role: "admin"`.
- **Correo fuera de la whitelist:** no recibe código.
- **Whitelist desde `/admin`:**
  - agregar un correo de prueba hace que ese correo reciba el código y pueda usar la IA, y que no vea `/admin`;
  - deshabilitarlo hace que su siguiente pedido de IA dé "no tenés acceso" y que no reciba más código, pero sigue en la lista;
  - volver a habilitarlo le devuelve el acceso.
- **Salir:** borra la sesión, y la IA vuelve a pedir login.
- **Después de cerrar la API:**
  - `curl https://logosagent-api.ekiolivier.workers.dev/health` ya no responde;
  - la IA de la web sigue funcionando;
  - `npx wrangler tail biblia-web` no muestra errores 5xx.
- **Comparación visual** con la app a 375 px (modo claro y oscuro) y uso en escritorio a 1440 px.

## Riesgos y detalles a tener en cuenta
- **Asientos de Zero Trust.** Cada correo que inicia sesión consume un asiento (el plan gratis tiene un límite). Como Access solo manda código a los correos de la política, solo la whitelist consume asientos. Deshabilitar un correo **no** libera su asiento: hay que quitarlo en Zero Trust → Users, o activar la expiración automática de asientos.
- **Sincronización entre D1 y Access.** Si falla, D1 manda para la IA: un correo deshabilitado pierde el acceso al instante. Un correo agregado o rehabilitado no puede entrar hasta que la sincronización salga bien; la UI lo avisa y permite reintentar.
- **Token de API.** El permiso se limita a "Access: Apps and Policies"; es un secreto y solo lo usan las rutas `requireAdmin`.
- **Sesión global de Access.** Después de "Salir", un login nuevo puede no pedir código mientras siga viva la sesión de Access en `<team>.cloudflareaccess.com`.
- **Cookies.** `SameSite=Lax` es necesario para que la cookie OIDC viaje en la redirección de vuelta desde Access, que es un GET de nivel superior. El prefijo `__Host-` obliga a Secure, Path=/ y sin Domain.
- **Rate limit.** Lo aplica el Worker web por email (20/min). Falta comprobar si el `cf-connecting-ip` llega a `logosagent-api` por el binding; si no llega, el límite de 30/min del server queda como un único cupo compartido.
- **SSE.** Sin `compress()` ni lectura del body en el proxy. Cloudflare no bufferiza `text/event-stream`.
- **Bypass de desarrollo.** Solo funciona con la variable en `.dev.vars` (que nunca se sube) **y** host localhost.

## Fuera de alcance (v1)
- Login en la app móvil (v2, con la misma aplicación OIDC).
- Borrar correos de la whitelist (en v1 solo se deshabilitan).
- Paquete compartido entre la app y la web.
- Búsqueda, favoritos, notas, PWA u offline.
- La traducción en la URL.
- Dominio propio.

## Notas que encontré y no se tocan acá
- En la app móvil, `.env` está versionado en git.
- En la app móvil, `features.ts` tiene `ENABLE_RV1960 = true` fijo e ignora `EXPO_PUBLIC_ENABLE_RV1960`.
