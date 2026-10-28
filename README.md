# biblia-web

Cliente web de la Biblia. Es una SPA de Vite, React 19, TanStack Router y TanStack Query servida por el Worker de Cloudflare `biblia-web`.

La lectura es pública y el texto sale de `https://bolls.life`. La IA solo funciona con una sesión y un correo habilitado. El navegador llama a `/api/bible-ai/stream` en el mismo origen, y el Worker reenvía el stream a `logosagent-api` por Service Binding.

El plan de implementación está en [`docs/PLAN-BIBLIA-WEB.md`](docs/PLAN-BIBLIA-WEB.md).

## Cómo correrlo

Hace falta Node 22 o más nuevo. El lockfile se generó con npm 11: npm 10.9.2 puede fallar al armar el árbol con `Cannot read properties of null (reading 'edgesOut')`. Usá npm 11 (`npx npm@11 ci`).

```bash
npm ci
cp .dev.vars.example .dev.vars
npm run dev
```

`.dev.vars` no se commitea. El bypass de desarrollo solo crea sesión si `DEV_AUTH_BYPASS=true` y el host es `localhost`, `127.0.0.1` o `[::1]`. En `*.workers.dev` el login sigue yendo a Access aunque esa variable esté presente.

```bash
npm test          # Vitest (unit + DOM) y el pool de Workers
npm run typecheck
npm run build
```

`npm run deploy` existe y no se ejecutó en este cambio. No actives Access en la pestaña del Worker: el sitio tiene que seguir siendo público.

## Procedencia del código

