import { supabase } from "../integrations/supabase/client";

/**
 * Generates a story page-by-page to avoid timeouts.
 * Step 1: Get story outline (title + summaries) — one fast call
 * Step 2: Generate each page's text + image one at a time
 */
export async function generateStory(
  theme: string,
  lang: "es" | "en",
  onProgress?: (m: string) => void
) {
  const t = lang === "en"
    ? {
        outline: "Creating story outline...",
        page: (n: number) => `Writing page ${n} of 5...`,
        cover: "Creating cover...",
        image: (n: number) => `Drawing page ${n}...`,
        saving: "Saving story...",
        done: "Done!",
      }
    : {
        outline: "Creando esquema del cuento...",
        page: (n: number) => `Escribiendo página ${n} de 5...`,
        cover: "Creando portada...",
        image: (n: number) => `Dibujando página ${n}...`,
        saving: "Guardando cuento...",
        done: "¡Listo!",
      };

  try {
    // 1️⃣ Generate story outline (title + page summaries)
    onProgress?.(t.outline);

    const { data: outlineData, error: outlineError } = await supabase.functions.invoke(
      "generate-story",
      { body: { theme, lang } }
    );

    if (outlineError) throw new Error(outlineError.message);
    if (!outlineData?.title || !outlineData?.pages?.length) {
      throw new Error("Invalid story outline");
    }

    const storyTitle: string = outlineData.title;

    // 2️⃣ Generate each page's content one-by-one
    const pages: Array<{ pageNumber: number; text: string; imagePrompt: string }> = [];

    for (let i = 1; i <= 5; i++) {
      onProgress?.(t.page(i));

      const { data: pageData, error: pageError } = await supabase.functions.invoke(
        "generate-story",
        { body: { theme, lang, pageNumber: i } }
      );

      if (pageError) throw new Error(pageError.message);
      if (!pageData?.text) throw new Error(`Page ${i} generation failed`);

      pages.push({
        pageNumber: i,
        text: pageData.text,
        imagePrompt: pageData.imagePrompt || theme,
      });
    }

    // 3️⃣ Generate cover image using Pollinations.ai (free, no timeout)
    onProgress?.(t.cover);
    const coverPrompt = encodeURIComponent(
      pages[0].imagePrompt +
        " children's book cover, colorful, whimsical, digital art"
    );
    const coverUrl = `https://image.pollinations.ai/prompt/${coverPrompt}?width=512&height=512&nologo=true`;

    // Pre-fetch to ensure the image is generated
    await fetch(coverUrl);

    // 4️⃣ Save story to database
    onProgress?.(t.saving);

    const { data: storyRecord, error: dbError } = await supabase
      .from("stories")
      .insert({
        theme,
        title: storyTitle,
        cover_image_url: coverUrl,
      } as any)
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    // 5️⃣ Generate page images and save
    const pageRows = [];

    for (const p of pages) {
      onProgress?.(t.image(p.pageNumber));

      const pagePrompt = encodeURIComponent(
        p.imagePrompt +
          " coloring book style, black and white line art, thick outlines, no color, no shading"
      );
      const pageImageUrl = `https://image.pollinations.ai/prompt/${pagePrompt}?width=512&height=512&nologo=true`;

      // Pre-fetch to ensure image is generated
      await fetch(pageImageUrl);

      pageRows.push({
        story_id: storyRecord.id,
        page_number: p.pageNumber,
        narrative_text: p.text,
        image_url: pageImageUrl,
      });
    }

    const { error: pagesError } = await supabase
      .from("story_pages")
      .insert(pageRows);

    if (pagesError) throw new Error(pagesError.message);

    onProgress?.(t.done);

    return {
      id: storyRecord.id,
      title: storyTitle,
      shareCode: storyRecord.share_code,
    };
  } catch (error: any) {
    console.error("Error generating story:", error);
    throw new Error(error.message || "Error inesperado");
  }
}
