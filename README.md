# Utsav AI · Celebration & Event Planner

> PromptWars Virtual · **Challenge 5: Celebration & Event Planner**
> A GenAI-powered planning assistant that helps people organise weddings, birthdays and community events with budgets, timelines, vendor checklists and personalised ideas.

**Live demo:** https://utsav-ai-0zi4.onrender.com (free tier: the first visit after a quiet spell can take about 50 s to wake up)

## The problem

Planning a celebration means juggling a budget across a dozen categories, booking vendors in the right order, and remembering hundreds of small tasks. Most of this happens in scattered WhatsApp chats and spreadsheets. Generic checklists ignore your date, city, guest count, culture and diet. Pure chatbots invent numbers and deadlines.

## The solution

Utsav AI combines a **deterministic planning engine** (for anything that must be correct) with **Google Gemini** (for everything that should be personal):

| Need | How Utsav handles it | Engine or AI |
| --- | --- | --- |
| Budget split | Baseline splits per event type, reshaped by style and venue, rounded by largest remainder so the lines always add up exactly; per-plate feasibility check | Engine |
| Timeline | 15-20 milestones scheduled backwards from the event date; compressed proportionally for short-notice events, with overdue tasks flagged "Do now" | Engine |
| Vendor checklist | Vendors per event type with book-by dates, the questions to ask, and a Google Maps search in your city | Engine |
| Theme concepts | 3 themes with colour palettes, decor ideas and a signature moment, matched to style, budget level and city | Gemini |
| Menu | Regional dishes that respect every dietary rule (e.g. Jain: no onion, garlic or root vegetables) | Gemini |
| Savings | Category-specific tips; Gemini suggests a %, the **server computes the amount** from the real budget line | Gemini + engine |
| Personal tasks | Gemini adds tasks a template would miss (e.g. "book wheelchair-accessible transport for grandparents"); the engine gives them real due dates | Gemini + engine |
| Risks and run sheet | Venue, season and crowd risks with mitigations; an event-day schedule | Gemini |
| Ask Utsav | A chat assistant grounded in your computed plan ("How do I cut 15%?"), with follow-up suggestions | Gemini |

Plans can be written in **14 languages** (Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu, Arabic, Spanish, French, English), with correct `lang` and `dir` attributes for screen readers and right-to-left scripts.

Hosts can tick off tasks and vendors, log actual spend per category against the plan, export every milestone to their calendar (`.ics` or one-click Google Calendar), copy a summary to share with family, or print it to PDF. Progress is saved in the browser.

## How GenAI is used

- **Models:** Google Gemini via the Generative Language API (`generateContent`), with a fallback chain `gemini-3.6-flash → gemini-2.5-flash → gemini-3.5-flash` (configurable with `GEMINI_MODEL`). If one model is overloaded, the next is tried automatically.
- **Low latency:** thinking is set low per model family (`thinkingLevel: low` on Gemini 3+, `thinkingBudget: 0` on 2.5). A full plan typically arrives in about 9-11 s, and chat answers in about 4 s.
- **Structured output:** every call uses `responseMimeType: application/json` with a `responseSchema` (enums for budget categories), so responses are machine-checkable.
- **Grounding:** the model receives a compact `<computed_plan>` (budget lines, feasibility, days left, urgent tasks, vendors) and is told these are fixed facts. It reasons about them and never invents its own numbers or dates.
- **Prompt-injection defence:** user notes and questions are wrapped in `<user_notes>` and `<question>` tags and declared untrusted. Output is validated field by field (`src/ai.js`): hex colours, `HH:MM` times, category enums and clamped numbers. Strings are length-capped and rendered only with `textContent`.
- **Resilience:** 25 s timeout per attempt within a 45 s overall budget, model fallback on 429/5xx, identical requests cached for 10 minutes with in-flight de-duplication. If Gemini is unavailable the app still returns a full plan with template ideas, clearly labelled "AI offline".

