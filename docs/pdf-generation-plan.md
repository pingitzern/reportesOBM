# PDF Generation via Supabase Edge Functions

This document captures the agreed architecture for migrating the legacy Google Apps Script PDF pipeline to Supabase Edge Functions.

## High-level flow

1. **Trigger**: the frontend requests `POST /functions/v1/generate-maintenance-pdf` with the `maintenanceId` (and optionally a `forceRegenerate` flag if we want to re-render an existing report).
2. **Edge Function responsibilities**:
   - Validate the payload and normalize IDs.
   - Fetch the full maintenance payload plus related client/equipment info using the service-role Supabase client.
   - Transform the JSON into a deterministic PDF descriptor (docDefinition) that mirrors the existing report layout.
   - Render the PDF using a pure-JS engine (pdfmake) to stay within the Deno sandbox (no headless Chrome needed).
   - Upload the resulting PDF into a dedicated Supabase Storage bucket (`maintenance-reports`) using an idempotent `maintenances/<maintenanceId>.pdf` path.
   - Return a signed URL (or the storage path) to the caller so the frontend can download/print immediately.
3. **Persistence**: PDFs are cached in Storage so we can serve them again without regeneration (unless `forceRegenerate` is provided).

## Supabase pieces

- **Storage bucket**: `maintenance-reports` (private). The Edge Function uploads PDF binaries here and returns signed URLs valid for a short window. Long-term we can save the storage path on the `maintenances` row.
- **Edge Function**: `supabase/functions/generate-maintenance-pdf/index.ts`.
  - Uses `npm:pdfmake` (server build) plus the bundled Roboto font definitions.
  - Uses `@supabase/supabase-js` with the `SUPABASE_SERVICE_ROLE_KEY` secret.
  - Reads environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PDF_STORAGE_BUCKET`, `PDF_SIGNED_URL_TTL`.
  - Exposes `POST` (optionally `GET?id=` for manual browser testing).

## Frontend updates (later)

1. Replace the current `window.print()` call after `guardarMantenimiento` with:
   - `await api.generarPdf(mantenimientoId)` (new helper hitting the Edge Function).
   - Show download toast + open PDF in new tab.
2. Provide a secondary action in history/search screens to re-generate/download stored PDFs.

## Deployment checklist

1. `supabase storage create-bucket maintenance-reports --private` (one-time).
2. `supabase secrets set --project-ref <ref> SUPABASE_SERVICE_ROLE_KEY=...` etc.
3. `supabase functions deploy generate-maintenance-pdf`.
4. Grant the frontend service role (or use a Supabase Function key) to invoke the function securely. For public users we can proxy the request via our Vite backend facade once ready.

## Open questions

- Final visual layout: reuse current HTML styles or move to a dedicated PDF-friendly template.
- Multi-language support: docDefinition should centralize labels for easier localization.
- Large assets (logos/signatures): host in Storage and fetch as base64 for embedding.
