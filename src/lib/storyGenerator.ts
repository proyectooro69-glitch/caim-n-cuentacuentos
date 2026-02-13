import { supabase } from "@/integrations/supabase/client";

const GEMINI_API_KEY = "AIzaSyCjpu1GvxVyrbWT1Q5hZnLf4VA6vwPVUfk";

const GEMINI_MODELS = [
  "gemini-1.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
];

function geminiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
}

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

/**
 * Translates a prompt to English using Gemini (for Pollinations which works best in English)
 */
async function fetchGemini(body: object): Promise<Response> {
  for (const model of GEMINI_MODELS) {
    const res = await fetch(geminiUrl(model), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 404) continue; // model not available, try next
    if (res.status === 429) continue; // quota exhausted, try next model
    return res;
  }
  // All models failed — return a synthetic 429
  return new Response(JSON.stringify({ error: { code: 429, message: "All models quota exhausted" } }), { status: 429 });
}

async function translateToEnglish(text: string): Promise<string> {
  try {
    const res = await fetchGemini({
      contents: [{ role: "user", parts: [{ text: `Translate the following text to English. Return ONLY the translation, nothing else:\n\n${text}` }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
    });
    if (!res.ok) return text;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
  } catch {
    return text;
  }
}

/**
 * Build a Pollinations.ai image URL from a prompt
 */
function buildPollinationsUrl(prompt: string, width = 768, height = 768): string {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=flux&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
}

/**
 * Generate story text via Google Gemini API (free tier)
 */
async function generateStoryText(theme: string, lang: "es" | "en"): Promise<ParsedStory> {
  const isEnglish = lang === "en";

  const systemPrompt = isEnglish
    ? `You are a children's story writer in English. Create short, magical stories appropriate for children ages 3-8.

IMPORTANT: Respond ONLY with a valid JSON object, no markdown or extra text.

Format:
{
  "title": "Story title",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Narrative text (2-3 simple sentences)",
      "imagePrompt": "Detailed description for a coloring book image in English"
    }
  ]
}

Each page must have:
- Short narrative text easy to read aloud
- An image description in English showing the main scene with thick, simple lines, no complicated backgrounds`
    : `Eres un escritor de cuentos infantiles en español. Crea cuentos cortos, mágicos y apropiados para niños de 3-8 años. 

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional.

El formato debe ser exactamente:
{
  "title": "Título del cuento",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Texto narrativo de la página (2-3 oraciones simples)",
      "imagePrompt": "Descripción detallada EN INGLÉS para generar una imagen de libro para colorear"
    }
  ]
}

Cada página debe tener:
- Un texto narrativo corto y fácil de leer en voz alta
- Una descripción de imagen EN INGLÉS que muestre la escena principal con líneas gruesas y simples, sin fondos complicados`;

  const userPrompt = isEnglish
    ? `Create a 5-page story about: ${theme}`
    : `Crea un cuento de 5 páginas sobre: ${theme}`;

  const res = await fetchGemini({
    contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 4096 },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    if (res.status === 429) {
      throw new Error(
        isEnglish
          ? "Gemini API quota exceeded. Please wait a minute and try again."
          : "Cuota de la API de Gemini agotada. Espera un minuto e intenta de nuevo."
      );
    }
    console.error("Gemini API error:", errorData);
    throw new Error(
      isEnglish
        ? "Failed to generate story. Please try again."
        : "No se pudo generar el cuento. Intenta de nuevo."
    );
  }

  const data = await res.json();
  let content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error(isEnglish ? "No content returned from AI" : "La IA no devolvió contenido");
  }

  content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return JSON.parse(content);
  } catch {
    console.error("Failed to parse story JSON:", content);
    throw new Error(isEnglish ? "Failed to parse story" : "Error al procesar el cuento");
  }
}

/**
 * Full story generation pipeline — runs entirely on the client
 */
export async function generateStory(
  theme: string,
  lang: "es" | "en",
  onProgress?: (msg: string) => void
): Promise<GeneratedStory> {
  const isEnglish = lang === "en";

  // 1. Generate story text
  onProgress?.(isEnglish ? "Writing the story..." : "Escribiendo la historia...");
  const story = await generateStoryText(theme, lang);

  // 2. Build cover image URL (colorful)
  onProgress?.(isEnglish ? "Creating the cover..." : "Creando la portada...");
  const coverPromptEn = await translateToEnglish(
    `Vibrant colorful children's book cover illustration for ages 3-7, cute expressive main character, soft pastel and bright cheerful tones, professional children's book style, friendly inviting atmosphere, no text or words, soft gradients warm lighting. Scene: ${story.pages[0].imagePrompt}`
  );
  const coverImageUrl = buildPollinationsUrl(coverPromptEn, 768, 1024);

  // 3. Save story to database
  onProgress?.(isEnglish ? "Saving the story..." : "Guardando el cuento...");
  const { data: storyRecord, error: storyError } = await supabase
    .from("stories")
    .insert({ theme, title: story.title, cover_image_url: coverImageUrl } as any)
    .select()
    .single();

  if (storyError) {
    console.error("Story insert error:", storyError);
    throw new Error(isEnglish ? "Failed to save story" : "No se pudo guardar el cuento");
  }

  // 4. Build page image URLs (B&W coloring) and save pages
  onProgress?.(isEnglish ? "Preparing coloring pages..." : "Preparando páginas para colorear...");
  const pageRows = await Promise.all(
    story.pages.map(async (page) => {
      const bwPromptEn = await translateToEnglish(
        `Simple black and white coloring book illustration for children, pure line art, thick clean outlines, no shading no gradients, white background, child-friendly cute style, no text or words. Scene: ${page.imagePrompt}`
      );
      const imageUrl = buildPollinationsUrl(bwPromptEn, 1024, 1024);

      return {
        story_id: storyRecord.id,
        page_number: page.pageNumber,
        narrative_text: page.text,
        image_url: imageUrl,
      };
    })
  );

  const { error: pagesError } = await supabase.from("story_pages").insert(pageRows);
  if (pagesError) {
    console.error("Pages insert error:", pagesError);
    throw new Error(isEnglish ? "Failed to save pages" : "No se pudieron guardar las páginas");
  }

  return {
    id: storyRecord.id,
    title: story.title,
    shareCode: storyRecord.share_code,
    coverImageUrl,
  };
}
