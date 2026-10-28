# Contributing

## Setup

Requires Node.js 20.12 or newer.

```bash
npm install            # development tools only; the app has no runtime dependencies
cp .env.example .env   # add GEMINI_API_KEY to use the AI features
npm run dev            # http://localhost:8080
```

## Quality gates

Every change must pass `npm run verify`, which CI also runs on Node 20, 22 and 24:

| Script                 | Checks                                                                          |
| ---------------------- | ------------------------------------------------------------------------------- |
| `npm run lint`         | ESLint recommended rules plus complexity, depth, parameter and file-size limits |
| `npm run format:check` | Prettier formatting (`npm run format` fixes it)                                 |
| `npm run typecheck`    | TypeScript in strict mode over the JSDoc-typed JavaScript                       |
| `npm test`             | Node's built-in test runner; `npm run test:coverage` adds a coverage report     |

## Conventions

- **Engine first, AI second.** Money, dates and vendor lists come from the deterministic planner in `src/planner/`. The model only adds ideas, and everything it returns is validated in `src/ai/sanitise.js`.
- **Shared types.** Data shapes live in `types/plan.d.ts` and are referenced from JSDoc, so server and browser code agree on the plan structure.
- **Small modules.** One responsibility per file; each dashboard tab has its own module in `public/js/views/`.
- **Safe DOM.** Build elements with `h()` from `public/js/dom.js`, which only sets text through `textContent`.
- **Accessible by default.** Label every control, give charts a text alternative, keep keyboard support and respect `prefers-reduced-motion`.
- **Tests with every change.** View code is tested in Node with the small fake DOM in `test/fake-dom.js`.
