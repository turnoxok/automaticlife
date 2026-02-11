// netlify/functions/respond.js
const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

exports.handler = async (event) => {
  try {
    const { text } = JSON.parse(event.body);
    if (!text) return { statusCode: 400, body: JSON.stringify({ ok: false, error: "No text" }) };

    console.log("Texto recibido en respond:", text); // 🔹 Ver en consola

    const resp = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: text
    });

    // Convertir a base64 para enviar al cliente
    const audioBase64 = Buffer.from(await resp.arrayBuffer()).toString("base64");

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, audioBase64 })
    };
  } catch (err) {
    console.error("Error en respond:", err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
