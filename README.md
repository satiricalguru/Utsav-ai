<div align="center">

<img src="public/icon.svg" width="72" height="72" alt="Utsav AI logo">

# Utsav AI

### Every celebration, _beautifully planned_

A GenAI planning assistant for weddings, birthdays, pujas and neighbourhood festivals:<br>
a budget that adds up, a timeline worked back from the big day, the vendors to book,<br>
and ideas that feel unmistakably yours.

[![Live demo](https://img.shields.io/badge/Live_demo-utsav--ai.onrender.com-1d1d1f?style=for-the-badge&logo=render&logoColor=white)](https://utsav-ai-0zi4.onrender.com)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-structured_output-9c5a14?style=for-the-badge&logo=googlegemini&logoColor=white)](#how-gemini-is-used)

![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520.12-3c873a?logo=nodedotjs&logoColor=white)
![Dependencies](https://img.shields.io/badge/runtime_dependencies-0-1d1d1f)
[![CI](https://github.com/satiricalguru/Utsav-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/satiricalguru/Utsav-ai/actions/workflows/ci.yml)
![Tests](https://img.shields.io/badge/tests-137_passing-1f7a37)
![Coverage](https://img.shields.io/badge/line_coverage-100%25-1f7a37)
![TypeScript strict](https://img.shields.io/badge/types-strict_checkJs-3178c6)
![Languages](https://img.shields.io/badge/plan_languages-14-9c5a14)
![License](https://img.shields.io/badge/license-MIT-6b6b70)

**PromptWars Virtual · Challenge 5: Celebration & Event Planner**

<br>

<img src="docs/media/hero.gif" alt="Animated hero: a glowing horizon, drifting petals and the headline Every celebration, beautifully planned" width="100%">

</div>

<br>

## Why Utsav

Planning a celebration means juggling a budget across a dozen categories, booking vendors in the right order, and remembering a hundred small things, usually across scattered WhatsApp chats and spreadsheets. Generic checklists ignore your date, city, guest count, culture and diet. Pure chatbots invent numbers and deadlines.

**Utsav AI splits the work:** a deterministic engine handles everything that must be _correct_, and Google Gemini handles everything that should feel _personal_.

<div align="center">
<img src="docs/media/statement.gif" alt="Scrolling statement where each word lights up: a budget that adds up to the last rupee, a timeline worked backwards, vendors booked in the right order, and ideas that feel unmistakably yours" width="70%">
</div>

## See it in action

<table>
<tr>
<td width="50%" valign="top">

**From a wish list to a ready plan.** A pinned scroll story where a sample plan builds itself: budget, themes, checklist.

<img src="docs/media/story.gif" alt="Scroll story: a plan card fills in step by step as the four steps scroll past">
</td>
<td width="50%" valign="top">

**A dashboard, not a chat log.** Countdown, budget health, progress rings, budget donut and what to do next.

<img src="docs/media/dashboard.gif" alt="Dashboard tabs switching between Overview, Ideas, Budget, Timeline and Vendors">
</td>
</tr>
</table>

### The plan dashboard

<img src="docs/media/dashboard-overview.webp" alt="Dashboard overview with countdown, budget health, task and vendor rings, budget donut and up-next tasks" width="100%">

<table>
<tr>
<td width="50%"><img src="docs/media/dashboard-timeline.webp" alt="Timeline tab with a month-by-month chart of planning phases and Today and Event-day markers"><br><sub><b>Timeline.</b> Phases on a month axis, with every task scheduled backwards from the date.</sub></td>
<td width="50%"><img src="docs/media/dashboard-budget.webp" alt="Budget tab with the category split and smart ways to save"><br><sub><b>Budget.</b> A split that always adds up, savings tips with amounts calculated by the server, and planned vs actual spend.</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/media/dashboard-ideas.webp" alt="Ideas tab with three theme concepts, colour palettes, menu and guest touches"><br><sub><b>Ideas.</b> Three themes with palettes, a menu that respects every dietary rule, and a run sheet.</sub></td>
<td width="50%"><img src="docs/media/dashboard-light.webp" alt="Dashboard in light mode"><br><sub><b>Light and dark.</b> A restrained warm-neutral system with one saffron-gold accent.</sub></td>
</tr>
</table>

### The landing page

<p align="center">
  <img src="docs/media/occasions.webp" alt="Occasion gallery with photos for weddings, engagements, birthdays and anniversaries" width="32%">
  <img src="docs/media/features.webp" alt="Feature tiles: a budget that always adds up and a timeline worked backwards" width="32%">
  <img src="docs/media/planner-light.webp" alt="Planner form with filled fields, custom selects and dietary toggles" width="32%">
</p>
<p align="center"><sub><b>Occasion gallery</b> that prefills the planner · <b>feature tiles</b> with live counters · <b>the planner</b>: about a minute, no account</sub></p>

<p align="center">
  <img src="docs/media/mobile-hero.webp" alt="Mobile hero" width="180">
  &nbsp;&nbsp;
  <img src="docs/media/mobile-dashboard.webp" alt="Mobile dashboard" width="180">
</p>
<p align="center"><sub><b>Built mobile-first.</b> Every view adapts to phones.</sub></p>

## What you get

| Need                | How Utsav handles it                                                                                                                                      | Engine or AI    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Budget split        | Baseline splits per event type, reshaped by style and venue, rounded by largest remainder so the lines always add up exactly; per-plate feasibility check | Engine          |
| Timeline            | 15-20 milestones scheduled backwards from the event date; compressed proportionally for short-notice events, with overdue tasks flagged "Do now"          | Engine          |
| Vendor checklist    | Vendors per event type with book-by dates, the questions to ask, and a Google Maps search in your city                                                    | Engine          |
| Theme concepts      | 3 themes with colour palettes, decor ideas and a signature moment, matched to style, budget level and city                                                | Gemini          |
| Menu                | Regional dishes that respect every dietary rule (e.g. Jain: no onion, garlic or root vegetables)                                                          | Gemini          |
| Savings             | Category-specific tips; Gemini suggests a percentage, the **server computes the amount** from the real budget line                                        | Gemini + engine |
| Personal tasks      | Tasks a template would miss (e.g. "book wheelchair-accessible transport for grandparents"), given real due dates by the engine                            | Gemini + engine |
| Risks and run sheet | Venue, season and crowd risks with mitigations; an event-day schedule                                                                                     | Gemini          |
| Ask Utsav           | A chat assistant grounded in your computed plan ("How do I cut 15%?"), with follow-up suggestions                                                         | Gemini          |

Plans can be written in **14 languages**: English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu, Arabic, Spanish and French, with correct `lang` and `dir` attributes for screen readers and right-to-left scripts.

Hosts can tick off tasks and vendors, log actual spend against the plan, export every milestone to their calendar (`.ics` or one-click Google Calendar), copy a summary for the family group, or print to PDF. Progress is saved in the browser.

## How Gemini is used

```mermaid
flowchart LR
  A[Event details] --> V[Validate and sanitise]
  V --> E[Planning engine<br/>budget · timeline · vendors]
  E --> P[Compact computed plan]
  P --> G[Gemini<br/>structured JSON output]
  G --> S[Validate every field<br/>clamp · enums · hex · HH:MM]
  S --> M[Merge AI tasks into timeline<br/>server computes savings]
  M --> D[Dashboard]
  G -. overloaded .-> F[Next model in chain]
  G -. unavailable .-> T[Template ideas<br/>labelled AI offline]
```

- **Models:** Google Gemini via the Generative Language API (`generateContent`), with a fallback chain `gemini-3.6-flash → gemini-2.5-flash → gemini-3.5-flash` (configurable with `GEMINI_MODEL`). If one model is overloaded, the next is tried automatically.
- **Low latency:** thinking is set low per model family (`thinkingLevel: low` on Gemini 3+, `thinkingBudget: 0` on 2.5). A full plan typically arrives in about 9-11 s, and chat answers in about 4 s.
- **Structured output:** every call uses `responseMimeType: application/json` with a `responseSchema` (enums for budget categories), so responses are machine-checkable.
- **Grounding:** the model receives a compact `<computed_plan>` (budget lines, feasibility, days left, urgent tasks, vendors) and is told these are fixed facts. It reasons about them and never invents its own numbers or dates.
- **Prompt-injection defence:** user notes and questions are wrapped in `<user_notes>` and `<question>` tags and declared untrusted. Output is validated field by field (`src/ai.js`). Strings are length-capped and rendered only with `textContent`.
- **Resilience:** 25 s timeout per attempt within a 45 s overall budget, model fallback on 429/5xx, and identical requests cached for 10 minutes with in-flight de-duplication. If Gemini is unavailable, the app still returns a full plan with template ideas, clearly labelled "AI offline".

## Design

The design was researched from real references (details in [CREDITS.md](CREDITS.md)) and then audited for an Apple-level finish:

- **Design system:** warm neutrals, a single saffron-gold accent and ink pill buttons; a tonal amber ramp for charts instead of a rainbow; system UI text with Cormorant Garamond for display and italic emphasis; filled form fields with custom selects and toggles.
- **WebGL hero:** an original shader of a soft champagne horizon that follows the pointer, with a few slow drifting petals. Two tiny shader programs, no library. It pauses off-screen and in hidden tabs, draws one still frame for reduced-motion users, and falls back to a CSS gradient without WebGL.
- **Motion with purpose:** a masked headline reveal, a statement that lights up word by word as you scroll, a pinned "How it works" story where a plan card assembles itself, photos that settle as they scroll in, panel cross-fades, and rings and charts that draw in.
- **Dashboard:** a sidebar (vertical tabs on desktop, a strip on phones), a live countdown, KPI tiles with progress rings, a budget donut, "Up next" tasks with status pills, a moodboard, the run sheet, and a month-axis Gantt. All charts are hand-built SVG with text alternatives.
- **Still accessible:** decorative layers are `aria-hidden`, content stays visible without JavaScript, motion respects `prefers-reduced-motion`, and `forced-colors` is supported.

## Built for the evaluation criteria

| Criterion             | What we did                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Code quality**      | Small single-purpose modules (no file over ~300 lines; one module per dashboard tab, the AI layer split into schemas, prompts, sanitising and fallback). Shared data shapes in `types/plan.d.ts`, checked by TypeScript in **strict** mode over JSDoc. ESLint (with complexity, depth and size limits) and Prettier with zero warnings. GitHub Actions CI runs every gate on Node 20, 22 and 24. Dependency injection for the AI client, fetch, clock and logger                                                                                                                                |
| **Security**          | Strict CSP (`script-src 'self'`, no inline code), HSTS, X-Frame-Options, nosniff, COOP/CORP, Permissions-Policy. Cross-site POSTs rejected via Fetch Metadata and Origin checks. 16 KB body cap and content-type check. Allow-list validation with prototype-safe enum checks; control and bidi characters stripped. Rate limits (12/min AI, 240/min general). API key server-side only, sent in a header. No stack traces leak. Static files served only from a preloaded allow-list. Zero runtime dependencies, `npm audit` clean in CI. Non-root Docker user. See [SECURITY.md](SECURITY.md) |
| **Efficiency**        | Zero runtime dependencies. Assets loaded once and pre-compressed with Brotli and gzip. ETag/304 support, long-cached fonts and photos. LRU+TTL cache with in-flight de-duplication, so duplicate plans cost one model call. Bounded rate-limiter memory. Compact prompts. WebGL paused off-screen                                                                                                                                                                                                                                                                                               |
| **Testing**           | 137 tests with Node's built-in runner and **100% line coverage**: unit tests for every engine, validator, prompt, sanitiser and helper; Gemini client tests with a fake fetch; HTTP integration tests (headers, compression, 304, traversal, CSRF, 400/403/405/413/415/429, error hiding); rendering tests for every dashboard view, the charts and keyboard-driven tabs using a tiny dependency-free fake DOM; tests that keep the HTML in sync with server enums                                                                                                                              |
| **Accessibility**     | Skip link, landmarks, every control labelled, fieldsets and legends. An error summary that takes focus and links to each invalid field, plus `aria-invalid`. WAI-ARIA tabs with arrow, Home and End keys and orientation that follows the layout. Live regions for status and chat. Charts with text alternatives. 44 px touch targets. Visible focus rings. Dark mode, `prefers-reduced-motion`, `prefers-contrast` and `forced-colors`. `lang` and `dir` on AI text. Print stylesheet                                                                                                         |
| **Problem alignment** | Weddings, engagements, birthdays, anniversaries, baby showers, housewarmings, community events and festivals. Budgets, timelines, vendor checklists and personalised ideas, exactly as the brief asks                                                                                                                                                                                                                                                                                                                                                                                           |

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

## Run locally

Requires Node.js 20.12 or newer. The app has no runtime dependencies; `npm install` only adds the development tools (ESLint, Prettier, TypeScript).

```bash
cp .env.example .env      # add your GEMINI_API_KEY (free at https://aistudio.google.com/apikey)
npm run dev               # http://localhost:8080
npm test                  # run the test suite
npm run test:coverage     # with coverage report
npm run verify            # lint + format check + strict typecheck + tests (what CI runs)
```

## Deploy

**Render (free tier):** `render.yaml` is a ready Blueprint. In the Render dashboard choose _New → Blueprint_, pick this repository and enter `GEMINI_API_KEY` when prompted. Every push to `main` redeploys.

**Google Cloud Run**

```bash
gcloud run deploy utsav-ai --source . --region asia-south1 --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=YOUR_KEY
```

For production, store the key in Secret Manager and use `--set-secrets GEMINI_API_KEY=gemini-key:latest`.

**Any container host** (Railway, Fly.io): build the included `Dockerfile` and set `GEMINI_API_KEY`. The container listens on `$PORT` (default 8080), sets `TRUST_PROXY=1` and shuts down cleanly on SIGTERM.

## Project structure

```
server.js                 entry point and graceful shutdown
src/
  app.js, http.js         routing table, request handling, CSRF check
  security.js             security headers and rate limiting
  validation.js, text.js  input validation and text hygiene
  planner/                budget.js · timeline.js · vendors.js (deterministic engine)
  ai/                     schemas.js · prompts.js · sanitise.js · fallback.js
  gemini.js, service.js   Gemini client with model fallback; orchestration and caching
  static.js               in-memory, pre-compressed static assets
public/
  index.html, *.css       landing page and dashboard
  js/                     main.js (bootstrap) · form.js · dashboard.js · assistant.js · actions.js
  js/views/               one module per dashboard tab, plus shared ui.js
types/plan.d.ts           shared data shapes, checked by `npm run typecheck`
test/                     node:test suites and a tiny fake DOM for view tests
docs/media/               README screenshots and GIFs (not served, not in the image)
.github/workflows/ci.yml  lint, format, strict types, tests and audit on Node 20/22/24
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions and [SECURITY.md](SECURITY.md) for the security model.

## Credits and license

Photography from [Unsplash](https://unsplash.com) and fonts from Google Fonts. See [CREDITS.md](CREDITS.md). Code released under the MIT License.

<div align="center"><sub>Made with care for PromptWars Virtual · Powered by Google Gemini</sub></div>
