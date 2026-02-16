// Netlify Function - CommonJS format
const { OpenAI } = require("openai");

const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwsNHHZ_ZyTRFsfeeEvkvl2kfOzWoNnNoQBowsxPbXDIBsjGSOl1iq917UvzzulnK75/exec";

exports.handler = async (event, context) => {
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
    
    console.log("=== RESPOND.JS RECIBIDO ===");
    console.log("Body completo:", JSON.stringify(body, null, 2));
    
    const { 
      text = "", 
      email, 
      oldText, 
      newText, 
      action: forcedAction, 
      subscription,
      isReminder,
      reminderId
    } = body;

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

    // ========== MODO EDICIÓN = BORRAR + CREAR NUEVO ==========
    if (forcedAction === "edit" || (oldText && newText)) {
      console.log("=== MODO EDICIÓN: BORRAR + CREAR NUEVO ===");
      console.log("oldText:", oldText);
      console.log("newText:", newText);

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
        // PASO 1: BORRAR EL VIEJO
        console.log("PASO 1: Borrando viejo:", oldText);
        
        const deleteRes = await fetch(SHEETS_WEBAPP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete",
            text: oldText,
            userId: userId
          })
        });

        const deleteData = await deleteRes.json();
        console.log("Respuesta delete:", deleteData);

        // PASO 2: EXTRAER DATOS DEL NUEVO TEXTO
        // Usar OpenAI para detectar fecha/hora del nuevo texto
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `Extrae fecha y hora del texto de un recordatorio.
Responde SOLO con este JSON:
{
  "dateText": "mañana|hoy|pasado mañana|lunes|etc",
  "timeText": "HH:MM",
  "description": "descripción limpia sin fecha ni hora"
}

Ejemplos:
- "reunion arvet 22hs" → {"dateText":"hoy","timeText":"22:00","description":"reunion arvet"}
- "reunion arvet mañana 10hs" → {"dateText":"mañana","timeText":"10:00","description":"reunion arvet"}
- "cumpleaños de Juan 30 de abril" → {"dateText":"30 de abril","timeText":"09:00","description":"cumpleaños de Juan"}`
            },
            { role: "user", content: newText }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1
        });

        const nuevoDatos = JSON.parse(completion.choices[0].message.content);
        console.log("Datos extraídos del nuevo texto:", nuevoDatos);

        // PASO 3: CREAR EL NUEVO RECORDATORIO
        console.log("PASO 3: Creando nuevo recordatorio");

        const addRes = await fetch(SHEETS_WEBAPP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "addReminder",
            userId: userId,
            text: newText,
            description: nuevoDatos.description,
            dateText: nuevoDatos.dateText,
            timeText: nuevoDatos.timeText,
            reminderType: "unico"
          })
        });

        const addData = await addRes.json();
        console.log("Respuesta addReminder:", addData);

        if (!addData.ok) {
          throw new Error("Error al crear el nuevo recordatorio");
        }

        // Generar respuesta de éxito
        const fechaMostrar = addData.fechaFormateada || nuevoDatos.dateText;
        const horaMostrar = addData.hora || nuevoDatos.timeText;
        const horaBonita = horaMostrar.replace(/:00$/, 'hs').replace(/:(\d+)$/, ':$1');
        
        const resultadoHTML = `✏️ <strong>Editado:</strong> ${nuevoDatos.description}<br><small style="color:#ffc107">📅 ${fechaMostrar} a las ${horaBonita}</small>`;
        const textoVoz = `Listo, actualicé el recordatorio: ${nuevoDatos.description} para el ${fechaMostrar} a las ${horaBonita}`;

        const audioBase64 = await generarAudio(openai, textoVoz);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ok: true,
            action: "edit",
            result: resultadoHTML,
            audioBase64,
            reminderData: {
              isReminder: true,
              id: addData.reminderId,
              type: "unico",
              dateText: nuevoDatos.dateText,
              timeText: horaMostrar,
              description: nuevoDatos.description,
              fechaFormateada: fechaMostrar
            }
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

Responde SOLO con este JSON exacto:
{
  "action": "add|get|delete|reminder|unknown",
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
- "mañana almuerzo con Pepe 13hs" → {"action":"reminder","content":"almuerzo con Pepe","reminder":{"isReminder":true,"type":"unico","dateText":"mañana","timeText":"13:00","description":"almuerzo con Pepe"}}`
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
      
      if (reminderData && reminderData.isReminder) {
        const horaDetectada = extraerHoraManual(text);
        if (horaDetectada && (!reminderData.timeText || reminderData.timeText === "09:00")) {
          reminderData.timeText = horaDetectada;
          console.log("Hora extraída manualmente:", horaDetectada);
        }
      }
      
      console.log("Intent detectado:", action, "Reminder:", JSON.stringify(reminderData));
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

      console.log("Creando recordatorio:", JSON.stringify(reminderPayload));

      const res = await fetch(SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reminderPayload)
      });

      const data = await res.json();
      
      if (data.ok) {
        const fechaMostrar = data.fechaFormateada || reminderData?.dateText || 'próximamente';
        const horaMostrar = data.hora || reminderData?.timeText || '09:00';
        
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
        
        // Devolver datos para edición
        const audioBase64 = await generarAudio(openai, textoParaVoz);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ok: true,
            action: "get",
            result: respuestaFinal,
            audioBase64,
            reminderId: data.reminderId || null,
            notaId: data.id || null,
            tipo: data.tipo || null,
            dateText: data.dateText || null,
            timeText: data.timeText || null,
            description: data.description || null,
            esRecordatorio: data.esRecordatorio || false
          })
        };
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

function extraerHoraManual(texto) {
  const patrones = [
    /(\d{1,2})\s*hs/i,
    /(\d{1,2}):(\d{2})\s*hs?/i,
    /(\d{1,2})\.(\d{2})/,
    /\ba\s*las\s*(\d{1,2})(?::(\d{2}))?/i,
  ];
  
  for (let patron of patrones) {
    const match = texto.match(patron);
    if (match) {
      let horas = parseInt(match[1]);
      let minutos = match[2] ? parseInt(match[2]) : 0;
      
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
