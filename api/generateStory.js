export default async function handler(req, res) {
  try {
    const { theme } = JSON.parse(req.body);
    const key = process.env.GEMINI_API_KEY;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Genera un JSON para un cuento infantil sobre ${theme}. Estructura exacta: {"title": "...", "pages": [{"pageNumber": 1, "text": "...", "imagePrompt": "..."}]}` }] }]
      })
    });

    const data = await response.json();
    if (!data.candidates) throw new Error("Google no respondió correctamente");
    
    const rawText = data.candidates[0].content.parts[0].text;
    const cleanText = rawText.replace(/```json|```/g, "").trim();
    
    res.status(200).json(JSON.parse(cleanText));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
