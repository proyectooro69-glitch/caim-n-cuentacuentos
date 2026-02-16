export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { theme } = req.body;
    const key = process.env.GEMINI_API_KEY;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Cuento infantil de 5 páginas sobre ${theme}. Responde SOLO con este JSON: {"title": "...", "pages": [{"pageNumber": 1, "text": "...", "imagePrompt": "..."}]}` }] }],
        generationConfig: { maxOutputTokens: 2000 } // Más espacio para que no se corte
      })
    });

    const data = await response.json();
    let text = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
    res.status(200).json(JSON.parse(text));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
