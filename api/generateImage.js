export async function handler(event) {
  try {
    const { prompt } = JSON.parse(event.body);
    
    // Usaremos un modelo de alta calidad (FLUX o Stable Diffusion)
    const response = await fetch(
      "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_TOKEN}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ inputs: prompt }),
      }
    );

    if (!response.ok) throw new Error("Error en Hugging Face");

    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: `data:image/jpeg;base64,${base64Image}` }),
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
