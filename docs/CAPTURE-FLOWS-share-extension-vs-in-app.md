# Share Extension vs Add Item Sheet

This document explains how items move from “saved” to “fully processed” in two entry points:

- the **Share Extension** (`src/components/ShareExtension.tsx`), optimized for fast, background saving when you are outside the app.
- the **Add Item Sheet** (`src/components/AddItemSheet.tsx`), the in-app bottom sheet for pasting links or notes.

Both flows ultimately run through the same processing pipeline (`itemProcessingQueue` → `processItem` → `runPipeline`), but they differ in how data is captured, when Supabase rows are created, and what user feedback is shown along the way.

---

## 1. Shared Building Blocks

- **`itemProcessingQueue` (`src/services/itemProcessingQueue.ts`)**  
  Ensures items are processed sequentially to avoid race conditions. Each enqueue call stores the URL + optional `itemId`/`spaceId`/`content`/`source`. A single worker pulls from the queue and calls `processItem`.

- **`processItem` (`src/services/itemProcessingService.ts`)**  
  Central logic for both sources:
  1. Validates the user, deduplicates by URL, and either reuses an existing item or creates a new row.
  2. Adds the item id to `processingItemsStore` so the UI can show a processing card.
  3. Runs the enrichment pipeline (`runPipeline`), which performs content-type detection, metadata fetching (e.g., Step04_2_EnrichX, Step04_3_EnrichReddit), and optional TLDR generation.
  4. Cleans up the processing store entry.

- **Realtime & Sync (`src/services/realtimeSync.ts`, `src/services/syncService.ts`)**  
  Keeps the local stores/AsyncStorage mirrors (`itemsStore`, `pendingItemsStore`, etc.) aligned with Supabase inserts and updates, no matter where an item originated.

---

## 2. Share Extension Flow

1. **Bootstrap**
   - `ShareExtension.tsx` loads theme + auth state, then tries to read a minimal Supabase session from the shared Keychain (`saveSharedAuth` / `getSharedAuth`).
   - It parses the content handed to it by iOS (URL, text, image, video) and sets up a 1-second auto-save timer once a URL is available and shared auth exists.

2. **Saving to Supabase (`pending_items`)**
   - On auto-save, the extension creates a short-lived Supabase client (no persisted session) and calls `supabase.auth.setSession` with the shared token.
   - It inserts `{ user_id, url, space_id?, content? }` into the `pending_items` table. This is a minimal “placeholder” record; the main `items` table is not touched yet.
   - Once inserted, the extension shows a success banner and closes, keeping the share-sheet response quick.

3. **Server-Side Processing (Supabase Edge Function)**
   - A database trigger (`pending_items_trigger`) fires `supabase/functions/process-pending-item`.
   - The Edge Function updates the pending row to `processing`, extracts metadata (Jina AI → HTML fallback), creates a real row in `items`, then marks the pending row `completed`.

4. **Realtime Feedback in the App**
   - The main app subscribes to `pending_items` changes (`subscriptions.pendingItems`).
   - On `INSERT`, `pendingItemsStore` adds a banner card and immediately calls `pendingItemsProcessor.processPendingItemByUrl`.
     - Recent changes added a **wait-and-reuse** loop: `processItem` now polls for up to 8 seconds (`waitForShareExtensionItem`) to reuse the Edge Function’s canonical `items` row instead of creating a duplicate. If found, it caches the remote row locally before running the pipeline.
   - On `UPDATE` to `processing/completed/failed`, the banner UI updates. Completion removes the banner after a short dwell time.

5. **Final State**
   - Once realtime sync delivers the server-created `items` row, it appears in the main list. The pipeline work started by the Edge Function continues client-side (Content-Type detection, Reddit/X enrichment, etc.) via `processItem`.

> **Key characteristics**
> - Fast user experience (the extension dismisses after a small insert).
> - Relies on Supabase triggers/Edge Functions to create the “real” item.
> - Deduplication waits for the server-created row to land, so metadata-rich cards don’t double-render.

---

## 3. Add Item Sheet Flow

1. **User Input**
   - `AddItemSheet.tsx` is a bottom sheet inside the main app. It tracks text input, exposes imperative `open/close` helpers, and shows quick actions (Paste + Save vs Save).
   - When the user taps Save (or Paste + Save), it validates the text and ensures a user is signed in.

2. **Queueing Work**
   - Instead of inserting into `pending_items`, the sheet directly enqueues the URL with `source: 'manual'` in `itemProcessingQueue`. There’s no detour through Supabase; local UX can be optimistic.
   - A quick “Saved” toast shows immediately, and the sheet auto-closes. The queued job runs asynchronously.

