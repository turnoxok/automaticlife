import { OpenAI } from "openai";

const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbySPqrUKG6ziI7sl0S7cdtOMH6DySJVUyQWlnOjLTbvVpQn52GtLwRh8meSD9WNsW4W/exec";

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
      return { statusCode: 400, body: JSON.stringify({ error: "No se proporcionó texto" }) };
    }

    const openai = new OpenAI({ apiKey });

    let respuestaFinal = "";

    // 🔥 1️⃣ GPT decide intención
    const intentResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Clasificá la intención del usuario.
Devuelve SOLO JSON válido con este formato:
{ "intent": "add" | "get" | "delete" | "question" }

Reglas:
- Si quiere guardar algo → add
- Si quiere recuperar algo → get
- Si quiere borrar algo → delete
- Si es pregunta general (clima, fecha, info, etc) → question`
        },
        { role: "user", content: text }
      ],
      temperature: 0
    });

    const intentJson = JSON.parse(intentResponse.choices[0].message.content);
    const intent = intentJson.intent;

    // 🔥 2️⃣ Ejecutar según intención
    if (intent === "add" || intent === "get" || intent === "delete") {

      const res = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: intent, text })
      });

      const data = await res.json();

      if (intent === "add") {
        respuestaFinal = "Listo, lo guardé.";
      }

      else if (intent === "delete") {
        respuestaFinal = data.ok
          ? "He borrado el dato."
          : "No encontré ese dato.";
      }

      else if (intent === "get") {
        respuestaFinal = data.ok && data.result
          ? data.result
          : "No encontré ese dato.";
      }

    } else {
      // 🔥 3️⃣ Pregunta normal → GPT responde
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Respondé breve, claro y natural." },
          { role: "user", content: text }
        ]
      });

      respuestaFinal = completion.choices[0].message.content;
    }

    // 🔥 4️⃣ Generar audio
    const audioResponse = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "coral",
      input: respuestaFinal
    });

    const arrayBuffer = await audioResponse.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, audioBase64: base64Audio })
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
