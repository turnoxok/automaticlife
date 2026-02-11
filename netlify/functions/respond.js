// netlify/functions/respond.js
const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const userText = body.text;

    // Llamada a la API de OpenAI para generar la respuesta en texto
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5.2-mini",
        messages: [
          { role: "system", content: "Eres una mujer misteriosa, amable y precisa, que responde recordatorios y tareas." },
          { role: "user", content: userText }
        ]
      })
    });

    const aiData = await aiRes.json();
    const aiText = aiData.choices[0].message.content;

    // Llamada a la API de TTS
    const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: aiText
      })
    });

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());

    return {
      statusCode: 200,
      headers: { "Content-Type": "audio/mpeg" },
      body: audioBuffer.toString("base64"),
      isBase64Encoded: true
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
