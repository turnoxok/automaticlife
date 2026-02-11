import { OpenAI } from "openai";

// PONÉ TU URL DE WEB APP DE APPS SCRIPT AQUÍ
const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxatBVP9kJAaB4jABdGq3CixrJhi99kaMEaKjKNng26kEPGHmuL1tmSClN5LXG_CzF3/exec";

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
    const text = body.text?.trim();
    if (!text) {
      return { statusCode: 400, body: JSON.stringify({ error: "No se proporcionó texto" }) };
    }

    // 1️⃣ Guardar en Google Sheets vía Apps Script
    try {
      const resSheet = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", text })
      });
      const dataSheet = await resSheet.json();
      if (!dataSheet.ok) {
        console.warn("No se pudo guardar en la hoja:", dataSheet.error);
      }
    } catch (err) {
      console.warn("Error guardando en la hoja:", err.message);
    }

    // 2️⃣ Generar respuesta de la IA con prompt refinado
    const openai = new OpenAI({ apiKey });
    const prompt = `
Eres un asistente que interpreta comandos de agenda de forma natural.
Responde solo con lo necesario y de manera resumida.
Si el usuario dice "agendame...", "recordame...", "pasame..." o "borrá...", formula la respuesta diciendo:
"Te agendé ...", "Te recuerdo ...", "Te paso ...", o "He borrado ...", sin agregar saludos innecesarios.
Si dice "Agendame": Guarda.
Si dice "Recordame": Guarda con alerta recordatorio.
Si dice "Borrá": Borra el item en cuestión.
Si dice "Pasame": Busca lo que necesita saber previamente guardado.
Si es solo una consulta (p.ej. "qué día cae el lunes"), responde de manera directa sin guardar nada.
Al iniciar la sesión, di: "Bienvenido a Automatic Life, yo lo ordeno por ti".
Si no entiendes algo o no se puede guardar/borrar, dilo claramente.
Texto del usuario: "${text}"
`;

    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
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
