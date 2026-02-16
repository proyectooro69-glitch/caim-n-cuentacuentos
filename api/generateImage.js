export default async function handler(req, res) {
  try {
    const { prompt } = JSON.parse(req.body);
    const response = await fetch("https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell", {
      headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_TOKEN}` },
      method: "POST",
      body: JSON.stringify({ inputs: prompt }),
    });

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    res.status(200).json({ image: `data:image/jpeg;base64,${base64}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
