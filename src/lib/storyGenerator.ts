import { supabase } from "../integrations/supabase/client";

export async function generateStory(
  theme: string,
  lang: "es" | "en",
  onProgress?: (m: string) => void
) {
  onProgress?.(lang === "en" ? "Creating magic..." : "Creando cuento mágico...");

  const res = await fetch("/.netlify/functions/generateStory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme, lang }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error generando cuento");
  }

  const story = await res.json();

  // Guardar en Supabase
  const { data: storyRecord, error: dbError } = await supabase
    .from("stories")
    .insert({
      theme,
      title: story.title,
      cover_image_url: `https://image.pollinations.ai/prompt/${encodeURIComponent(
        story.pages[0].imagePrompt + " cinematic style child book cover"
      )}?width=768&height=1024&model=flux`,
    } as any)
    .select()
    .single();

  if (dbError) throw new Error(dbError.message);

  const pageRows = story.pages.map((p: any) => ({
    story_id: storyRecord.id,
    page_number: p.pageNumber,
    narrative_text: p.text,
    image_url: `https://image.pollinations.ai/prompt/${encodeURIComponent(
      p.imagePrompt + " coloring book style, black and white, thick lines"
    )}?width=1024&height=1024&model=flux`,
  }));

  const { error: pagesError } = await supabase
    .from("story_pages")
    .insert(pageRows);

  if (pagesError) throw new Error(pagesError.message);

  return {
    id: storyRecord.id,
    title: story.title,
    shareCode: storyRecord.share_code,
  };
}
