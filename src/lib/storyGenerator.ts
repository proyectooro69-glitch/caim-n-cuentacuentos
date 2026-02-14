import { supabase } from "../integrations/supabase/client";

// Priorizamos la variable de entorno de Netlify para seguridad
const API_KEY_ENV = import.meta.env.VITE_GEMINI_API_KEY;

// Llave de respaldo (la nueva que generaste)
const FALLBACK_KEY = "AIzaSyAM30mJ_heYlniYwoLR2McqfzjekM7cWcY";

const GEMINI_API_KEY = API_KEY_ENV || FALLBACK_KEY;

// Usamos el modelo 1.5-flash: es más barato, rápido y estable para cuentas nuevas
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

interface StoryPage {
  pageNumber: number;
  text: string;
  imagePrompt: string;
}

interface ParsedStory {
  title: string;
  pages: StoryPage[];
}

interface GeneratedStory {
  id: string;
  title: string;
  shareCode: string;
  coverImageUrl: string | null;
}

function buildPollinationsUrl(prompt: string, width = 768, height = 768): string {
  const encoded = encodeURIComponent(prompt);
  // Añadimos un seed aleatorio para que las imágenes siempre sean diferentes
  const seed = Math.floor(Math.random() * 1000000);
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=flux&nologo=true&seed=${seed}`;
}

async function callGemini(body: object): Promise<any> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    if (res.status === 429) {
      throw new Error("Límite de mensajes alcanzado. Por favor, espera un momento.");
    }
    throw new Error(`Error de comunicación con la IA (${res.status}).`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("La IA no devolvió una respuesta válida.");
  return text;
}

async function translateToEnglish(text: string): Promise<string> {
  try {
    const result = await callGemini({
      contents: [{ role: "user", parts: [{ text: `Translate the following description to English for an image generator. Return ONLY the translation:\n\n${text}` }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
    });
    return result.trim();
  } catch {
    return text; // Si falla la traducción, enviamos el texto original
  }
}

async function generateStoryText(theme: string, lang: "es" | "en"): Promise<ParsedStory> {
  const isEn = lang === "en";

  const prompt = `You are a professional children's book author. Write a creative, engaging 5-page story about: ${theme}.
  
  IMPORTANT: You must respond ONLY with a valid JSON object. Do not include markdown or explanations.
  
  Language of the story text: ${isEn ? 'English' : 'Spanish'}.
  Language of the imagePrompt: Always English.

  JSON Structure:
  {
    "title": "Story Title",
    "pages": [
      { "pageNumber": 1, "text": "2-3 simple sentences for children", "imagePrompt": "A detailed scene description in English for a coloring book" }
    ]
  }`;

  const content = await callGemini({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 2500 },
  });

  // Limpiamos posibles formatos de markdown que Gemini
