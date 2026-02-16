import { OpenAI } from "openai";

const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbw6tSaae4s3gJYWtqKb3UWHgEOsSZHcd-ZPI6GgzCTHwqkaYe-0NPpDFS3qMQ5o-kOb/exec";

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { text = "", email, oldText, newText, action: forcedAction, subscription } = body;

    if (!email && !forcedAction) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ ok: false, error: "Se requiere autenticación" })
      };
    }

    const userId = email || "default";
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // ========== REGISTRAR PUSH SUBSCRIPTION ==========
    if (forcedAction === "registerPush") {
      const res = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "registerPush",
          userId,
          subscription
        })
      });
      const data = await res.json();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, message: "Suscripción registrada" })
      };
    }

    // ========== LISTAR RECORDATORIOS ==========
    if (text && text.toLowerCase().includes("listar recordatorios")) {
      const res = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "listReminders",
          userId
        })
      });
      const data = await res.json();
      
      let resultado = "";
      let textoVoz = "";
      
      if (data.reminders && data.reminders.length > 0) {
        resultado = "<strong>📅 Tus recordatorios:</strong><br><br>";
        data.reminders.forEach((r, i) => {
          resultado += `${i + 1}. ${r.text} - ${r.date} ${r.time}<br>`;
        });
        textoVoz = `Tienes ${data.reminders.length} recordatorios programados.`;
      } else {
        resultado = "No tienes recordatorios programados.";
        textoVoz = resultado;
      }
      
      const audioBase64 = await generarAudio(openai, textoVoz);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          action: "list",
          result: resultado,
          audioBase64
        })
      };
    }

    // ========== DETECTAR INTENCIÓN CON OPENAI ==========
    let action = forcedAction;
    let textoProcesado = text;
    let reminderData = null;

    if (!action) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Eres un clasificador de intenciones para un asistente de notas y recordatorios.

REGLAS IMPORTANTES:
- "agendame", "agenda", "guarda", "guardame", "anota" → action: "add"
- "recordame", "recordatorio", "acordate", "avisame" → action: "reminder"
- "pasame", "pasa", "dame", "busca", "buscame", "mostrame", "decime" → action: "get"
- "borra", "elimina", "saca", "quita" → action: "delete"
- "cambia", "modifica", "actualiza", "edita" → action: "edit"

Para recordatorios, extrae la hora exacta que menciona el usuario:
- "8hs", "8:00", "8" → timeText: "08:00"
- "16hs", "16:00", "16" → timeText: "16:00"
- "13hs", "13:00", "13" → timeText: "13:00"

Analiza el texto y responde SOLO con este JSON:
{
  "action": "add|get|delete|edit|reminder|unknown",
  "content": "texto limpio SIN el comando inicial",
  "confidence": 0.0-1.0,
  "reminder": {
    "isReminder": true/false,
    "type": "unico|diario|semanal|mensual|anual",
    "dateText": "texto de fecha exacto (ej: 12 de diciembre, mañana, lunes a viernes)",
    "timeText": "hora exacta en formato HH:MM (ej: 08:00, 16:00, 13:00)",
    "description": "descripción del recordatorio"
  }
}

