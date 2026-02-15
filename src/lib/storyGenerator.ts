import { supabase } from "../integrations/supabase/client";

export async function generateStory(
  theme: string,
  lang: "es" | "en",
  onProgress?: (m: string) => void
) {
  try {
    onProgress?.(
      lang === "en" ? "Creating magic..." : "Creando cuento mágico..."
    );

    // 1️⃣ Generar historia (texto)
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

    if (!story?.title || !story?.pages?.length) {
      throw new Error("La historia generada es inválida");
    }

    // 2️⃣ Generar imagen de portada
    onProgress?.(
      lang === "en" ? "Creating cover..." : "Creando portada..."
    );

    const coverRes = await fetch("/.netlify/functions/generateImage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt:
          story.pages[0].imagePrompt +
          " children's book cover, black and white line art, coloring book style, thick outlines",
      }),
    });

    if (!coverRes.ok) {
      const err = await coverRes.json();
      throw new Error(err.error || "Error generando portada");
    }

    const coverData = await coverRes.json();

    // 3️⃣ Guardar historia en Supabase
    const { data: storyRecord, error: dbError } = await supabase
      .from("stories")
      .insert({
        theme,
        title: story.title,
        cover_image_url: coverData.image,
      } as any)
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    // 4️⃣ Generar imágenes de cada página
    onProgress?.(
      lang === "en" ? "Creating illustrations..." : "Creando ilustraciones..."
    );

    const pageRows = [];

    for (const p of story.pages) {
      const imageRes = await fetch("/.netlify/functions/generateImage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt:
            p.imagePrompt +
            " coloring book style, black and white, thick lines, no color",
        }),
      });

      if (!imageRes.ok) {
        const err = await imageRes.json();
        throw new Error(err.error || "Error generando imagen de página");
      }

      const imageData = await imageRes.json();

      pageRows.push({
        story_id: storyRecord.id,
        page_number: p.pageNumber,
        narrative_text: p.text,
        image_url: imageData.image,
      });
    }

    const { error: pagesError } = await supabase
      .from("story_pages")
      .insert(pageRows);

    if (pagesError) throw new Error(pagesError.message);

    onProgress?.(
      lang === "en" ? "Done!" : "¡Listo!"
    );

    return {
      id: storyRecord.id,
      title: story.title,
      shareCode: storyRecord.share_code,
    };
  } catch (error: any) {
    console.error("Error completo:", error);
    throw new Error(error.message || "Error inesperado");
  }
}
