import { OpenAI } from "openai";

const SHEETS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbxatBVP9kJAaB4jABdGq3CixrJhi99kaMEaKjKNng26kEPGHmuL1tmSClN5LXG_CzF3/exec";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "OPENAI_API_KEY no definida" }),
      };
    }

    const { text } = JSON.parse(event.body || "{}");
    if (!text) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Texto vacío" }),
      };
    }

    const openai = new OpenAI({ apiKey });

    // 🧠 1️⃣ CLASIFICAR INTENCIÓN (NO VOZ)
    const intentPrompt = `
Eres un clasificador de intenciones.
Devuelve SOLO JSON válido, sin texto extra.

Intenciones posibles:
- add
- delete
- recall
- query
- none

Reglas:
- "agendá", "guardá", "recordame" → add
- "borrá", "eliminá" → delete
- "pasame", "cuando es", "qué tenía" → recall
- preguntas generales → query
- charla → none

Formato:
{
  "intent": "add|delete|recall|query|none",
  "summary": "frase corta para responder al usuario"
}

Texto:
"""${text}"""
`;

    const intentResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: intentPrompt }],
      temperature: 0,
    });

    let intentData;
    try {
      intentData = JSON.parse(intentResponse.choices[0].message.content);
    } catch {
      intentData = {
        intent: "none",
        summary: "No entendí bien lo que me pediste",
      };
    }

    const { intent, summary } = intentData;

    let finalText = summary;

    // 📄 2️⃣ EJECUTAR ACCIÓN
    if (intent === "add") {
      await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", text: summary }),
      });
      finalText = Te agendé ${summary};
    }

    if (intent === "delete") {
      await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteLast" }),
      });
      finalText = "He borrado el último registro";
    }

    if (intent === "recall") {
      const res = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recall" }),
      });

      const data = await res.json();
      finalText = data.text
        ? Tenés agendado: ${data.text}
        : "No encontré nada agendado";
    }

    if (intent === "query") {
      finalText = summary;
    }

    if (intent === "none") {
      finalText = "No estoy seguro de qué querés que haga";
    }

    // 🔊 3️⃣ TEXTO → VOZ
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "coral",
      input: finalText,
    });

    const buffer = Buffer.from(await speech.arrayBuffer()).toString("base64");

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        audioBase64: buffer,
        intent,
        text: finalText,
      }),
    };
  } catch (err) {
    console.error("RESPOND ERROR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: err.message,
      }),
    };
  }
};
