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
      ? `Create a children's story in English. Respond ONLY with valid JSON, no markdown.

Format:
{
  "title": "Story title",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Short narrative (2-3 sentences)",
      "imagePrompt": "Description for coloring book image"
    }
  ]
}`
      : `Crea un cuento infantil en español. Responde ÚNICAMENTE con JSON válido, sin markdown.

Formato:
{
  "title": "Título del cuento",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Texto narrativo (2-3 oraciones)",
      "imagePrompt": "Descripción para imagen de libro para colorear"
    }
  ]
}`;

    const userPrompt = isEnglish
      ? `Create a 5-page story about: ${theme}`
      : `Crea un cuento de 5 páginas sobre: ${theme}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
          ],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 4096
          }
        })
      }
    );

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

    let story;
    try {
      story = JSON.parse(rawText);
    } catch (parseError) {
      console.error('Failed to parse story JSON:', parseError);
      return res.status(500).json({ error: 'Failed to parse story content' });
    }

    if (!story.title || !Array.isArray(story.pages) || story.pages.length === 0) {
      return res.status(500).json({ error: 'Invalid story structure' });
    }

    return res.status(200).json(story);
  } catch (error) {
    console.error('Error in generateStory:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}