Ejemplos:
- "agendame comprar leche" → {"action":"add","content":"comprar leche","reminder":{"isReminder":false}}
- "recordame cumpleaños lili 12 de diciembre" → {"action":"reminder","content":"cumpleaños lili","reminder":{"isReminder":true,"type":"anual","dateText":"12 de diciembre","timeText":"09:00","description":"cumpleaños lili"}}
- "mañana almuerzo con Pepe 13hs" → {"action":"reminder","content":"almuerzo con Pepe","reminder":{"isReminder":true,"type":"unico","dateText":"mañana","timeText":"13:00","description":"almuerzo con Pepe"}}
- "de lunes a viernes 8hs" → {"action":"reminder","content":"trabajo","reminder":{"isReminder":true,"type":"semanal","dateText":"lunes a viernes","timeText":"08:00","description":"trabajo"}}
- "Pasame cumpleaños lili" → {"action":"get","content":"cumpleaños lili","reminder":{"isReminder":false}}
- "borra lo de la leche" → {"action":"delete","content":"leche","reminder":{"isReminder":false}}`
          },
          { role: "user", content: text }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const intent = JSON.parse(completion.choices[0].message.content);
      action = intent.action;
      textoProcesado = intent.content || text;
      reminderData = intent.reminder;
      
      console.log("Intent detectado:", action, "Contenido:", textoProcesado, "Reminder:", JSON.stringify(reminderData));
    }

    // ========== MODO EDICIÓN ==========
    if (action === "edit" || forcedAction === "edit") {
      if (!oldText || !newText) {
        const errorMsg = "Faltan datos para editar.";
        const audioBase64 = await generarAudio(openai, errorMsg);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ok: false,
            action: "edit",
            result: errorMsg,
            audioBase64
          })
        };
      }

      await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", text: oldText, userId })
      });

      const res = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", text: newText, userId })
      });

      const successMsg = "Listo, actualicé el registro.";
      const audioBase64 = await generarAudio(openai, successMsg);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          action: "edit",
          result: newText,
          audioBase64
        })
      };
    }

    // ========== ACCIONES CON SHEETS ==========
    let respuestaFinal = "";
    let textoParaVoz = "";
    let esRecordatorio = false;

    if (action === "reminder" || (reminderData && reminderData.isReminder)) {
      const reminderPayload = {
        action: "addReminder",
        userId,
        text: textoProcesado,
        reminderType: reminderData?.type || "unico",
        dateText: reminderData?.dateText || "",
        timeText: reminderData?.timeText || "",
        description: reminderData?.description || textoProcesado
      };

      const res = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reminderPayload)
      });

      const data = await res.json();
      
      if (data.ok) {
        const fechaMostrar = data.fechaFormateada || reminderData?.dateText || 'próximamente';
        const horaMostrar = data.hora || reminderData?.timeText || '09:00';
        
        // Formatear hora bonita (13:00 → 13hs)
        const horaBonita = horaMostrar.replace(/:00$/, 'hs').replace(/:(\d+)$/, ':$1');
        
        respuestaFinal = `⏰ <strong>Recordatorio:</strong> ${textoProcesado}<br><small style="color:#ffc107">📅 ${fechaMostrar} a las ${horaBonita}</small>`;
        textoParaVoz = `Perfecto, te recordaré: ${textoProcesado} para el ${fechaMostrar} a las ${horaBonita}`;
        esRecordatorio = true;
      } else {
        respuestaFinal = "No pude programar el recordatorio.";
        textoParaVoz = respuestaFinal;
      }

    } else if (action === "add") {
      const res = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", text: textoProcesado, userId })
      });

      const data = await res.json();
      respuestaFinal = textoProcesado;
      textoParaVoz = "Listo, lo guardé.";

    } else if (action === "delete") {
      const res = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", text: textoProcesado, userId })
      });

      const data = await res.json();
      respuestaFinal = "";
      textoParaVoz = data.ok ? "Eliminado correctamente." : "No encontré ese dato para borrar.";

    } else if (action === "get") {
      const res = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get", text: textoProcesado, userId })
      });

      const data = await res.json();

      if (data.ok && data.result) {
        if (data.esRecordatorio && data.fecha) {
          respuestaFinal = `${data.result}<br><small style="color:#ffc107">${data.fecha}</small>`;
          textoParaVoz = `Encontré: ${data.result} para el ${data.fecha.replace(/📅/g, '').trim()}`;
        } else if (data.fecha) {
          respuestaFinal = `${data.result}<br><small style="opacity:0.7">Guardado el: ${data.fecha}</small>`;
          textoParaVoz = `Encontré: ${data.result}`;
        } else {
          respuestaFinal = data.result;
          textoParaVoz = `Encontré: ${data.result}`;
        }
      } else {
        respuestaFinal = "No encontré información sobre eso.";
        textoParaVoz = respuestaFinal;
      }

    } else {
      respuestaFinal = "No entendí la acción. Prueba con: agendame, recordame, pasame, o borra.";
      textoParaVoz = respuestaFinal;
    }

    const audioBase64 = await generarAudio(openai, textoParaVoz);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        action,
        result: respuestaFinal,
        audioBase64,
        reminderData: esRecordatorio ? reminderData : null
      })
    };

  } catch (error) {
    console.error("ERROR:", error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: "Error interno del servidor.",
        details: error.message
      })
    };
  }
};

async function generarAudio(openai, texto) {
  try {
    const audioResponse = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "marin",
      input: texto,
      response_format: "mp3"
    });

    const arrayBuffer = await audioResponse.arrayBuffer();
    return Buffer.from(arrayBuffer).toString("base64");
  } catch (err) {
    console.error("Error generando audio:", err);
    return null;
  }
}
