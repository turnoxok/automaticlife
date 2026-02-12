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

    const textoLower = text.toLowerCase();
    const openai = new OpenAI({ apiKey });

    let respuestaFinal = "";

    // 🔹 AGENDAR
    if (textoLower.includes("agendame") || textoLower.includes("recordame")) {

      await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", text })
      });

      respuestaFinal = "Listo, lo guardé.";

    }

    // 🔹 BORRAR
    else if (textoLower.includes("borra") || textoLower.includes("borrá")) {

      await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", text })
      });

      respuestaFinal = "He borrado el dato si existía.";

    }

    // 🔹 PASAME (BUSCAR REAL)
    else if (textoLower.includes("pasame")) {

      const res = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get", text })
      });

      const data = await res.json();

      if (data.ok && data.result) {
        respuestaFinal = data.result;
      } else {
        respuestaFinal = "No encontré ese dato.";
      }
    }

    // 🔹 CONSULTA NORMAL
    else {
      respuestaFinal = "No es una acción válida.";
    }

    // 🎤 Generar audio con TTS
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
