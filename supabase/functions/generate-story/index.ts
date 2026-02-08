import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { theme } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Step 1: Generate story text with 5 pages
    console.log("Generating story for theme:", theme);
    
    const storyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Eres un escritor de cuentos infantiles en español. Crea cuentos cortos, mágicos y apropiados para niños de 3-8 años. 
            
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
- Una descripción de imagen que muestre la escena principal con líneas gruesas y simples, sin fondos complicados`
          },
          {
            role: "user",
            content: `Crea un cuento de 5 páginas sobre: ${theme}`
          }
        ],
      }),
    });

    if (!storyResponse.ok) {
      const errorText = await storyResponse.text();
      console.error("Story generation error:", errorText);
      throw new Error("Failed to generate story");
    }

    const storyData = await storyResponse.json();
    let storyContent = storyData.choices?.[0]?.message?.content;
    
    // Clean up the response - remove markdown code blocks if present
    storyContent = storyContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    console.log("Story content:", storyContent);
    
    let story;
    try {
      story = JSON.parse(storyContent);
    } catch (e) {
      console.error("Failed to parse story JSON:", e);
      throw new Error("Failed to parse story content");
    }

    // Step 2: Create the story in database
    const { data: storyRecord, error: storyError } = await supabase
      .from("stories")
      .insert({
        theme,
        title: story.title,
      })
      .select()
      .single();

    if (storyError) {
      console.error("Story insert error:", storyError);
      throw new Error("Failed to save story");
    }

    // Step 3: Generate images and save pages
    const pages = [];
    
    for (const page of story.pages) {
      console.log(`Generating image for page ${page.pageNumber}...`);
      
      // Generate coloring book style image
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

Scene to illustrate: ${page.imagePrompt}`
            }
          ],
          modalities: ["image", "text"]
        }),
      });

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        console.error(`Image generation error for page ${page.pageNumber}:`, errorText);
        // Continue without image if generation fails
        pages.push({
          story_id: storyRecord.id,
          page_number: page.pageNumber,
          narrative_text: page.text,
          image_url: null
        });
        continue;
      }

      const imageData = await imageResponse.json();
      const imageBase64 = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      let imageUrl = null;
      
      if (imageBase64) {
        // Extract base64 data and upload to storage
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        const fileName = `${storyRecord.id}/page-${page.pageNumber}.png`;
        
        const { error: uploadError } = await supabase.storage
          .from('story-images')
          .upload(fileName, imageBytes, {
            contentType: 'image/png',
            upsert: true
          });

        if (uploadError) {
          console.error(`Upload error for page ${page.pageNumber}:`, uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('story-images')
            .getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      }

      pages.push({
        story_id: storyRecord.id,
        page_number: page.pageNumber,
        narrative_text: page.text,
        image_url: imageUrl
      });
    }

    // Insert all pages
    const { error: pagesError } = await supabase
      .from("story_pages")
      .insert(pages);

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
        }
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
