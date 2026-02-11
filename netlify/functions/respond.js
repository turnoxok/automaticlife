import fetch from "node-fetch";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method not allowed" };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: "OPENAI_API_KEY no definida" }),
      };
    }

    const { text } = JSON.parse(event.body);
    if (!text) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "No text provided" }),
      };
    }

    // Llamada a la API de OpenAI TTS
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "alloy",   // voz predeterminada
        input: text
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("TTS error:", errText);
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: "Error generando audio" }),
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString("base64");

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, audioBase64 }),
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
