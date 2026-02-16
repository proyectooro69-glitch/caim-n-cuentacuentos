export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { theme, lang = 'es' } = body;

    if (!theme) {
      return res.status(400).json({ error: 'Theme is required' });
    }

    const isEnglish = lang === 'en';
    const systemPrompt = isEnglish
      ? `You are a children's story writer. Generate ONLY pure JSON, no markdown, no text before or after JSON.

{
  "title": "Story Title",
  "pages": [
    {"pageNumber": 1, "text": "One sentence.", "imagePrompt": "image description"},
    {"pageNumber": 2, "text": "One sentence.", "imagePrompt": "image description"},
    {"pageNumber": 3, "text": "One sentence.", "imagePrompt": "image description"}
  ]
}`
      : `Eres un escritor de cuentos infantiles. Genera SOLO JSON válido, sin markdown, sin texto antes ni después.

{
  "title": "Título",
  "pages": [
    {"pageNumber": 1, "text": "Una oración.", "imagePrompt": "descripción de imagen"},
    {"pageNumber": 2, "text": "Una oración.", "imagePrompt": "descripción de imagen"},
    {"pageNumber": 3, "text": "Una oración.", "imagePrompt": "descripción de imagen"}
  ]
}`;

    const userPrompt = isEnglish
      ? `3-page story about ${theme}. One sentence per page. Return ONLY JSON.`
      : `Cuento de 3 páginas sobre ${theme}. Una oración por página. Devuelve SOLO JSON.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser request: ${userPrompt}` }] }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        })
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      return res.status(response.status).json({
        error: `Gemini API error: ${response.status}`
      });
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      return res.status(500).json({ error: 'Invalid response from Gemini API' });
    }

    let rawText = data.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const jsonStart = rawText.indexOf('{');
    const jsonEnd = rawText.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
      console.error('No valid JSON found in response:', rawText.substring(0, 200));
      return res.status(500).json({ error: 'No valid JSON in response' });
    }

    rawText = rawText.substring(jsonStart, jsonEnd + 1);

    let story;
    try {
      story = JSON.parse(rawText);
    } catch (parseError) {
      console.error('Failed to parse story JSON:', parseError.message, 'Text:', rawText.substring(0, 300));
      return res.status(500).json({ error: 'Invalid JSON format' });
    }

    if (!story.title || !Array.isArray(story.pages) || story.pages.length === 0) {
      return res.status(500).json({ error: 'Invalid story structure' });
    }

    return res.status(200).json(story);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Gemini API timeout after 30 seconds');
      return res.status(504).json({ error: 'API timeout' });
    }
    console.error('Error in generateStory:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}
