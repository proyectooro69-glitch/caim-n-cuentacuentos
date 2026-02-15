export async function handler(event) {
  try {
    const { theme, lang } = JSON.parse(event.body);
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    const prompt = `Escribe un cuento infantil de 5 páginas sobre "${theme}". 
    Responde ÚNICAMENTE con este JSON: 
    {"title": "Título", "pages": [{"pageNumber": 1, "text": "máximo 20 palabras", "imagePrompt": "simple coloring book style scene"}]}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
        }),
      }
    );

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const clean = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: clean,
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
