// ... (parte inicial del código igual)
    
    const prompt = `Escribe un cuento infantil de 5 páginas sobre "${theme}". 
    Sé breve en los textos para que la respuesta sea rápida. 
    Responde ÚNICAMENTE en JSON puro: 
    {"title": "Título", "pages": [{"pageNumber": 1, "text": "texto corto", "imagePrompt": "simple scene description"}]}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000, // Ajustado para 5 páginas
          },
        }),
      }
    );
// ... (resto del código igual)
