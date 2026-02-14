import { supabase } from "@/integrations/supabase/client";

// Buscamos la llave en las variables de entorno de Netlify (Vite)
// Si no existe, usamos la llave manual como respaldo
const API_KEY_ENV = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_KEY = API_KEY_ENV || "AIzaSyCjpu1GvxVyrbWT1Q5hZnLf4VA6vwPVUfk";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

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
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=flux&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
}

async function callGemini(body: object): Promise<any> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Cuota de Gemini agotada. Espera 1 minuto e intenta de nuevo.");
    }
    throw new Error(`Error de Gemini (${res.status}). Intenta de nuevo.`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini no devolvió contenido.");
  return text;
}

async function translateToEnglish(text: string): Promise<string> {
  try {
    const result = await callGemini({
      contents: [{ role: "user", parts: [{ text: `Translate to English. Return ONLY the translation:\n\n${text}` }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
    });
    return result.trim();
  } catch {
    return text;
  }
}

async function generateStoryText(theme: string, lang: "es" | "en"): Promise<ParsedStory> {
  const isEn = lang === "en";

  const prompt = isEn
    ? `You are a children's story writer. Create a 5-page story about: ${theme}

IMPORTANT: Respond ONLY with valid JSON, no markdown.
Format:
{
  "title": "Story title",
  "pages": [
    { "pageNumber": 1, "text": "2-3 simple sentences", "imagePrompt": "Scene description in English for coloring book" }
  ]
}`
    : `Eres un escritor de cuentos infantiles. Crea un cuento de 5 páginas sobre: ${theme}

IMPORTANTE: Responde ÚNICAMENTE con JSON válido, sin markdown.
Formato:
{
  "title": "Título",
  "pages": [
    { "pageNumber": 1, "text": "2-3 oraciones simples", "imagePrompt": "Descripción EN INGLÉS para libro de colorear" }
  ]
}`;

  const content = await callGemini({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 4096 },
  });

  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(isEn ? "Failed to parse story JSON" : "Error al procesar el cuento");
  }
}

export async function generateStory(
  theme: string,
  lang: "es" | "en",
  onProgress?: (msg: string) => void
): Promise<GeneratedStory> {
  const isEn = lang === "en";

  onProgress?.(isEn ? "Writing the story..." : "Escribiendo la historia...");
  const story = await generateStoryText(theme, lang);

  onProgress?.(isEn ? "Creating the cover..." : "Creando la portada...");
  const coverPromptEn = await translateToEnglish(
    `Vibrant colorful children's book cover, cute character, pastel tones, no text. Scene: ${story.pages[0].imagePrompt}`
  );
  const coverImageUrl = buildPollinationsUrl(coverPromptEn, 768, 1024);

  onProgress?.(isEn ? "Saving..." : "Guardando...");
  const { data: storyRecord, error: storyError } = await supabase
    .from("stories")
    .insert({ theme, title: story.title, cover_image_url: coverImageUrl } as any)
    .select()
    .single();

  if (storyError) throw new Error(isEn ? "Failed to save story" : "No se pudo guardar el cuento");

  onProgress?.(isEn ? "Preparing pages..." : "Preparando páginas...");
  const pageRows = await Promise.all(
    story.pages.map(async (page) => {
      const bwPromptEn = await translateToEnglish(
        `Black and white coloring book, line art, thick outlines, white background, no text. Scene: ${page.imagePrompt}`
      );
      return {
        story_id: storyRecord.id,
        page_number: page.pageNumber,
        narrative_text: page.text,
        image_url: buildPollinationsUrl(bwPromptEn, 1024, 1024),
      };
    })
  );

  const { error: pagesError } = await supabase.from("story_pages").insert(pageRows);
  if (pagesError) throw new Error(isEn ? "Failed to save pages" : "No se pudieron guardar las páginas");

  return {
    id: storyRecord.id,
    title: story.title,
    shareCode: storyRecord.share_code,
    coverImageUrl,
  };
}
