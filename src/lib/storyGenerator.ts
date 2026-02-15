import { supabase } from "../integrations/supabase/client";

// API Key directa
const GEMINI_API_KEY = "AIzaSyCjpu1GvxVyrbWT1Q5hZnLf4VA6vwPVUfk";

// CORRECCIÓN: Usamos v1beta y aseguramos el nombre del modelo
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function generateStory(theme: string, lang: "es" | "en", onProgress?: (m: string) => void) {
  onProgress?.(lang === "en" ? "Creating magic..." : "Creando cuento mágico...");

  const prompt = `Actúa como un escritor experto de cuentos infantiles. Escribe un cuento de 5 páginas sobre ${theme}. 
  Responde ÚNICAMENTE con este formato JSON puro, sin bloques de código: 
  {"title": "Título", "pages": [{"pageNumber": 1, "text": "texto de la página", "imagePrompt": "escena descriptiva en inglés para generación de imagen"}]}`;

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { 
        temperature: 0.7, 
        maxOutputTokens: 2500,
        responseMimeType: "application/json" 
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error("Gemini API error:", res.status, errBody);
    throw new Error(`Error de Google (${res.status}): ${errBody?.error?.message || "Error de conexión"}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  // Limpieza de seguridad por si la IA devuelve markdown
  const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
  const story = JSON.parse(cleanJson);

  // Guardamos en Supabase
  const { data: storyRecord, error: dbError } = await supabase
    .from("stories")
    .insert({ 
      theme, 
      title: story.title, 
      cover_image_url: `https://image.pollinations.ai/prompt/${encodeURIComponent(story.pages[0].imagePrompt + " cinematic style child book cover")}?width=768&height=1024&model=flux` 
    } as any)
    .select().single();

  if (dbError) throw new Error("Error al guardar la historia en la base de datos");

  const pageRows = story.pages.map((p: any) => ({
    story_id: storyRecord.id,
    page_number: p.pageNumber,
    narrative_text: p.text,
    image_url: `https://image.pollinations.ai/prompt/${encodeURIComponent(p.imagePrompt + " coloring book style, black and white, thick lines")}?width=1024&height=1024&model=flux`
  }));

  const { error: pagesError } = await supabase.from("story_pages").insert(pageRows);
  if (pagesError) throw new Error("Error al guardar las páginas");

  return { id: storyRecord.id, title: story.title, shareCode: storyRecord.share_code };
}
