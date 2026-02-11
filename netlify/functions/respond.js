import { OpenAI } from "openai";

// URL de tu Apps Script desplegado
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
    const userText = body.text;
    if (!userText) {
      return { statusCode: 400, body: JSON.stringify({ error: "No se proporcionó texto" }) };
    }

    // Determinar acción según palabras clave
    let action = "query";   // por defecto solo consulta
    if (/agendame/i.test(userText)) action = "add";
    else if (/recordame/i.test(userText)) action = "add";
    else if (/borr[áa]/i.test(userText)) action = "delete";
    else if (/pasame/i.test(userText)) action = "query";

    let responseText = "";

    if (action === "add") {
      await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", text: userText })
      });
      responseText = `Te agendé: ${userText}`;
    } else if (action === "delete") {
      await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", text: userText })
      });
      responseText = "He borrado el item solicitado.";
    } else if (action === "query") {
      const resSheet = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "query", text: userText })
      });
      const dataSheet = await resSheet.json();
      responseText = dataSheet.ok && dataSheet.result
        ? dataSheet.result
        : "No encontré datos guardados para eso.";
    }

    // Prompt refinado
    const prompt = `
Eres un asistente que interpreta comandos de agenda de forma natural.
Al iniciar sesión, di: "Bienvenido a Automatic Life, yo lo ordeno por ti".
Responde solo con lo necesario y de manera resumida.
Si el usuario dice "agendame...", "recordame...", "pasame..." o "borrá...", formula la respuesta diciendo:
"Te agendé ...", "Te recuerdo ...", "Te paso ...", "He borrado ...", sin agregar saludos innecesarios.
Si es solo una consulta, responde de manera directa sin guardar nada.
Texto de la acción a responder: "${responseText}"
`;

    // Generar audio con TTS
    const openai = new OpenAI({ apiKey });
    const responseAudio = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "coral",
      input: prompt
    });

    const arrayBuffer = await responseAudio.arrayBuffer();
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
