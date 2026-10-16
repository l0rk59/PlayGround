export type Provider = "openai" | "anthropic" | "gemini" | "openrouter" | "groq" | "custom";

export const PROVIDER_INFO: Record<Provider, { nom: string; url: string }> = {
  openai: { nom: "OpenAI", url: "https://api.openai.com/v1" },
  anthropic: { nom: "Anthropic (Claude)", url: "https://api.anthropic.com" },
  gemini: { nom: "Google Gemini", url: "https://generativelanguage.googleapis.com" },
  openrouter: { nom: "OpenRouter", url: "https://openrouter.ai/api/v1" },
  groq: { nom: "Groq", url: "https://api.groq.com/openai/v1" },
  custom: { nom: "Autre (compatible OpenAI)", url: "http://localhost:1234/v1" },
};
