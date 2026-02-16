import { OpenAI } from "openai";

const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzmZOG4A163cUh6pv-cFfNiZ8df2GgBjrwgGe8xcIrXf-xALXBmJA1VII6QQf7xI09F/exec";

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { text = "", email, oldText, newText } = body;

    const userId = email || "default";
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let action = null;
    let respuestaFinal = "";
    let textoParaVoz = "";

    // 🔹 Detectar acción
    if (/^(agendame|agendá|recordame|guarda|guardá)([,\s]+|$)/i.test(text))
      action = "add";
    else if (/^(borra|borrá|elimina)([,\s]+|$)/i.test(text))
      action = "delete";
    else if (/^(pasame|pásame|pasá|pasa|dame|decime|decíme|buscar|buscá|traeme|traé)([,\s]+|$)/i.test(text))
      action = "get";
    else if (/^editar$/i.test(text))
      action = "edit";

    // 🔹 Limpiar comando del texto
    let textoProcesado = text.replace(
      /^(agendame|agendá|recordame|guarda|guardá|borra|borrá|elimina|pasame|pásame|pasá|pasa|dame|decime|decíme|buscar|buscá|traeme|traé)([,\s]+|$)/i,
      ""
    ).trim();

    // 🔥 EDITAR = BORRAR + AGREGAR
    if (action === "edit") {

      if (!oldText || !newText) {
        respuestaFinal = "Faltan datos para editar.";
        textoParaVoz = respuestaFinal;
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

        respuestaFinal = newText; // 👈 guardamos solo el dato limpio
        textoParaVoz = "Listo, lo actualicé.";
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

      if (action === "add") {
        respuestaFinal = textoProcesado;
        textoParaVoz = "Listo, lo guardé.";
      }

      else if (action === "delete") {
        respuestaFinal = "";
        textoParaVoz = data.ok
          ? "Eliminado."
          : "No encontré ese dato para borrar.";
      }

      else if (action === "get") {

        if (data.ok && data.result) {
          respuestaFinal = data.result; // 👈 SOLO el dato
          textoParaVoz = `Encontré esta información: ${data.result}`; // 👈 Solo para voz
        } else {
          respuestaFinal = "";
          textoParaVoz = "No encontré ese dato.";
        }
      }

    } else {
      respuestaFinal = "";
      textoParaVoz = "No es una acción válida.";
    }

    // 🔊 Generar audio
    const audioResponse = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "marin",
      input: textoParaVoz
    });

    const arrayBuffer = await audioResponse.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        action,
        audioBase64: base64Audio,
        result: respuestaFinal // 👈 limpio para UI / editar
      })
    };

  } catch (error) {
    console.error("ERROR:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: "Error interno del servidor."
      })
    };
  }
};
