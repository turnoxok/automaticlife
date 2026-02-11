import OpenAI from "openai";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "OPENAI_API_KEY no definida" }) };
    }

    const { text } = JSON.parse(event.body);
    if (!text) {
      return { statusCode: 400, body: JSON.stringify({ error: "No text provided" }) };
    }

    const openai = new OpenAI({ apiKey });

    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "aria",       // ← voz femenina/misteriosa
      input: text
    });

    const audioBase64 = Buffer.from(await response.arrayBuffer()).toString("base64");

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, audioBase64 }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
