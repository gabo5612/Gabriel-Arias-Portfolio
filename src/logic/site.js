// The one place the public origin lives. Both the llms.txt link and the "Ask
// ChatGPT" prompts have to be absolute — ChatGPT cannot fetch a relative URL —
// so moving to a custom domain is a one-line change here.
export const SITE_URL = "https://gabriel-arias-portfolio.vercel.app";
export const LLMS_TXT = `${SITE_URL}/llms.txt`;

// ChatGPT prefills and submits whatever arrives in ?q=. The prompt names the
// file and the exact heading on purpose: half of these titles are ordinary
// words (crew, Squish, Typeit), and without pinning the source the model
// answers about the word instead of the project.
export function askChatGptUrl(title) {
  const q =
    `Read ${LLMS_TXT} and tell me what "${title}" is and what it does. ` +
    `Use only the "### ${title}" section of that file — if you cannot fetch it, say so instead of guessing.`;
  return `https://chatgpt.com/?q=${encodeURIComponent(q)}`;
}
