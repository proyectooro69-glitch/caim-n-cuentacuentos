export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;

    if (!HUGGINGFACE_TOKEN) {
      return res.status(500).json({ error: 'HUGGINGFACE_TOKEN not configured' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { prompt } = body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(
      'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({ inputs: prompt })
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HuggingFace API error:', response.status, errorText);

      if (response.status === 503) {
        return res.status(503).json({
          error: 'Model is loading, please try again in a few seconds'
        });
      }

      return res.status(response.status).json({
        error: `HuggingFace API error: ${response.status}`
      });
    }

    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      const jsonResponse = await response.json();
      if (jsonResponse.error) {
        return res.status(500).json({ error: jsonResponse.error });
      }
      return res.status(500).json({ error: 'Unexpected JSON response from API' });
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength === 0) {
      return res.status(500).json({ error: 'Empty response from API' });
    }

    const base64 = Buffer.from(buffer).toString('base64');

    return res.status(200).json({
      image: `data:image/jpeg;base64,${base64}`
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('HuggingFace API timeout after 60 seconds');
      return res.status(504).json({ error: 'Image generation timeout' });
    }
    console.error('Error in generateImage:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}
