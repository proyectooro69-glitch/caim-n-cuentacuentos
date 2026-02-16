export default async function handler(req, res) {
  // Encabezados para evitar errores de conexión
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });

  try {
    const { theme } = req.body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // Llamada directa sin AbortController para que no se corte a mitad del cuento
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `Escribe un cuento infantil de 5 páginas sobre ${theme}. Devuelve SOLO un objeto JSON con este formato: {"title": "Título", "pages": [{"pageNumber": 1, "text": "Historia...", "imagePrompt": "escena para colorear"}]}. Asegúrate de incluir las 5 páginas.` }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2500 // Espacio de sobra para las 5 páginas
          }
        })
      }
    );

    const data = await response.json();
    
    // Si Gemini devuelve texto con basura (```json), esto lo limpia
    let rawText = data.candidates[0].content.parts[0].text;
    const cleanText = rawText.replace(/```json|```/g, "").trim();
    
    return res.status(200).json(JSON.parse(cleanText));
  } catch (error) {
    // Si algo falla, devolvemos el error como JSON, NO como texto plano
    return res.status(500).json({ error: error.message });
  }
}
