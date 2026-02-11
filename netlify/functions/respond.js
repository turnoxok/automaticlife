import { OpenAI } from "openai";

export const handler = async (event) => {
  try {
    // Solo POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "OPENAI_API_KEY no definida" }),
      };
    }

    const body = JSON.parse(event.body);
    const text = body.text;
    if (!text) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No se proporcionó texto" }),
      };
    }

    const openai = new OpenAI({ apiKey });

    // Generar audio usando el modelo de TTS
    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",   // modelo de texto a voz
      voice: "coral",             // voz predeterminada
      input: text,
    });

    // La respuesta viene como ArrayBuffer, convertimos a base64
    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, audioBase64: base64Audio }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
