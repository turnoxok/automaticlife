import { OpenAI } from "openai";

const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbznD0hS3maZytQn6GYmj7E7zQU0p0PuDKWKT4jQvKDbDNnY-60TZbtuyXV0rUjw-s9K/exec";

export const handler = async (event) => {
  const body = JSON.parse(event.body);
  const { text, email, oldText, newText } = body;

  const userId = email || "default";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let action = null;
  let respuestaFinal = "";

  // 🔹 Detectar acción normal
  if (/^(agendame|agendá|recordame|guarda|guardá)[,\s]+/i.test(text)) action = "add";
  else if (/^(borra|borrá|elimina)[,\s]+/i.test(text)) action = "delete";
  else if (/^(pasame|pásame|pasá|pasa|dame|decime|decíme|buscar|buscá|traeme|traé)[,\s]+/i.test(text)) action = "get";
  else if (/^editar$/i.test(text)) action = "edit"; // 👈 NUEVA ACCIÓN

  let textoProcesado = text?.replace(/^(agendame|agendá|recordame|guarda|guardá|borra|borrá|elimina|pasame|pásame|pasá|pasa|dame|decime|decíme|buscar|buscá|traeme|traé)[,\s]+/i, "");

  try {

    // 🔥 EDITAR = BORRAR + AGREGAR
    if (action === "edit") {

      if (!oldText || !newText) {
        respuestaFinal = "Faltan datos para editar.";
      } else {

        // 1️⃣ BORRAR
        await fetch(SHEETS_WEBAPP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", text: oldText, userId })
        });

        // 2️⃣ AGREGAR
        await fetch(SHEETS_WEBAPP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", text: newText, userId })
        });

        respuestaFinal = "Listo, lo actualicé.";
      }

    }

    // 🔹 Acciones normales
    else if (action) {

      const res = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text: textoProcesado, userId })
      });

      const data = await res.json();

      if (action === "add") respuestaFinal = "Listo, lo guardé.";
    else if (action === "delete") respuestaFinal = data.ok ? "Eliminado." : "No encontré ese dato para borrar.";
    else if (action === "get") respuestaFinal = data.ok && data.result ? data.result : "No encontré ese dato.";
  
    } else {
    respuestaFinal = "No es una acción válida.";
  }

  const audioResponse = await openai.audio.speech.create({
  model: "gpt-4o-mini-tts",
  voice: "marin",
  input: respuestaFinal
});
    
  const arrayBuffer = await audioResponse.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString("base64");

  return {
   statusCode: 200,
  body: JSON.stringify({
    ok: true,
    action, // 👈 IMPORTANTE
    audioBase64: base64Audio,
    result: respuestaFinal
    })
  };
};