3. **Processing**
   - `processItem` runs the same logic as above but skips the Supabase wait because the app itself is responsible for creating the first row.
   - If the URL doesn’t exist yet, it generates a provisional UUID + title (usually the hostname) and calls `itemsActions.addItemWithSync`, which stores the row locally and pushes it to Supabase (`syncOperations.uploadItem`).
   - The enrichment pipeline runs, updating metadata, thumbnails, and content-type-specific structures (`item_metadata`, `item_type_metadata`).

4. **Realtime + Sync**
   - Because the app itself created the row, realtime updates from Supabase mostly echo the same data back, ensuring other devices stay in sync. The processing banner for that item is removed once `processItem` finishes.

> **Key characteristics**
> - Everything happens inside the app; no Edge Function path is needed.
> - Optimistic UI (sheet closes instantly, card appears immediately).
> - Suitable for links or notes when you’re already in Memex.

---

## 4. Comparison Summary

| Aspect | Share Extension | Add Item Sheet |
| --- | --- | --- |
| Where it runs | iOS share modal (separate process) | Main app bottom sheet |
| Auth strategy | Shared Keychain ➜ temporary Supabase session | Regular app session |
| First write | `pending_items` insert only | `items` insert (via `addItemWithSync`) |
| Item creation | Edge Function creates canonical row, client waits to re-use it | Client creates canonical row immediately |
| Deduping | `waitForShareExtensionItem` polls for server-created row | Direct local check before creating |
| User feedback | Pending banner + realtime status updates | Optimistic “Saved” message + immediate card |
| Failure handling | Pending item marked `failed`, banner shows error | Alert/toast directly in the sheet |

Both inputs converge on the same processing queue and pipeline, so once the item exists, enrichment, AI metadata, TLDR generation, and sync behave identically.

---

## 5. Related Files & References

- `src/components/ShareExtension.tsx`
- `src/components/AddItemSheet.tsx`
- `src/services/itemProcessingQueue.ts`
- `src/services/itemProcessingService.ts`
- `supabase/functions/process-pending-item/index.ts`
- `supabase/migrations/20250206_create_pending_items.sql`
- `docs/PRD.md` (Share Extension architecture section)

Use this document as a quick onboarding reference when touching either flow or when diagnosing issues like duplicate cards, missing metadata, or pending banners that never clear.

---

## 6. Upcoming Improvements

Below is the backlog we discussed to reach full feature parity and eliminate remaining edge cases. Each bullet can be carved into a focused PR.

- **URL normalization & dedupe**  
  - Normalize/canonicalize URLs (strip trackers, force canonical host) and persist a `url_hash`.  
  - Add a unique constraint on `(user_id, url_hash)` in `items`.

- **Capture entry unification**  
  - Introduce a single `captureUrl({ source: 'share' | 'manual' })` helper that both Share Extension and Add Item Sheet call before enqueueing.  
  - Populate `client_ref` with either the pending row id or the local UUID so later steps can reference the same capture.

- **Pending ↔ item linkage**  
  - Have the Edge Function set `pending_items.item_id` when it creates the `items` row.  
  - Let the app watch that field to attach UI state, eliminating URL-based polling.

- **Settings snapshots**  
  - Capture an `effective_settings` snapshot (user + admin) at enqueue/claim time and thread it through the entire pipeline so jobs run with consistent config.

- **Idempotent pipeline flags**  
  - Add per-step markers (`metadata_done`, `transcript_done`, `image_desc_done`, `tldr_done`, `pipeline_version`).  
  - Each step becomes re-runnable and no-ops when the flag is already set.

- **Server-side TLDR + cost guards**  
  - Move TLDR generation into an Edge Function (no device OpenAI keys).  
  - Skip tiny pages, chunk long transcripts, enforce daily caps/backoff.

- **Queue timing & concurrency hygiene**  
  - Only kick the queue when `AppState === 'active'` and after `InteractionManager.runAfterInteractions`.  
  - Keep a small concurrency cap (e.g., 2 workers) even if most runs are sequential.

- **Error states & retries**  
  - Track `attempts`, `retry_at`, `error_code`, `error_message` on `pending_items`.  
  - Implement exponential backoff and surface a “Tap to retry” UI when a job fails.

- **Observability**  
  - Emit structured logs per job/step with durations/outcomes and ship them to Sentry (or an equivalent ingest).

- **Network & auth guards**  
  - Optionally defer heavy steps until Wi‑Fi.  
  - Detect 401/403 responses, mark captures as `needs_login`, and present an “Open in browser” CTA.

- **Security & RLS**  
  - Keep service-role/OpenAI keys off the device; only Edge Functions use privileged keys.  
  - Ensure RLS covers both `pending_items` and `items`.

- **App rehydration**  
  - Key `processingItemsStore` by `pending_item.id` (or `client_ref`) so processing cards survive app relaunches.

- **Canonical source parity**  
  - Ensure the client pipeline skips steps already completed server-side by honoring the step flags described above.
