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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const isEnglish = lang === "en";

    // Step 1: Generate story text
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

    const storyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!storyResponse.ok) {
      const errorText = await storyResponse.text();
      console.error("Story generation error:", errorText);
      if (storyResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: isEnglish ? "Not enough AI credits." : "No hay suficientes créditos de IA." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (storyResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: isEnglish ? "Too many requests. Please wait." : "Demasiadas solicitudes. Espera un momento." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Failed to generate story");
    }

    const storyData = await storyResponse.json();
    let storyContent = storyData.choices?.[0]?.message?.content;
    storyContent = storyContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    console.log("Story content:", storyContent);

    let story;
    try {
      story = JSON.parse(storyContent);
    } catch (e) {
      console.error("Failed to parse story JSON:", e);
      throw new Error("Failed to parse story content");
    }

    // Step 2: Create story in database (cover_image_url added after generation)
    const { data: storyRecord, error: storyError } = await supabase
      .from("stories")
      .insert({ theme, title: story.title } as any)
      .select()
      .single();

    if (storyError) {
      console.error("Story insert error:", storyError);
      throw new Error("Failed to save story");
    }

    // Step 3: Generate COLORFUL COVER image
    console.log("Generating colorful cover image...");
    let coverImageUrl = null;

    try {
      const coverPrompt = `Create a vibrant, colorful children's book cover illustration for ages 3-7.

Style requirements:
- Full color, soft pastel and bright cheerful tones
- Cute, expressive main character in the center
- Clean, professional children's book illustration style
- Friendly and inviting atmosphere
- No text or words in the image
- Soft gradients and warm lighting

Scene: ${story.pages[0].imagePrompt}`;

      const coverResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: coverPrompt }],
          modalities: ["image", "text"],
        }),
      });

      if (coverResponse.ok) {
        const coverData = await coverResponse.json();
        const coverBase64 = coverData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (coverBase64) {
          const base64Data = coverBase64.replace(/^data:image\/\w+;base64,/, "");
          const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
          const fileName = `${storyRecord.id}/cover.png`;
          const { error: uploadError } = await supabase.storage
            .from("story-images")
            .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from("story-images").getPublicUrl(fileName);
            coverImageUrl = urlData.publicUrl;
          }
        }
      }
    } catch (e) {
      console.error("Cover generation error:", e);
    }

    // Save cover URL to story record
    if (coverImageUrl) {
      await supabase
        .from("stories")
        .update({ cover_image_url: coverImageUrl } as any)
        .eq("id", storyRecord.id);
    }

    // Step 4: Generate B&W coloring images for each page
    const pages = [];

    for (const page of story.pages) {
      console.log(`Generating image for page ${page.pageNumber}...`);

      const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: `Create a simple black and white coloring book illustration for children.

Style requirements:
- Pure black and white line art only
- Thick, clean outlines (like a children's coloring book)
- Simple shapes, no shading or gradients
- White background
- Child-friendly and cute style
- No text or words in the image

Scene to illustrate: ${page.imagePrompt}`,
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!imageResponse.ok) {
        console.error(`Image generation error for page ${page.pageNumber}`);
        pages.push({
          story_id: storyRecord.id,
          page_number: page.pageNumber,
          narrative_text: page.text,
          image_url: null,
        });
        continue;
      }

      const imageData = await imageResponse.json();
      const imageBase64 = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      let imageUrl = null;

      if (imageBase64) {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        const fileName = `${storyRecord.id}/page-${page.pageNumber}.png`;
        const { error: uploadError } = await supabase.storage
          .from("story-images")
          .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("story-images").getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
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
