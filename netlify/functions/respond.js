import { OpenAI } from "openai";

const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxatBVP9kJAaB4jABdGq3CixrJhi99kaMEaKjKNng26kEPGHmuL1tmSClN5LXG_CzF3/exec"; // <-- tu URL real

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

    // 🔹 Filtrar si el texto es acción de agenda
    const acciones = ["agendame", "recordame", "borrá", "borra"];
    const esAccion = acciones.some(palabra => text.toLowerCase().includes(palabra));

    if (esAccion) {
      // 1️⃣ Guardar en Google Sheets
      await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", text })
      });
    }

    // 2️⃣ Generar audio con TTS usando prompt refinado
    const openai = new OpenAI({ apiKey });
    const prompt = `
Eres un asistente que interpreta comandos de agenda de forma natural.
Responde solo con lo necesario y de manera resumida.
Si el usuario dice "agendame...", "recordame...", "pasame..." o "borrá...", formula la respuesta diciendo:
"Te agendé ...", "Te recuerdo ..., "Te paso ... " o "He borrado ...", sin agregar saludos innecesarios.
Si dice Agendame: Guardas. Si dice Recordame: Guardas con alerta recordatorio. Si dice Borra: Borras el item en cuestión. Y si dice Pasame: Buscas lo que necesita saber previamente guardado.
Si es solo una consulta (p.ej. "qué día cae el lunes"), responde de manera directa sin guardar nada.
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
