import { OpenAI } from "openai";
import fetch from "node-fetch"; // para llamar la API de Google Sheets

export const handler = async (event) => {
  try {
    // Solo POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const sheetsKey = process.env.SHEETS_API_KEY;       // clave de la API de Google Sheets
    const spreadsheetId = process.env.SPREADSHEET_ID;   // ID de tu hoja
    if (!apiKey || !sheetsKey || !spreadsheetId) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Variables de entorno no definidas" }),
      };
    }

    const body = JSON.parse(event.body);
    const text = body.text;
    if (!text) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No se proporcionó texto" }),
      };
    }

    // 1️⃣ Guardar en Google Sheets
    // Suponemos que la hoja se llama "Recordatorios" y tiene columnas: Fecha, Texto
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1:append?valueInputOption=USER_ENTERED`;

    const date = new Date().toLocaleString("es-AR"); // fecha y hora actual
    const row = [[date, text]];                     // fila a agregar

    await fetch(sheetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sheetsKey}`,
      },
      body: JSON.stringify({ values: row }),
    });

    // 2️⃣ Generar audio usando OpenAI TTS
    const openai = new OpenAI({ apiKey });

    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "coral",
      input: text,
    });

    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, audioBase64: base64Audio }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
