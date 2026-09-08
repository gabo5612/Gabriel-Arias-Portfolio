import images from "./imgPortoflio";

// `arch` is the slug of this project's architecture map, served from
// static/architecture/<arch>.html and also checked into the project's own repo at
// docs/architecture.html. scripts/verify-architecture.mjs fails the build when a card
// names a map that is not there — same reasoning as the llms.txt gate: the button would
// still render and lead nowhere. `archNote` is the one line the Architecture section
// shows under the project's name.

const porfolioCards = [
  // The one paid offer in this grid, so it carries `kind: "service"` and the
  // grid renders it as such. `link`/`demo` point at the Vercel project's new
  // name — dead until the project is renamed in the Vercel dashboard, see
  // GaboAuditmyweb/PENDIENTES.md.
  {
    img: images.gaboAuditMyWeb,
    kind: "service",
    title: "GaboAuditmyweb",
    arch: "gaboauditmyweb",
    archNote:
      "The marketing site and the audit engine behind it, as the two separate halves they are.",
    description:
      "Two 30-day sprints for Shopify stores, page speed and technical SEO, sold separately. I don't bundle them: one month isn't enough to do both properly, and selling both would mean shortchanging one. Each starts with a free audit from an engine I wrote — PageSpeed and CrUX collectors, 22 technical checks, 129 tests, no npm dependencies. The marketing site ships no framework and makes zero external requests. Fonts are subset and self-hosted, and the build refuses to deploy if minification changed what the page actually says.",
    link: "https://gaboauditmyweb.vercel.app",
    demo: "https://gaboauditmyweb.vercel.app",
    github: "https://github.com/gabo5612/GaboAuditmyweb",
    tags: ["Shopify", "Core Web Vitals", "Technical SEO", "Node.js", "PageSpeed API"],
  },
  // The flagship pair, in the order they were built: the harness first, then the
  // system it measures. `demo` points at a static deployment of each — the real
  // ones need a local model, a plant network or a database, so what is published
  // is the deterministic half plus the recorded output.
  {
    img: images.shopfloor,
    title: "shopfloor",
    arch: "shopfloor",
    archNote:
      "The query rail, the ingestion lane, and the two gates a figure has to pass.",
    description:
      "An assistant for the documentation a plant actually runs on: equipment manuals of several thousand pages, welding procedures, SOPs, spare-part catalogues. It lives inside the plant and never touches the internet. Postgres with pgvector, bge-m3 embeddings, a local model. Before a figure reaches an operator, a verifier checks it against the page it claims to come from, and every answer carries document, revision and page. When the manuals don't cover the question, it says so instead of improvising. groundcheck measures all of this against a 39-question golden set, and the repo publishes what it found — including the answer it pulled from the neighbouring row of a parts table.",
    link: "https://shopfloor-demo.vercel.app",
    demo: "https://shopfloor-demo.vercel.app",
    demoLabel: "Live Demo",
    github: "https://github.com/gabo5612/shopfloor",
    tags: ["Python", "FastAPI", "pgvector", "Local LLMs", "RAG", "Docling"],
  },
  {
    img: images.groundcheck,
    title: "groundcheck",
    arch: "groundcheck",
    archNote:
      "Observations stored first, judgement applied later, the build gated last.",
    description:
      "I built this one first, on purpose: shopfloor needed something to be measured against before it existed. It scores retrieval the usual way (recall@k, MRR, precision@k), then checks what most evals leave out. Is every number in the answer really in the chunk it cites? Does the citation point at the right page and revision, or at a superseded one? Does the system stay quiet when the corpus has no answer — which is why 23% of the golden set is negative controls, since a system that always answers confidently would otherwise score perfectly. No model grades another model here; every check is a program. 179 tests, one runtime dependency, and CI fails the build when a score drops.",
    link: "https://groundcheck-demo.vercel.app",
    demo: "https://groundcheck-demo.vercel.app",
    demoLabel: "Live Demo",
    github: "https://github.com/gabo5612/groundcheck",
    tags: ["Python", "Evals", "RAG", "CI gate", "CLI"],
  },
  {
    img: images.feedstock,
    title: "feedstock",
    arch: "feedstock",
    archNote:
      "Ten years of raw prices in; a unit cost and a measured signal out.",
    description:
      "Input-cost risk for a metals plant, running local-first. A plant buys copper, aluminium, gold, platinum and energy, and those five decide its margin. This ingests the raw prices — 12 instruments, 30,302 daily bars — normalises units, derives features and forecasts with a walk-forward backtest against a naive baseline. Nobody should read it as a trading bot. The only claim it makes is each model's out-of-sample error, measured and reproducible. The instrument registry now verifies display names against the source's own response, because one ticker I trusted turned out to be a 10-year Treasury note future instead of zinc, and nothing in the output would have told me.",
    link: "https://feedstock-demo.vercel.app",
    demo: "https://feedstock-demo.vercel.app",
    demoLabel: "Live Demo",
    github: "https://github.com/gabo5612/feedstock",
    tags: ["Python", "TimescaleDB", "Forecasting", "Backtesting", "React"],
  },
  {
    img: images.crew,
    title: "crew",
    arch: "crew",
    archNote:
      "Where the contract is written, where it gets typed, and what is allowed to accept it.",
    description:
      "A CLI that hands closed-contract coding tasks to local models (Ollama, or anything that speaks the OpenAI API) and then checks the result with typecheck, lint and tests. No model ever grades another model's output, so the retry loop costs nothing in paid tokens. Zero npm dependencies.",
    link: "https://github.com/gabo5612/crew",
    github: "https://github.com/gabo5612/crew",
    tags: ["Node.js", "Ollama", "Local LLMs", "CLI"],
  },
  {
    img: images.brandvoice,
    title: "BrandVoice",
    arch: "brandvoice",
    archNote:
      "Per-brand retrieval under row-level security, with the model call the only thing that leaves.",
    description:
      "Multi-tenant RAG editorial platform. Documents get parsed, chunked and embedded into pgvector halfvec(1536), with text-embedding-3-large asked for 1536 dimensions so that ingestion and retrieval agree on one schema. Let those two diverge and cosine distance quietly stops meaning anything. Most of the work was never the AI part: a server-side allowlist of the models the backend may call at all, nine-permission RBAC, an audit log, and a cost ledger per generation.",
    link: "https://brandvoice-demo.vercel.app",
    demo: "https://brandvoice-demo.vercel.app",
    demoLabel: "Live Demo",
    github: "https://github.com/gabo5612/brandvoice",
    tags: ["Next.js", "pgvector", "RAG", "Supabase", "Inngest"],
  },
  {
    img: images.trailKit,
    title: "TrailPlugin",
    arch: "trailplugin",
    archNote:
      "Why the licence state lives outside the plugin that ships to a customer.",
    description:
      "Commercial WordPress plugin for adventure routes, points of interest and guides, with interactive Leaflet maps and elevation profiles. Licence management lives in a separate Next.js and Supabase backend rather than inside the plugin.",
    link: "https://trailplugin.com",
    demo: "https://trailplugin.com",
    // The plugin is a commercial product, not a sandbox: "Live Demo" would promise
    // something to click through, and the site is the project itself.
    demoLabel: "View Project",
    github: "https://github.com/TrailPlugin/",
    tags: ["WordPress", "PHP", "Leaflet", "Next.js", "Supabase"],
  },
  {
    img: images.quicktask,
    title: "QuickTask 2.0",
    arch: "quicktask",
    archNote:
      "Every step of a pattern runs; the last one stops and waits for a person.",
    description:
      "Commercial Electron and Playwright app that automates repetitive browser work on the local machine. No AI, no external services, nothing leaves the device. The last step of a pattern is marked critical: the app runs everything up to it, then stops and waits for a person to approve. That step is usually the one that moves money.",
    link: "https://quicktaskpro.dev",
    tags: ["Electron", "Playwright", "SQLite", "Local-first"],
  },
  {
    img: images.squish,
    title: "Squish",
    arch: "squish",
    archNote:
      "The same guarantee built twice — browser worker pool, then native codecs.",
    description:
      "Local-first image and video compression, built twice. The web version has no backend at all: the File System Access API writes compressed files straight back to disk with the original subfolders intact, and decode, resize and encode run on a Web Worker pool sized to navigator.hardwareConcurrency. Safari and Firefox get an explanation instead of a broken interface.",
    link: "https://gabo5612.github.io/squish/",
    demo: "https://gabo5612.github.io/squish/",
    github: "https://github.com/gabo5612/squish",
    tags: ["Web Workers", "File System API", "Electron", "Sharp"],
  },
  {
    img: images.typeit,
    title: "Typeit",
    arch: "typeit",
    archNote:
      "One keystroke engine per platform, both scripted, nothing to compile.",
    description:
      "Electron app for macOS and Windows that types text at the operating-system level, for sites that block pasting. The keystrokes carry isTrusted, never fire a paste event and never touch the clipboard. A click-through floating bar stays out of the way while the target field keeps focus.",
    link: "https://github.com/gabo5612/Typeit",
    github: "https://github.com/gabo5612/Typeit",
    tags: ["Electron", "Node.js", "macOS", "Windows"],
  },
  {
    img: images.danielArias,
    title: "Daniel Arias Portfolio",
    arch: "daniel-arias",
    archNote:
      "Three languages sharing one component tree instead of three sites.",
    description:
      "Portfolio site I designed and built from scratch for someone else. React, Next.js, Framer Motion transitions, deployed on Vercel.",
    link: "https://daniel-arias-portfolio.vercel.app/",
    demo: "https://daniel-arias-portfolio.vercel.app/",
    github: "https://github.com/gabo5612/Daniel-Arias-Portfolio",
    tags: ["React", "Next.js", "Framer Motion", "Vercel"],
  },
];

export default porfolioCards;
