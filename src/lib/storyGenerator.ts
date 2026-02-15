import { supabase } from "../integrations/supabase/client";

// API Key directa
const GEMINI_API_KEY = "AIzaSyCjpu1GvxVyrbWT1Q5hZnLf4VA6vwPVUfk";

// Endpoint correcto: v1 (no v1beta) + gemini-1.5-flash
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function generateStory(theme: string, lang: "es" | "en", onProgress?: (m: string) => void) {
  onProgress?.(lang === "en" ? "Creating..." : "Creando cuento...");

  const prompt = `Escribe un cuento infantil de 5 páginas sobre ${theme}. Responde ÚNICAMENTE con este formato JSON: {"title": "Título", "pages": [{"pageNumber": 1, "text": "texto", "imagePrompt": "escena en inglés"}]}`;

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2500 }
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error("Gemini API error:", res.status, errBody);
    throw new Error(`Error de Google (${res.status}): ${errBody?.error?.message || "Sin detalles"}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const story = JSON.parse(rawText.replace(/```json/g, "").replace(/```/g, "").trim());

  // Guardamos en Supabase
  const { data: storyRecord, error: dbError } = await supabase
    .from("stories")
    .insert({ 
      theme, 
      title: story.title, 
      cover_image_url: `https://image.pollinations.ai/prompt/${encodeURIComponent(story.pages[0].imagePrompt)}?width=768&height=1024&model=flux` 
    } as any)
    .select().single();

  if (dbError) throw new Error("Error al guardar en base de datos");

  const pageRows = story.pages.map((p: any) => ({
    story_id: storyRecord.id,
    page_number: p.pageNumber,
    narrative_text: p.text,
    image_url: `https://image.pollinations.ai/prompt/${encodeURIComponent(p.imagePrompt + " coloring book style")}?width=1024&height=1024&model=flux`
  }));

  await supabase.from("story_pages").insert(pageRows);
  return { id: storyRecord.id, title: story.title, shareCode: storyRecord.share_code };
}
