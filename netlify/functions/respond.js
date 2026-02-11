import { OpenAI } from "openai";

const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxdEFfcN3TSvmaEIHXxv4pkGEpzOYSnXXss8glOh58bmoCeeqG0KZSoqLez7MNbbCU-/exec"; // <-- tu URL real

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "OPENAI_API_KEY no definida" }) };
    }

    const body = JSON.parse(event.body);
    const text = body.text;
    if (!text) {
      return { statusCode: 400, body: JSON.stringify({ error: "No se proporcionó texto" }) };
    }

    // 1️⃣ Guardar en Google Sheets vía Apps Script
    await fetch(SHEETS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", text })
    });

    // 2️⃣ Generar audio con TTS usando prompt refinado
    const openai = new OpenAI({ apiKey });

    const prompt = `
Eres un asistente que interpreta comandos de agenda de forma natural.
Responde solo con lo necesario para el usuario y de manera resumida.
Si el usuario dice "agendame...", "recordame..." o "borra...", formula la respuesta diciendo:
"Te agendé ...", "Te recuerdo ..." o "He borrado ...", sin agregar saludos ni palabras extra.
Texto del usuario: "${text}"
`;

    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts", // modelo TTS
      voice: "coral",
      input: prompt
    });

    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, audioBase64: base64Audio })
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
