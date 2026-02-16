import { OpenAI } from "openai";

const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbySXKl82jHVCDPDNq2YXcj7u3PjiQRK2Q_lOBd-FoAw_H1QrdFvjwbk0V_ffb2_CrsW/exec";

// Claves VAPID para notificaciones push (genera las tuyas en https://web-push-codelab.glitch.me/)
const VAPID_PUBLIC_KEY = "BK3d7LKjB2vKLxJ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ8mQ=";
const VAPID_PRIVATE_KEY = "tu-clave-privada-aqui"; // Reemplaza con tu clave privada

export const handler = async (event) => {
  // CORS headers
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
            content: `Eres un asistente de procesamiento de lenguaje natural para un sistema de notas y recordatorios.
            
Analiza el texto del usuario y extrae:
1. La acción principal (add, get, delete, edit, reminder, unknown)
2. El contenido limpio (sin comandos como "agendame", "recordame", etc.)
3. Si es un recordatorio, extrae: tipo (unico, diario, semanal, mensual, anual), fecha/hora, texto descriptivo

Responde SOLO con un JSON válido:
{
  "action": "add|get|delete|edit|reminder|unknown",
  "content": "texto limpio",
  "confidence": 0.0-1.0,
  "reminder": {
    "isReminder": true/false,
    "type": "unico|diario|semanal|mensual|anual",
    "datetime": "ISO 8601 o null",
    "timeText": "texto original de fecha/hora detectado",
    "description": "descripción del recordatorio"
  }
}

Ejemplos:
- "recordame mañana a las 9 llamar al médico" → action: "reminder", reminder.type: "unico", reminder.datetime: "2024-01-16T09:00:00"
- "agendame comprar leche" → action: "add", content: "comprar leche"
- "pasame lo del médico" → action: "get", content: "médico"
- "borra lo de la leche" → action: "delete", content: "leche"`
          },
          { role: "user", content: text }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const intent = JSON.parse(completion.choices[0].message.content);
      action = intent.action;
      textoProcesado = intent.content || text;
      reminderData = intent.reminder;
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

      // Borrar + Agregar
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
      // Procesar recordatorio
      const reminderPayload = {
        action: "addReminder",
        userId,
        text: textoProcesado,
        reminderType: reminderData?.type || "unico",
        datetime: reminderData?.datetime,
        timeText: reminderData?.timeText,
        description: reminderData?.description || textoProcesado
      };

      const res = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reminderPayload)
      });

      const data = await res.json();
      
      if (data.ok) {
        respuestaFinal = `⏰ <strong>Recordatorio programado:</strong><br>${reminderData?.description || textoProcesado}<br><small>Para: ${reminderData?.timeText || 'próximamente'}</small>`;
        textoParaVoz = `Perfecto, te recordaré: ${reminderData?.description || textoProcesado}`;
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
        respuestaFinal = data.result;
        textoParaVoz = `Encontré: ${data.result}`;
      } else {
        respuestaFinal = "No encontré información sobre eso.";
        textoParaVoz = respuestaFinal;
      }

    } else {
      respuestaFinal = "No entendí la acción. Prueba con: agendame, recordame, pasame, o borra.";
      textoParaVoz = respuestaFinal;
    }

    // ========== GENERAR AUDIO ==========
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

// ========== FUNCIONES AUXILIARES ==========
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
