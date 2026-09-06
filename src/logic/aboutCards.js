import image from '../logic/imgMySkills'

const cards = {
    IA: [
        { img: image.ollama, title: 'Ollama' },
        { img: image.localInference, title: 'Local Inference' },
        { img: image.rag, title: 'RAG' },
        { img: image.pgvector, title: 'pgvector' },
        { img: image.claude, title: 'Anthropic API' },
        { img: image.chagpt, title: 'OpenAI API' },
        { img: image.aiSdk, title: 'Vercel AI SDK' },
        { img: image.mcp, title: 'MCP' },
        { img: image.agents, title: 'Agents & Subagents' },
        { img: image.evals, title: 'Evals' }
    ],
    frontEnd: [
        { img: image.javascript, title: 'JavaScript' },
        { img: image.typescript, title: 'TypeScript' },
        { img: image.PHP, title: 'PHP' },
        { img: image.react, title: 'React JS' },
        { img: image.reactNative, title: 'React Native' },
        { img: image.Nextjs, title: 'Next.js' },
        { img: image.vitejs, title: 'Vite.js' },
        { img: image.Gatsby, title: 'Gatsby JS' }
    ],
    shopify: [
        { img: image.liquid, title: 'Liquid' },
        { img: image.shopify, title: 'Shopify API' }
    ],
    wordpress: [
        { img: image.woocomerce, title: 'WordPress' },
        { img: image.elementor, title: 'Elementor' },
        { img: image.ACFPRO, title: 'ACF' },
        { img: image.jquery, title: 'JQuery' },
        { img: image.localWP, title: 'Local WP' }

    ],
    styling: [
        { img: image.css, title: 'CSS' },
        { img: image.tailwind, title: 'Tailwind' },
        { img: image.bootstrap, title: 'Bootstrap' },
        { img: image.sass, title: 'SASS' }
    ],
    backend: [
        { img: image.mysql, title: 'MySQL' },
        { img: image.postgress, title: 'PostgreSQL' },
        { img: image.supabase, title: 'Supabase' },
        { img: image.firebase, title: 'Firebase' },
        { img: image.cloud, title: 'Google Cloud' },
        { img: image.python, title: 'Python' },
        { img: image.node, title: 'Node.js' },
        { img: image.Expresssjs, title: 'Express.js' }
    ],
    tools: [
        { img: image.docker, title: 'Docker' },
        { img: image.githubActions, title: 'GitHub Actions' },
        { img: image.inngest, title: 'Inngest' },
        { img: image.playwright, title: 'Playwright' },
        { img: image.electron, title: 'Electron' },
        { img: image.npm, title: 'NPM' },
        { img: image.webpack, title: 'Webpack' },
        { img: image.babel, title: 'Babel' },
        { img: image.redux, title: 'Redux' },
        { img: image.json, title: 'JSON' },
        { img: image.restApi, title: 'Rest API' },
        { img: image.github, title: 'GitHub' },
        { img: image.es6, title: 'ES6+' }
    ],
    others: [
        { img: image.vstudio, title: 'Visual Studio Code' },
        { img: image.figma, title: 'Figma' },
        { img: image.photoshop, title: 'Photoshop' },
        { img: image.illustrator, title: 'Illustrator' },
        { img: image.clickup, title: 'ClickUp' },
        { img: image.slack, title: 'Slack' },
        { img: image.zoom, title: 'Zoom' },
        { img: image.hubspot, title: 'HubSpot' }
    ],
    seo: [
        { img: image.ads, title: 'Google Ads' },
        { img: image.analytics, title: 'Google Analytics' },
        { img: image.searchConsole, title: 'Google Search Console' },
        { img: image.pagespeed, title: 'Google PageSpeed Insights' },
        { img: image.semrush, title: 'SemRush' }
    ]
};

export default cards