Los módulos de `src/core/` salen de [app-ntv-personal](https://github.com/ezeoli88/app-ntv-personal) (`biblia-ntv-app`). Cada archivo portado lo dice en la primera línea. El servidor [server-agent-ntv-app](https://github.com/ezeoli88/server-agent-ntv-app) (`logosagent-api`) solo se leyó: este repositorio no lo modifica.

| Archivo web | Origen |
|---|---|
| `src/core/types/ai.ts` | `src/types/ai.ts` |
| `src/core/types/bible.ts` | `src/types/bible.ts`, sin `RootStackParamList` |
| `src/core/types/translation.ts` | `src/types/translation.ts` |
| `src/core/data/bibleStructure.ts` | `src/data/bibleStructure.ts` |
| `src/core/api/BollsBibleClient.ts` | `src/api/BollsBibleClient.ts` |
| `src/core/repositories/*` | `src/repositories/*` |
| `src/core/lib/passageBuilder.ts` | `src/lib/passageBuilder.ts` |
| `src/core/lib/bollsText.ts` | `src/lib/bollsText.ts` |
| `src/core/lib/wordDefinitionsCache.ts` | `src/lib/wordDefinitionsCache.ts` |
| `src/core/lib/ids.ts` | extraído de `BollsBibleRepository` |
| `src/core/lib/markdown.ts` | extraído de `MarkdownText` |
| `src/core/lib/bookSlugs.ts` | nuevo: slugs en español sin tildes |
| `src/core/lib/aiClient.ts` | misma superficie, transporte `fetch` + SSE al mismo origen. Se eliminó `askBibleAI` y se agregó `defineWordsStreamWithoutLexicon` |
| `src/core/hooks/useBibleQueries.ts` | `src/hooks/useBibleQueries.ts` |
| `src/core/hooks/useBibleAISelection.ts` | `src/hooks/useBibleAISelection.ts` |
| `src/core/hooks/useWordsAnalysis.ts` | `src/hooks/useWordsAnalysis.ts` |
| `src/core/hooks/DatabaseProvider.tsx` | `localStorage` `bible-translation` |
| `src/core/providers/QueryProvider.tsx` | `refetchOnWindowFocus: false` |
| `src/core/providers/ThemeProvider.tsx` | `localStorage` `theme-mode` (claro, oscuro o sistema) y `font-scale`, `data-theme` en `<html>` |
| `src/core/theme/index.ts` | solo tokens, sin React Native |

`src/lib/features.ts` no existe en la app móvil actual. No hay un flag `ENABLE_AI` ni `ENABLE_RV1960` para copiar. Las traducciones vigentes son NTV, LBLA, RV1960, RV2004, PDT y BTX3. NVI queda mapeada a NTV porque Bolls ya no la sirve.

## Infraestructura que ya está en `wrangler.jsonc`

Estos valores no son secretos:

| Campo | Valor |
|---|---|
| Cuenta | `8096ee9cb07e2778b55e8057e09b23fb` |
| D1 `biblia-web-db` | `88e62183-a380-4033-98be-d858a9ef0859` |
| `ACCESS_POLICY_ID` | `79452e7b-87ff-4117-8727-0b9da93c83f6` |
| `OIDC_CLIENT_ID` | `de08183e9a0a09f85b269f5f83ff9eb105114b48f0f97ea11d546ab9a8783990` |
| `OIDC_ISSUER` | `https://ekiolivier.cloudflareaccess.com/cdn-cgi/access/sso/oidc/de08183e9a0a09f85b269f5f83ff9eb105114b48f0f97ea11d546ab9a8783990` |

Callbacks ya configurados en la aplicación SaaS de Access:

- `https://biblia-web.ezeo-cloud.workers.dev/auth/callback`
- `http://localhost:5173/auth/callback`

El build genera `sitemap.xml` (inicio, libros y capítulos) y `public/robots.txt` lo anuncia. Los dos usan la URL pública de `SITE_ORIGIN` (`src/web/seo/site.ts`): si el sitio cambia de dominio, hay que actualizar esa constante y `public/robots.txt`.

Las Conexiones (referencias cruzadas) salen de [OpenBible.info](https://www.openbible.info/labs/cross-references/), con licencia CC-BY. `npm run build` corre `npm run gen:xrefs`, que descarga el archivo una vez y escribe `public/xrefs/<libro>.json` (no se commitea). Si la máquina no llega a `a.openbible.info`, el build avisa y sigue, y el lector no muestra Conexiones. `npm run gen:xrefs -- --force` vuelve a descargarlo.

## Secretos

No están en el repo ni en `wrangler.jsonc`. Van con `wrangler secret put` sobre el Worker `biblia-web`:

| Secreto | Uso |
|---|---|
| `OIDC_CLIENT_SECRET` | secreto de la aplicación SaaS de Access |
| `SESSION_SECRET` | 32 bytes o más, firma las cookies `__Host-bw_session` y `__Host-bw_oidc` |
| `ADMIN_EMAIL` | `ekiolivier@gmail.com` |
| `CF_API_TOKEN` | permiso de cuenta **Access: Apps and Policies → Edit**, solo esta cuenta |
| `LOGOSAGENT_API_KEY` | mismo valor que el secreto `API_ACCESS_KEY` de `logosagent-api`; el proxy lo envía en `x-api-key` |

El build avisa si no están en el entorno local. Eso es esperable: no los pongas en `.env` ni en el repositorio. `.dev.vars.example` solo tiene placeholders para el bypass. Para usar la IA en `vite dev`, poné en tu `.dev.vars` el valor real de `LOGOSAGENT_API_KEY`: el binding remoto llama al Worker desplegado.

Si la base todavía no tiene tablas, o hay migraciones nuevas en `migrations/`: `npm run db:migrate`.

## Cupo de IA

Cada lector habilitado tiene 100 consultas de IA por mes calendario (UTC), en todos los modos (`AI_MONTHLY_LIMIT` en `worker/db/aiUsage.ts`). El admin no tiene cupo y el estudio de palabra (`step: "study"`, sale del léxico sin usar el modelo) no lo consume. El proxy cuenta la consulta en la tabla `ai_usage` antes de llamar a `logosagent-api` y la devuelve si la API falla o la rechaza. Sin cupo responde `429 MONTHLY_QUOTA_EXCEEDED`. `/api/me` devuelve `aiQuota` (`limit`, `used`, `remaining`, `resetsAt`) y el panel de IA muestra cuántas quedan.

«Preguntale al pasaje» además admite 3 preguntas por conversación, con respuestas breves (lo controla `logosagent-api`).

## Estudio con IA

- **Estudio de palabra a fondo**: al terminar la definición de una palabra del léxico, el panel muestra su ficha (lema, categoría, Strong, cuántas veces aparece, en qué libros y otros versículos con su texto). Sale de `step: "study"` de `logosagent-api`, que no usa el modelo ni consume cupo.
- **Guía para grupo pequeño**: se elige 30, 45 o 60 minutos y la IA arma la guía con tiempos por sección. Se puede copiar.
- **Cuaderno de estudio**: «Guardar en el cuaderno» en las respuestas, en cada respuesta del chat y en las palabras. Está en Guardados → Cuaderno, con etiquetas para filtrar y exportación a Markdown (copiar o descargar, con las notas de versículos). Se guarda en la cuenta del lector, igual que las marcas (ver «Datos del lector»).

## Datos del lector

Los subrayados, marcadores y notas, el cuaderno de estudio y «Seguir leyendo» se guardan en D1 (`migrations/0003_user_data.sql`: `verse_annotations`, `notebook_entries`, `reading_progress`), por email y solo para lectores habilitados. Sin sesión no se puede marcar ni guardar: la app pide iniciar sesión. El tema, el tamaño de letra y la traducción siguen en el dispositivo.

API (sesión y acceso obligatorios): `GET /api/user-data`, `POST /api/user-data/annotations` (`upsert`, `remove`), `POST /api/user-data/notebook`, `PATCH`/`DELETE /api/user-data/notebook/:id`, `PUT /api/user-data/reading` y `POST /api/user-data/import`. Topes por lector: 5000 versículos marcados y 500 entradas de cuaderno.

Al iniciar sesión, lo que quedó guardado en el dispositivo con la versión anterior (`verse-annotations`, `study-notebook`, `last-reading` en `localStorage`) se sube con `/api/user-data/import` sin pisar lo más nuevo de la cuenta, y se borra del dispositivo.

Antes de desplegar: `npm run db:migrate`.

## `logosagent-api` (otro repositorio)

`logosagent-api` ([server-agent-ntv-app](https://github.com/ezeoli88/server-agent-ntv-app)) no tiene URL pública (`workers_dev = false`, `preview_urls = false`): solo lo alcanza este Worker por el binding `API`. La app móvil quedó sin IA; el dueño lo aceptó.

Además exige `x-api-key` y falla cerrado si no tiene la clave configurada. El proxy envía `LOGOSAGENT_API_KEY` y nunca reenvía la del navegador. Si el secreto falta, responde `502 UPSTREAM_UNAVAILABLE` sin llamar al Worker (log `ai.api_key_missing`). Un `401` de `logosagent-api` también se informa como `502`, porque es una clave mal configurada y no un problema de la sesión (log `ai.upstream_unauthorized`).

Orden para activar la clave sin cortar la IA:

1. Generar un valor aleatorio, por ejemplo con `openssl rand -base64 32`.
2. `npx wrangler secret put LOGOSAGENT_API_KEY` en `biblia-web` y desplegar `biblia-web`. La versión vieja de `logosagent-api` ignora el header mientras no tenga clave.
3. `npx wrangler secret put API_ACCESS_KEY` en `logosagent-api`, con el mismo valor.
4. Desplegar la versión de `logosagent-api` que exige la clave.

Para volver atrás: `npx wrangler rollback` en cada Worker.

El binding exige que `logosagent-api` esté en la misma cuenta (`8096ee9cb07e2778b55e8057e09b23fb`). En `vite dev` el binding está en `remote: true` y habla con el Worker ya desplegado.
