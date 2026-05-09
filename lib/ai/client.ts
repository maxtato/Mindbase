import OpenAI from "openai";

// Centralised OpenAI client. Server-side only — never import from a "use client" file.

let cached: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY manquant : ajoute la clé dans .env.local et relance le serveur de dev.",
    );
  }
  cached = new OpenAI({ apiKey });
  return cached;
}

export const AI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
