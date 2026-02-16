import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { theme, lang = "es", pageNumber } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const isEnglish = lang === "en";
    let systemPrompt: string;
    let userPrompt: string;

    if (!pageNumber) {
      // MODE 1: Generate story outline only (fast, small response)
      systemPrompt = isEnglish
        ? "You are a children's story writer. Return ONLY valid JSON, no markdown fences."
        : "Eres un escritor de cuentos infantiles. Responde SOLO con JSON válido, sin bloques de código.";

      userPrompt = isEnglish
        ? `Create a children's story outline about "${theme}" with exactly 5 pages. Return ONLY this JSON:
{"title": "Story Title", "pages": [{"pageNumber": 1, "summary": "one sentence summary"}, {"pageNumber": 2, "summary": "..."}, {"pageNumber": 3, "summary": "..."}, {"pageNumber": 4, "summary": "..."}, {"pageNumber": 5, "summary": "..."}]}`
        : `Crea el esquema de un cuento infantil sobre "${theme}" con exactamente 5 páginas. Devuelve SOLO este JSON:
{"title": "Título del Cuento", "pages": [{"pageNumber": 1, "summary": "resumen de una oración"}, {"pageNumber": 2, "summary": "..."}, {"pageNumber": 3, "summary": "..."}, {"pageNumber": 4, "summary": "..."}, {"pageNumber": 5, "summary": "..."}]}`;
    } else {
      // MODE 2: Generate a single page (text + image prompt)
      systemPrompt = isEnglish
        ? "You are a children's story writer. Return ONLY valid JSON, no markdown fences."
        : "Eres un escritor de cuentos infantiles. Responde SOLO con JSON válido, sin bloques de código.";

      userPrompt = isEnglish
        ? `Write page ${pageNumber} of 5 for a children's story about "${theme}".
Return ONLY this JSON: {"text": "The narrative text for this page (2-3 paragraphs for ages 4-8)", "imagePrompt": "A detailed description in English for a coloring book illustration of this scene, with thick lines and no color"}`
        : `Escribe la página ${pageNumber} de 5 de un cuento infantil sobre "${theme}".
Devuelve SOLO este JSON: {"text": "El texto narrativo de esta página (2-3 párrafos para edades 4-8)", "imagePrompt": "A detailed description in English for a coloring book illustration of this scene, with thick lines and no color"}`;
    }

    console.log(`Generating ${pageNumber ? `page ${pageNumber}` : "outline"} for theme: "${theme}"`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: isEnglish ? "Too many requests. Please wait a moment." : "Demasiadas solicitudes. Espera un momento." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: isEnglish ? "AI credits exhausted." : "Créditos de IA agotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `AI error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || "";
    const cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    console.log("AI response cleaned:", cleaned.substring(0, 200));

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", cleaned);
      return new Response(
        JSON.stringify({ error: "Invalid AI response format" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Edge function error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
