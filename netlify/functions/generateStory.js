export async function handler(event) {
  try {
    const { theme, lang } = JSON.parse(event.body);

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    const prompt = `
Actúa como un escritor experto de cuentos infantiles.
Escribe un cuento de 5 páginas sobre "${theme}".
Responde ÚNICAMENTE con este formato JSON puro:
{
  "title": "Título",
  "pages": [
    {
      "pageNumber": 1,
      "text": "texto",
      "imagePrompt": "scene description in english"
    }
  ]
}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2500,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return {
        statusCode: 500,
        body: JSON.stringify({ error }),
      };
    }

    const data = await response.json();
    const rawText =
      data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "No content from Gemini" }),
      };
    }

    let story;

    try {
      const clean = rawText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      story = JSON.parse(clean);
    } catch (err) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Invalid JSON from AI",
          raw: rawText,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(story),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
