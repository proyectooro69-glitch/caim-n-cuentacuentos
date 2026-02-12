import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { theme, lang = "es" } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const isEnglish = lang === "en";

    // Step 1: Generate story text using Google Gemini API directly
    console.log("Generating story for theme:", theme, "lang:", lang);

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
      "imagePrompt": "Detailed description for a coloring book image"
    }
  ]
}

Each page must have:
- Short narrative text easy to read aloud
- An image description showing the main scene with thick, simple lines, no complicated backgrounds`
      : `Eres un escritor de cuentos infantiles en español. Crea cuentos cortos, mágicos y apropiados para niños de 3-8 años. 

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional.

El formato debe ser exactamente:
{
  "title": "Título del cuento",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Texto narrativo de la página (2-3 oraciones simples)",
      "imagePrompt": "Descripción detallada para generar una imagen de libro para colorear"
    }
  ]
}

Cada página debe tener:
- Un texto narrativo corto y fácil de leer en voz alta
- Una descripción de imagen que muestre la escena principal con líneas gruesas y simples, sin fondos complicados`;

    const userPrompt = isEnglish
      ? `Create a 5-page story about: ${theme}`
      : `Crea un cuento de 5 páginas sobre: ${theme}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const storyResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!storyResponse.ok) {
      const errorText = await storyResponse.text();
      console.error("Gemini API error:", errorText);
      if (storyResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: isEnglish ? "Gemini quota exceeded. Please wait a minute and try again." : "Cuota de Gemini agotada. Espera un minuto e intenta de nuevo." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Failed to generate story text");
    }

    const storyData = await storyResponse.json();
    let storyContent = storyData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!storyContent) {
      throw new Error("No content returned from Gemini");
    }
    storyContent = storyContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    console.log("Story content:", storyContent);

    let story;
    try {
      story = JSON.parse(storyContent);
    } catch (e) {
      console.error("Failed to parse story JSON:", e);
      throw new Error("Failed to parse story content");
    }

    // Step 2: Create story in database
    const { data: storyRecord, error: storyError } = await supabase
      .from("stories")
      .insert({ theme, title: story.title } as any)
      .select()
      .single();

    if (storyError) {
      console.error("Story insert error:", storyError);
      throw new Error("Failed to save story");
    }

    // Step 3: Generate colorful cover using Pollinations.ai
    console.log("Generating colorful cover image via Pollinations.ai...");
    let coverImageUrl = null;

    try {
      const coverPrompt = encodeURIComponent(
        `Vibrant colorful children's book cover illustration for ages 3-7, cute expressive main character, soft pastel and bright cheerful tones, professional children's book style, friendly inviting atmosphere, no text or words, soft gradients warm lighting. Scene: ${story.pages[0].imagePrompt}`
      );
      const pollinationsCoverUrl = `https://image.pollinations.ai/prompt/${coverPrompt}?width=768&height=1024&nologo=true&seed=${Date.now()}`;

      // Fetch the image from Pollinations
      const coverRes = await fetch(pollinationsCoverUrl);
      if (coverRes.ok) {
        const imageBytes = new Uint8Array(await coverRes.arrayBuffer());
        const fileName = `${storyRecord.id}/cover.png`;
        const { error: uploadError } = await supabase.storage
          .from("story-images")
          .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("story-images").getPublicUrl(fileName);
          coverImageUrl = urlData.publicUrl;
        }
      }
    } catch (e) {
      console.error("Cover generation error:", e);
    }

    if (coverImageUrl) {
      await supabase
        .from("stories")
        .update({ cover_image_url: coverImageUrl } as any)
        .eq("id", storyRecord.id);
    }

    // Step 4: Generate B&W coloring images using Pollinations.ai
    const pages = [];

    for (const page of story.pages) {
      console.log(`Generating image for page ${page.pageNumber} via Pollinations.ai...`);

      let imageUrl = null;
      try {
        const pagePrompt = encodeURIComponent(
          `Simple black and white coloring book illustration for children, pure line art, thick clean outlines, no shading no gradients, white background, child-friendly cute style, no text or words. Scene: ${page.imagePrompt}`
        );
        const pollinationsPageUrl = `https://image.pollinations.ai/prompt/${pagePrompt}?width=1024&height=1024&nologo=true&seed=${Date.now() + page.pageNumber}`;

        const imgRes = await fetch(pollinationsPageUrl);
        if (imgRes.ok) {
          const imageBytes = new Uint8Array(await imgRes.arrayBuffer());
          const fileName = `${storyRecord.id}/page-${page.pageNumber}.png`;
          const { error: uploadError } = await supabase.storage
            .from("story-images")
            .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from("story-images").getPublicUrl(fileName);
            imageUrl = urlData.publicUrl;
          }
        }
      } catch (e) {
        console.error(`Image generation error for page ${page.pageNumber}:`, e);
      }

      pages.push({
        story_id: storyRecord.id,
        page_number: page.pageNumber,
        narrative_text: page.text,
        image_url: imageUrl,
      });
    }

    // Insert all pages
    const { error: pagesError } = await supabase.from("story_pages").insert(pages);

    if (pagesError) {
      console.error("Pages insert error:", pagesError);
      throw new Error("Failed to save story pages");
    }

    return new Response(
      JSON.stringify({
        success: true,
        story: {
          id: storyRecord.id,
          title: story.title,
          shareCode: storyRecord.share_code,
          coverImageUrl,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
