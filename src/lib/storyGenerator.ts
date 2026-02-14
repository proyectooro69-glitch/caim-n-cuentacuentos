import { supabase } from "../integrations/supabase/client";

// Variables de entorno de Netlify
const API_KEY_ENV = import.meta.env.VITE_GEMINI_API_KEY;

// Tu nueva llave de pago como respaldo
const FALLBACK_KEY = "AIzaSyAM30mJ_heYlniYwoLR2McqfzjekM7cWcY";

const GEMINI_API_KEY = API_KEY_ENV || FALLBACK_KEY;

// Usamos el modelo 1.5-flash para mayor estabilidad con la cuenta de pago
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
      contents: [{ role: "user", parts: [{ text: `Translate to English ONLY the description:\n\n${text}` }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
    });
    return result.trim();
  } catch {
    return text;
  }
}

async function generateStoryText(theme: string, lang: "es" | "en"): Promise<ParsedStory> {
  const isEn = lang === "en";
  const prompt = `Write a 5-page children's story about: ${theme}. 
  Return ONLY a JSON object. Language: ${isEn ? 'English' : 'Spanish'}.
  Format: {"title": "Title", "pages": [{"pageNumber": 1, "text": "text", "imagePrompt": "description in English"}]}`;

  const content = await callGemini({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 2500 },
  });

  const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function generateStory(
  theme: string,
  lang: "es" | "en",
  onProgress?: (msg: string) => void
): Promise<GeneratedStory> {
  const isEn = lang === "en";

  onProgress?.(isEn ? "Imagining..." : "Imaginando...");
  const story = await generateStoryText(theme, lang);

  onProgress?.(isEn ? "Creating cover..." : "Creando portada...");
  const coverImageUrl = buildPollinationsUrl(`Children's book cover, Pixar style: ${story.pages[0].imagePrompt}`, 768, 1024);

  const { data: storyRecord, error: storyError } = await supabase
    .from("stories")
    .insert({ theme, title: story.title, cover_image_url: coverImageUrl } as any)
    .select()
    .single();

  if (storyError) throw new Error("Error con la base de datos.");

  onProgress?.(isEn ? "Drawing pages..." : "Dibujando páginas...");
  
  const pageRows = await Promise.all(
    story.pages.map(async (page) => {
      const bwPromptEn = `Coloring book page, black and white, thick lines: ${page.imagePrompt}`;
      return {
        story_id: storyRecord.id,
        page_number: page.pageNumber,
        narrative_text: page.text,
        image_url: buildPollinationsUrl(bwPromptEn, 1024, 1024),
      };
    })
  );

  await supabase.from("story_pages").insert(pageRows);

  return {
    id: storyRecord.id,
    title: story.title,
    shareCode: storyRecord.share_code,
    coverImageUrl,
  };
}
