
 import { OpenAI } from "openai";
 

+const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxatBVP9kJAaB4jABdGq3CixrJhi99kaMEaKjKNng26kEPGHmuL1tmSClN5LXG_CzF3/exec";
+
+const inferIntent = (text) => {
+  const normalized = text.toLowerCase();
+
+  if (normalized.includes("pasame") || normalized.includes("busca") || normalized.includes("mostrame")) {
+    return "search";
+  }
+
+  if (normalized.includes("borrá") || normalized.includes("borra") || normalized.includes("eliminá") || normalized.includes("elimina")) {
+    return "delete";
+  }
+
+  if (normalized.includes("agendame") || normalized.includes("recordame")) {
+    return "add";
+  }
+
+  return "chat";
+};
+
+const callSheet = async (payload) => {
+  const response = await fetch(SHEETS_WEBAPP_URL, {
+    method: "POST",
+    headers: { "Content-Type": "application/json" },
+    body: JSON.stringify(payload)
+  });
+
+  if (!response.ok) {
+    throw new Error(`Sheets devolvió ${response.status}`);
+  }
+
+  const contentType = response.headers.get("content-type") || "";
+  if (!contentType.includes("application/json")) {
+    return { raw: await response.text() };
+  }
+
+  return response.json();
+};
 
 export const handler = async (event) => {
   try {
     if (event.httpMethod !== "POST") {
       return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
     }
 
     const apiKey = process.env.OPENAI_API_KEY;
     if (!apiKey) {
       return { statusCode: 500, body: JSON.stringify({ error: "OPENAI_API_KEY no definida" }) };
     }
 
-    const body = JSON.parse(event.body);
+    const body = JSON.parse(event.body || "{}");
     const text = body.text;
     if (!text) {
       return { statusCode: 400, body: JSON.stringify({ error: "No se proporcionó texto" }) };
     }
 
-    // 🔹 Filtrar si el texto es acción de agenda
-    const acciones = ["agendame", "recordame", "borrá", "borra"];
-    const esAccion = acciones.some(palabra => text.toLowerCase().includes(palabra));
-
-    if (esAccion) {
-      // 1️⃣ Guardar en Google Sheets
-      await fetch(SHEETS_WEBAPP_URL, {
-        method: "POST",
-        headers: { "Content-Type": "application/json" },
-        body: JSON.stringify({ action: "add", text })
-      });
+    const intent = inferIntent(text);
+    let sheetContext = "";
+
+    if (intent === "add") {
+      await callSheet({ action: "add", text });
+    }
+
+    if (intent === "delete") {
+      await callSheet({ action: "delete", text });
+      sheetContext = "El borrado fue solicitado al sistema de agenda.";
+    }
+
+    if (intent === "search") {
+      try {
+        const lookup = await callSheet({ action: "search", text });
+        sheetContext = JSON.stringify(lookup);
+      } catch (error) {
+        sheetContext = `No se pudo consultar agenda: ${error.message}`;
+      }
     }
 
-    // 2️⃣ Generar audio con TTS usando prompt refinado
     const openai = new OpenAI({ apiKey });
     const prompt = `
 Eres un asistente que interpreta comandos de agenda de forma natural.
 Responde solo con lo necesario y de manera resumida.
-Si el usuario dice "agendame...", "recordame...", "pasame..." o "borrá...", formula la respuesta diciendo:
-"Te agendé ...", "Te recuerdo ..., "Te paso ... " o "He borrado ...", sin agregar saludos innecesarios.
-Si dice Agendame: Guardas. Si dice Recordame: Guardas con alerta recordatorio. Si dice Borra: Borras el item en cuestión. Y si dice Pasame: Buscas lo que necesita saber previamente guardado.
-Si es solo una consulta (p.ej. "qué día cae el lunes"), responde de manera directa sin guardar nada.
-Texto del usuario: "${text}"
+No inventes datos de agenda: usa únicamente CONTEXTO_AGENDA cuando exista.
+Si no hay datos de agenda suficientes para responder una búsqueda, di exactamente: "No encontré datos guardados sobre eso.".
+Si el usuario dice "agendame..." o "recordame...", responde con "Te agendé ...".
+Si el usuario pide borrar algo, responde con "He borrado ...".
+Si el usuario pide buscar/pasar algo, responde con "Te paso ..." solo si el dato aparece en CONTEXTO_AGENDA.
+
+INTENCION_DETECTADA: ${intent}
+CONTEXTO_AGENDA: ${sheetContext || "(sin contexto)"}
+TEXTO_USUARIO: "${text}"
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
-      body: JSON.stringify({ ok: true, audioBase64: base64Audio })
+      body: JSON.stringify({ ok: true, audioBase64: base64Audio, intent })
     };
-
   } catch (err) {
     console.error(err);
     return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
   }
 };
