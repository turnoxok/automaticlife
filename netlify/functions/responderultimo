import { OpenAI } from "openai";

const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxXjtnqKjXunvlWWxauTc62RgwDkapEvy63sjYeSYrIf1o5u2PJCdI1dZ2Vf18pWZiq/exec";

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

    // 🔹 Detectar intención (inicio + espacio o puntuación)
if (/^(agendame|recordame|guardame)(?=\s|,|\.|$)/i.test(text)) {
  action = "add";
}

else if (/^(borra|borrá|borrar|eliminar|elimina|eliminár)(?=\s|,|\.|$)/i.test(text)) {
  action = "delete";
}

else if (/^(pasame|pásame|pasá|pasa|dame|decime|decíme|buscar|buscá|traeme|traé|cual|cuál|que|qué)(?=\s|,|\.|$)/i.test(text)) {
  action = "get";
}

    // 🔥 LIMPIAR TEXTO SEGÚN ACCIÓN
    let textoProcesado = text;

    if (action === "add") {
      // Quitar palabra de acción al inicio
      textoProcesado = text.replace(
        /^(agendame|agendá|recordame|guarda|guardá)\s+/i,
        ""
      );

      // Corregir errores típicos de voz
      const cleanResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Corrige errores de transcripción de voz.
- No inventes datos.
- Une números separados por puntos.
- Convierte "A mayúscula" en A.
- Convierte "B larga minuscula" en b.
- Devuelve solo el texto corregido.`
          },
          { role: "user", content: textoProcesado }
        ],
        temperature: 0
      });

      textoProcesado = cleanResponse.choices[0].message.content;
    }

    if (action === "get") {
      textoProcesado = text.replace(
        /^(pasame|pásame|pasá|pasa|dame|decime|decíme|buscar|buscá|traeme|traé|cual|cuál|que|qué)\s+/i,
        ""
      );
    }

    if (action === "delete") {
      textoProcesado = text.replace(
        /^(borra|borrá|elimina)\s+/i,
        ""
      );
    }

    // 🔹 Ejecutar acción contra Sheets
    if (action) {

      const res = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text: textoProcesado })
      });

      const data = await res.json();

      if (action === "add") {
        respuestaFinal = "Listo, lo guardé.";
      }

      else if (action === "delete") {
        respuestaFinal = data.ok
          ? "Dato eliminado."
          : "No encontré ese dato para borrar.";
      }

      else if (action === "get") {
        respuestaFinal = data.ok && data.result
          ? data.result
          : "No encontré ese dato.";
      }

    } else {
      respuestaFinal = "No entiendo! Las palabras claves son: Agendame, Recordame, Pasame, Decime, Borrá, Eliminá - Que hago?";
    }


   
    
    // 🎤 Generar audio
    const audioResponse = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "marin",
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
