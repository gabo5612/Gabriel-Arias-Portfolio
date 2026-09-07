import images from "./imgPortoflio";

const porfolioCards = [
  // The one paid offer in this grid, so it carries `kind: "service"` and the
  // grid renders it as such. `link`/`demo` point at the Vercel project's new
  // name — dead until the project is renamed in the Vercel dashboard, see
  // GaboAuditmyweb/PENDIENTES.md.
  {
    img: images.gaboAuditMyWeb,
    kind: "service",
    title: "GaboAuditmyweb",
    description:
      "Two 30-day sprints for Shopify stores, sold separately: page speed, and technical SEO. Both start with a free audit produced by an engine I wrote — PageSpeed and CrUX collectors plus 22 technical checks, 129 tests, no dependencies. The site itself ships no framework and makes zero external requests: the fonts are subset and self-hosted, and a build-time check refuses to deploy if the minified output stops matching the source.",
    link: "https://gaboauditmyweb.vercel.app",
    demo: "https://gaboauditmyweb.vercel.app",
    github: "https://github.com/gabo5612/GaboAuditmyweb",
    tags: ["Shopify", "Core Web Vitals", "Technical SEO", "Node.js", "PageSpeed API"],
  },
  {
    img: images.crew,
    title: "crew",
    description:
      "CLI that dispatches closed-contract coding tasks to local models — Ollama, or any OpenAI-compatible endpoint — and verifies the result deterministically with typecheck, lint and tests. No model ever judges another, so the retry loop costs zero paid tokens.",
    link: "https://github.com/gabo5612/crew",
    github: "https://github.com/gabo5612/crew",
    tags: ["Node.js", "Ollama", "Local LLMs", "CLI"],
  },
  {
    img: images.brandvoice,
    title: "BrandVoice",
    description:
      "Multi-tenant RAG editorial platform. Documents are parsed, chunked and embedded in batches of 100 into pgvector halfvec(1536) — text-embedding-3-large requested at 1536 dimensions so ingestion and retrieval share one schema — then a five-step Inngest pipeline runs behind a server-side model allowlist, nine-permission RBAC, an audit log and a per-generation cost ledger.",
    link: "https://github.com/gabo5612/brandvoice",
    github: "https://github.com/gabo5612/brandvoice",
    tags: ["Next.js", "pgvector", "RAG", "Supabase", "Inngest"],
  },
  {
    img: images.trailKit,
    title: "TrailPlugin",
    description:
      "Commercial WordPress plugin for adventure routes, POIs and guides, with interactive Leaflet maps and elevation profiles. Licence management runs on a separate Next.js and Supabase backend.",
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
    description:
      "Commercial Electron and Playwright app that automates repetitive browser workflows entirely on the local machine — no AI, no external services, nothing leaves the device. The critical step sits behind a manual confirmation lock: it runs everything up to that point, then waits for a human to approve.",
    link: "https://quicktaskpro.dev",
    tags: ["Electron", "Playwright", "SQLite", "Local-first"],
  },
  {
    img: images.squish,
    title: "Squish",
    description:
      "Local-first image and video compression in two implementations. The web build has no backend at all: the File System Access API writes compressed files straight back to disk preserving subfolders, while decode, resize and encode run across a Web Worker pool sized to navigator.hardwareConcurrency.",
    link: "https://gabo5612.github.io/squish/",
    demo: "https://gabo5612.github.io/squish/",
    github: "https://github.com/gabo5612/squish",
    tags: ["Web Workers", "File System API", "Electron", "Sharp"],
  },
  {
    img: images.typeit,
    title: "Typeit",
    description:
      "Electron app for macOS and Windows that types text at the operating-system level for sites that block pasting — the keystrokes carry isTrusted, never fire a paste event and never touch the clipboard. A click-through floating bar keeps focus on the target field while it types.",
    link: "https://github.com/gabo5612/Typeit",
    github: "https://github.com/gabo5612/Typeit",
    tags: ["Electron", "Node.js", "macOS", "Windows"],
  },
  {
    img: images.danielArias,
    title: "Daniel Arias Portfolio",
    description:
      "Personal portfolio site designed and built from scratch. React and Next.js with Framer Motion transitions, deployed on Vercel.",
    link: "https://daniel-arias-portfolio.vercel.app/",
    demo: "https://daniel-arias-portfolio.vercel.app/",
    github: "https://github.com/gabo5612/Daniel-Arias-Portfolio",
    tags: ["React", "Next.js", "Framer Motion", "Vercel"],
  },
];

export default porfolioCards;
