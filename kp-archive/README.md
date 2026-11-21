# Chat-Archiv: Kenntnisprüfung Medizin – Sachsen

A read-only, WhatsApp-Web-style archive of one exported WhatsApp group. The admin prepares the data once; visitors just open the URL. There is no upload or import UI.

## Architecture
- `scripts/prepare.py` – parses the export (zip or folder) → `web/public/data/` (`meta.json`, `months/YYYY-MM.json`, `search.json`, `media/`).
- `scripts/insights.py` – builds `insights.json` (keyword analysis; optional `--llm` summaries).
- `web/` – React + TypeScript + Tailwind (Vite). Virtualised message list (TanStack Virtual), MiniSearch full-text search, filters, date jump.
- `api/ask.ts` – optional Vercel function for the "KI fragen" assistant (keeps the API key secret).

Static JSON + GitHub Pages is enough for this size (≈2.7k messages). Months load as separate files and the list is virtualised, so tens of thousands of messages are fine. For hundreds of thousands, move `search.json` to Supabase full-text search (Postgres `tsvector`) and load months on scroll.

## Privacy – read before publishing
The export contains ~535 members' phone numbers and personal messages. By default `prepare.py`:
- replaces senders with `Teilnehmer N` and redacts phone numbers in texts,
- drops join/leave/number-change events and contact cards,
- writes the real mapping to `data-private/sender-map.json` (git-ignored; never publish).

It does **not** remove real names written inside messages, or personal info visible in images/PDFs. Review the data (and media, or use `--no-media`) and get the group's consent / check GDPR before making it public. Consider access protection (Vercel password, Cloudflare Access) instead of a fully public URL. `index.html` sets `noindex`.

## Prepare the data (once)
```bash
pip install -r requirements.txt
python scripts/prepare.py path/to/WhatsApp_Chat.zip      # add --no-media to skip attachments
python scripts/insights.py                               # optional: ANTHROPIC_API_KEY=... python scripts/insights.py --llm
```
Handles `dd/mm/yyyy, HH:MM - ` (Android), `[dd.mm.yy, HH:MM:SS]` (iOS), 12 h AM/PM, and auto-detects day/month order. Multiline messages and emoji are preserved. Files > 25 MB are skipped.

## Run locally
```bash
cd web && npm install && npm run dev
```

## Deploy (GitHub Pages)
1. Create a GitHub repo, commit everything (including `web/public/data`) and push to `main`.
2. Settings → Pages → Source: **GitHub Actions**. The workflow `.github/workflows/pages.yml` builds and publishes. URL: `https://<user>.github.io/<repo>/`.

## AI assistant (optional)
1. Import the repo into Vercel (root directory = repo root; it only needs `api/ask.ts`).
2. Set env vars: `ANTHROPIC_API_KEY`, `SITE_URL` (your Pages URL), `ALLOWED_ORIGIN` (Pages origin), optional `AI_MODEL`.
3. In GitHub → Settings → Variables → Actions add `VITE_AI_ENDPOINT = https://<project>.vercel.app/api/ask` and re-run the workflow.
Add rate limiting (e.g. Vercel Firewall / Upstash) before going public – otherwise anyone can spend your API credit.

Answers are returned as segments typed `quote` (verified to appear verbatim in a cited message, otherwise downgraded) or `interpretation` (AI), each with message references that jump to the original.
