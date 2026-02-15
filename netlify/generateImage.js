export async function handler(event) {
  try {
    const { prompt } = JSON.parse(event.body);

    const HF_API_KEY = process.env.HF_API_KEY;

    const response = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
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

    const imageBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString("base64");

    return {
      statusCode: 200,
      body: JSON.stringify({
        image: `data:image/png;base64,${base64}`,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
