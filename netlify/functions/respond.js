


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
    const userText = body.text;
    if (!userText) {
      return { statusCode: 400, body: JSON.stringify({ error: "No se proporcionó texto" }) };
    }

    // 1️⃣ Lógica de Google Sheets: leer y escribir según acción
    let sheetResponse = null;
    if (/agendame|recordame|borrá/i.test(userText)) {
      // Enviar la acción a Apps Script
      const actionType = /borrá/i.test(userText) ? "delete" : "add";
      sheetResponse = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionType, text: userText })
      });
    } else if (/pasame/i.test(userText)) {
      // Leer todos los datos de la hoja
      const readResponse = await fetch(SHEETS_WEBAPP_URL + "?action=list");
      const listData = await readResponse.json();
      sheetResponse = listData;
    }

    // 2️⃣ Construir prompt refinado para IA
    const prompt = `
Eres un asistente que interpreta comandos de agenda de forma natural.
Responde solo lo necesario y resumido. Sé honesto: si no puedes borrar o no hay datos, dilo.
Si el usuario dice "agendame..." o "recordame...", guarda el dato y responde "Te agendé ..." o "Te recuerdo ...".
Si dice "borrá...", borra el item y responde "He borrado ..." o indica que no existe.
Si dice "pasame...", busca la información previamente guardada en la hoja y devuélvela resumida.
Si es una consulta general, responde directamente sin guardar nada.
Al iniciar la sesión, di: "Bienvenido a Automatic Life, yo lo ordeno por ti."
Datos de la hoja: ${sheetResponse ? JSON.stringify(sheetResponse) : "No hay datos"}
Texto del usuario: "${userText}"
`;

    // 3️⃣ Generar audio TTS
    const openai = new OpenAI({ apiKey });
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
