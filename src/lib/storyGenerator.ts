import { supabase } from "../integrations/supabase/client";

// Usamos la llave que configuraste en Netlify
const API_KEY_ENV = import.meta.env.VITE_GEMINI_API_KEY;
// Tu nueva llave de pago como respaldo
const FALLBACK_KEY = "AIzaSyAM30mJ_heYlniYwoLR2McqfzjekM7cWcY";
const GEMINI_API_KEY = API_KEY_ENV || FALLBACK_KEY;

// URL CORREGIDA: Usamos v1beta y gemini-1.5-flash
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

interface ParsedStory {
  title: string;
  pages: { pageNumber: number; text: string; imagePrompt: string; }[];
}

async function callGemini(body: object): Promise<string> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Error IA (${res.status})`);

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Sin respuesta de IA");
  return text;
}

export async function generateStory(theme: string, lang: "es" | "en", onProgress?: (m: string) => void) {
  onProgress?.("Escribiendo cuento...");
  
  const prompt = `Escribe un cuento infantil de 5 páginas sobre ${theme}. Responde solo JSON: {"title": "Título", "pages": [{"pageNumber": 1, "text": "texto", "imagePrompt": "dibujo en inglés"}]}`;

  const content = await callGemini({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
  });

  const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
  const story: ParsedStory = JSON.parse(cleaned);

  const { data: storyRecord } = await supabase
    .from("stories")
    .insert({ theme, title: story.title, cover_image_url: `https://image.pollinations.ai/prompt/${encodeURIComponent(story.pages[0].imagePrompt)}?width=768&height=1024&model=flux&seed=${Math.random()}` } as any)
    .select().single();

  const pageRows = story.pages.map(p => ({
    story_id: storyRecord.id,
    page_number: p.pageNumber,
    narrative_text: p.text,
    image_url: `https://image.pollinations.ai/prompt/${encodeURIComponent(p.imagePrompt + " coloring book style")}?width=1024&height=1024&model=flux&seed=${Math.random()}`
  }));

  await supabase.from("story_pages").insert(pageRows);
  return { id: storyRecord.id, shareCode: storyRecord.share_code };
}
