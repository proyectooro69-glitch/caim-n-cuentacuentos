export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { theme } = body;

    // EL PROMPT AHORA PIDE 5 PÁGINAS
    const systemPrompt = `Eres un escritor de cuentos infantiles. Genera SOLO JSON válido para un cuento de 5 páginas.
    {
      "title": "Título",
      "pages": [
        {"pageNumber": 1, "text": "máximo 20 palabras", "imagePrompt": "simple coloring book style scene"},
        {"pageNumber": 2, "text": "máximo 20 words", "imagePrompt": "scene description"},
        {"pageNumber": 3, "text": "...", "imagePrompt": "..."},
        {"pageNumber": 4, "text": "...", "imagePrompt": "..."},
        {"pageNumber": 5, "text": "...", "imagePrompt": "..."}
      ]
    }`;

    // Aumentamos el tiempo de espera a 60 segundos para las 5 páginas
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nTema: ${theme}. Genera 5 páginas.` }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048 // MÁS ESPACIO PARA QUE NO SE CORTE EL JSON
          }
        })
      }
    );

    clearTimeout(timeoutId);
    const data = await response.json();
    let rawText = data.candidates[0].content.parts[0].text;
    
    // Limpieza profunda del texto
    rawText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonStart = rawText.indexOf('{');
    const jsonEnd = rawText.lastIndexOf('}');
    const cleanText = rawText.substring(jsonStart, jsonEnd + 1);

    return res.status(200).json(JSON.parse(cleanText));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
