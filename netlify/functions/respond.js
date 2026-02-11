import { OpenAI } from "openai";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: "OPENAI_API_KEY no definida" }) };

    const body = JSON.parse(event.body);
    const text = body.text;
    if (!text) return { statusCode: 400, body: JSON.stringify({ error: "No se proporcionó texto" }) };

    const openai = new OpenAI({ apiKey });

    // 1️⃣ Generar texto natural para voz
    const prompt = `Convierte esto en una frase natural de confirmación para leer en voz alta, sin saludos ni palabras innecesarias: "${text}"`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const naturalText = completion.choices[0].message.content;

    // 2️⃣ Guardar en Google Sheet (App Script)
    try {
      await fetch("https://script.google.com/macros/s/AKfycbxdEFfcN3TSvmaEIHXxv4pkGEpzOYSnXXss8glOh58bmoCeeqG0KZSoqLez7MNbbCU-/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: naturalText })
      });
    } catch (err) {
      console.error("Error guardando en Sheet:", err.message);
    }

    // 3️⃣ Generar audio con TTS
    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "coral",
      input: naturalText,
    });

    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    return { statusCode: 200, body: JSON.stringify({ ok: true, audioBase64: base64Audio }) };

  } catch (err)