## Architecture

```
Browser (vanilla ES modules, no build step)
  │  POST /api/plan, POST /api/chat, GET /api/health
  ▼
Node.js HTTP server (zero runtime dependencies)
  ├─ security.js     CSP, HSTS and other headers; token-bucket rate limiting
  ├─ validation.js   strict allow-list validation and text sanitising
  ├─ planner/        budget.js · timeline.js · vendors.js   (deterministic)
  ├─ service.js      orchestration, caching, AI fallback
  ├─ ai.js           prompts, response schemas, output sanitising
  ├─ gemini.js       Gemini REST client (key in header, timeouts, model fallback)
  └─ static.js       in-memory assets, pre-compressed (brotli/gzip) with ETags
```

## Evaluation criteria

| Criterion | What we did |
| --- | --- |
| **Code quality** | Small single-purpose modules, JSDoc types checked with `tsc --checkJs`, pure functions for the engine, dependency injection for the AI client, fetch, clock and logger |
| **Security** | Strict CSP (`script-src 'self'`, no inline code), HSTS, X-Frame-Options, nosniff, COOP/CORP, Permissions-Policy. 16 KB body cap and content-type check. Allow-list validation. Prototype-safe enum checks. Rate limits (12/min AI, 240/min general). API key server-side only, sent in a header. No stack traces leak. Static files are served only from a preloaded allow-list, so path traversal is impossible. Non-root Docker user |
| **Efficiency** | Zero dependencies. Assets loaded once and pre-compressed with Brotli and gzip. ETag/304 support. LRU+TTL cache with in-flight de-duplication, so duplicate plans cost one model call. Bounded rate-limiter memory. Compact prompts |
| **Testing** | 98 tests with Node's built-in runner: unit tests for every engine, validator, prompt and sanitiser; Gemini client tests with a fake fetch; HTTP integration tests (headers, compression, 304, traversal, 400/405/413/415/429, error hiding); a test that keeps HTML options in sync with server enums. About 99.9% line coverage |
| **Accessibility** | Skip link, landmarks, every control labelled, fieldsets and legends. Error summary that takes focus, plus `aria-invalid`. WAI-ARIA tabs with arrow, Home and End keys. Live regions for status and chat. Progress bars with ARIA values. 44 px touch targets. Visible focus rings. Dark mode, `prefers-reduced-motion`, `forced-colors`. `lang` and `dir` on AI text. Print stylesheet |
| **Problem alignment** | Weddings, engagements, birthdays, anniversaries, baby showers, housewarmings, community events and festivals. Budgets, timelines, vendor checklists and personalised ideas, exactly as the brief asks |

## Run locally

Requires Node.js 20.12 or newer. There is nothing to install.

```bash
cp .env.example .env      # add your GEMINI_API_KEY (free at https://aistudio.google.com/apikey)
npm run dev               # http://localhost:8080
npm test                  # run the test suite
npm run test:coverage     # with coverage report
```

## Deploy

**Google Cloud Run**

```bash
gcloud run deploy utsav-ai --source . --region asia-south1 --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=YOUR_KEY
```

For production, store the key in Secret Manager and use `--set-secrets GEMINI_API_KEY=gemini-key:latest`.

**Render (free tier)**: `render.yaml` is a ready Blueprint. In the Render dashboard choose *New → Blueprint*, pick this repository and enter `GEMINI_API_KEY` when prompted.

**Any container host** (Railway, Fly.io): build the included `Dockerfile` and set `GEMINI_API_KEY`. The container listens on `$PORT` (default 8080), sets `TRUST_PROXY=1` and shuts down cleanly on SIGTERM.

## Project structure

```
server.js            entry point and graceful shutdown
src/                 server modules (see Architecture)
public/              index.html, styles.css, js/ (main, render, dom, api, calendar, format, store)
test/                node:test suites
Dockerfile           production image
```

## License

MIT
