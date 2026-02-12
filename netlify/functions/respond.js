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
    let action = null;

    // 🔹 Detectar intención
    if (
      textoLower.includes("agendame") ||
      textoLower.includes("agendá") ||
      textoLower.includes("recordame") ||
      textoLower.includes("guardá") ||
      textoLower.includes("guarda")
    ) {
      action = "add";
    }

    else if (
      textoLower.includes("borra") ||
      textoLower.includes("borrá") ||
      textoLower.includes("elimina")
    ) {
      action = "delete";
    }

    else if (
      textoLower.includes("pasame") ||
      textoLower.includes("pasá") ||
      textoLower.includes("dame") ||
      textoLower.includes("buscar") ||
      textoLower.includes("buscá") ||
      textoLower.includes("traeme") ||
      textoLower.includes("traé")
    ) {
      action = "get";
    }

    // 🔹 Ejecutar acción contra Sheets
    if (action) {

      const res = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text })
      });

      const data = await res.json();

      if (action === "add") {
        respuestaFinal = "Listo, lo guardé.";
      }

      else if (action === "delete") {
        respuestaFinal = data.ok
          ? "He borrado el dato."
          : "No encontré ese dato para borrar.";
      }

      else if (action === "get") {
        respuestaFinal = data.ok && data.result
          ? data.result
          : "No encontré ese dato.";
      }

    } else {
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
