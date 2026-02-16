import { OpenAI } from "openai";

const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbx3udZ3iw5ZASCN2XHkT56jCnhM4X7Qi0sPhx-qPP43Eag-eOFsOo2gMEK2ya0VWu29/exec";

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
    const { text = "", email, oldText, newText, action: forcedAction, subscription, isReminder, reminderId } = body;

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

    // ========== MODO EDICIÓN DIRECTA (NUEVO - APPS SCRIPT SOPORTA EDIT) ==========
    if (forcedAction === "edit" || (oldText && newText && !text)) {
      console.log("Modo edición detectado:", { oldText, newText, isReminder, reminderId });
      
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

      try {
        const res = await fetch(SHEETS_WEBAPP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "edit",
            userId,
            oldText,
            newText,
            isReminder: isReminder || false,
            reminderId: reminderId || null
          })
        });

        const data = await res.json();
        console.log("Respuesta de edit en Sheets:", data);

        if (!data.ok) {
          throw new Error(data.error || "Error al editar en Sheets");
        }

        // Generar mensaje de voz según el tipo
        let textoVoz = "";
        let resultadoHTML = "";
        
        if (data.reminderData && data.reminderData.isReminder) {
          const horaBonita = data.reminderData.timeText.replace(/:00$/, 'hs').replace(/:(\d+)$/, ':$1');
          resultadoHTML = `✏️ <strong>Editado:</strong> ${data.reminderData.description}<br><small style="color:#ffc107">📅 ${data.reminderData.fechaFormateada} a las ${horaBonita}</small>`;
          textoVoz = `Listo, actualicé el recordatorio: ${data.reminderData.description} para el ${data.reminderData.fechaFormateada} a las ${horaBonita}`;
        } else {
          resultadoHTML = `✏️ <strong>Editado:</strong> ${newText}`;
          textoVoz = "Listo, actualicé el registro.";
        }

        const audioBase64 = await generarAudio(openai, textoVoz);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ok: true,
            action: "edit",
            result: resultadoHTML,
            audioBase64,
            reminderData: data.reminderData || null
          })
        };
        
      } catch (err) {
        console.error("Error en edición:", err);
        const errorMsg = "No pude editar el registro. Intenta de nuevo.";
        const audioBase64 = await generarAudio(openai, errorMsg);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ok: false,
            action: "edit",
            result: errorMsg,
            audioBase64,
            error: err.message
          })
        };
      }
    }

    // ========== DETECTAR INTENCIÓN CON OPENAI ==========
    let action = forcedAction;
    let textoProcesado = text;
    let reminderData = null;

    if (!action && text) {
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

Para recordatorios, DEBES extraer la hora exacta del texto del usuario:
- Si dice "8hs" o "8" → timeText: "08:00"
- Si dice "16hs" o "16" → timeText: "16:00"
- Si dice "13hs" o "13" → timeText: "13:00"
- Si dice "9:30" o "9hs30" → timeText: "09:30"
- Si NO menciona hora → timeText: "09:00"

Responde SOLO con este JSON exacto:
{
  "action": "add|get|delete|edit|reminder|unknown",
  "content": "texto limpio SIN el comando inicial",
  "confidence": 0.0-1.0,
  "reminder": {
    "isReminder": true/false,
    "type": "unico|diario|semanal|mensual|anual",
    "dateText": "texto de fecha exacto",
    "timeText": "HH:MM - hora exacta que dijo el usuario",
    "description": "descripción del recordatorio"
  }
}

Ejemplos:
- "mañana almuerzo con Pepe 13hs" → {"action":"reminder","content":"almuerzo con Pepe","reminder":{"isReminder":true,"type":"unico","dateText":"mañana","timeText":"13:00","description":"almuerzo con Pepe"}}
- "de lunes a viernes trabajo 8hs" → {"action":"reminder","content":"trabajo","reminder":{"isReminder":true,"type":"semanal","dateText":"lunes a viernes","timeText":"08:00","description":"trabajo"}}`
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
      
      // RESPALDO: Si OpenAI no detectó la hora, extraerla manualmente del texto original
      if (reminderData && reminderData.isReminder) {
        const horaDetectada = extraerHoraManual(text);
        if (horaDetectada && (!reminderData.timeText || reminderData.timeText === "09:00")) {
          reminderData.timeText = horaDetectada;
          console.log("Hora extraída manualmente:", horaDetectada);
        }
      }
      
      console.log("Intent:", action, "Content:", textoProcesado, "Reminder:", JSON.stringify(reminderData));
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
        timeText: reminderData?.timeText || "09:00",
        description: reminderData?.description || textoProcesado
      };

      console.log("Enviando a Sheets:", JSON.stringify(reminderPayload));

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

    } else if (action === "edit") {
      // Este caso se maneja arriba con forcedAction, pero por si OpenAI detecta "edita" en el texto
      respuestaFinal = "Para editar, usa el botón de editar en el resultado.";
      textoParaVoz = respuestaFinal;

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

// Función de respaldo para extraer hora manualmente del texto
function extraerHoraManual(texto) {
  // Buscar patrones: 13hs, 13 hs, 13:00, 13, 9.30, 9:30hs, etc.
  const patrones = [
    /(\d{1,2})\s*hs/i,           // 13hs, 13 hs
    /(\d{1,2}):(\d{2})\s*hs?/i, // 13:00, 13:00hs, 13:30
    /(\d{1,2})\.(\d{2})/,        // 13.30
    /\ba\s*las\s*(\d{1,2})(?::(\d{2}))?/i, // a las 13, a las 13:30
  ];
  
  for (let patron of patrones) {
    const match = texto.match(patron);
    if (match) {
      let horas = parseInt(match[1]);
      let minutos = match[2] ? parseInt(match[2]) : 0;
      
      // Validar rango
      if (horas >= 0 && horas <= 23 && minutos >= 0 && minutos <= 59) {
        return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
      }
    }
  }
  
  return null;
}

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
