1	import { OpenAI } from "openai";
     2	
     3	const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxatBVP9kJAaB4jABdGq3CixrJhi99kaMEaKjKNng26kEPGHmuL1tmSClN5LXG_CzF3/exec";
     4	
     5	const inferIntent = (text) => {
     6	  const normalized = text.toLowerCase();
     7	
     8	  if (normalized.includes("pasame") || normalized.includes("busca") || normalized.includes("mostrame")) {
     9	    return "search";
    10	  }
    11	
    12	  if (normalized.includes("borrá") || normalized.includes("borra") || normalized.includes("eliminá") || normalized.includes("elimina")) {
    13	    return "delete";
    14	  }
    15	
    16	  if (normalized.includes("agendame") || normalized.includes("recordame")) {
    17	    return "add";
    18	  }
    19	
    20	  return "chat";
    21	};
    22	
    23	const callSheet = async (payload) => {
    24	  const response = await fetch(SHEETS_WEBAPP_URL, {
    25	    method: "POST",
    26	    headers: { "Content-Type": "application/json" },
    27	    body: JSON.stringify(payload)
    28	  });
    29	
    30	  if (!response.ok) {
    31	    throw new Error(`Sheets devolvió ${response.status}`);
    32	  }
    33	
    34	  const contentType = response.headers.get("content-type") || "";
    35	  if (!contentType.includes("application/json")) {
    36	    return { raw: await response.text() };
    37	  }
    38	
    39	  return response.json();
    40	};
    41	
    42	export const handler = async (event) => {
    43	  try {
    44	    if (event.httpMethod !== "POST") {
    45	      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    46	    }
    47	
    48	    const apiKey = process.env.OPENAI_API_KEY;
    49	    if (!apiKey) {
    50	      return { statusCode: 500, body: JSON.stringify({ error: "OPENAI_API_KEY no definida" }) };
    51	    }
    52	
    53	    const body = JSON.parse(event.body || "{}");
    54	    const text = body.text;
    55	    if (!text) {
    56	      return { statusCode: 400, body: JSON.stringify({ error: "No se proporcionó texto" }) };
    57	    }
    58	
    59	    const intent = inferIntent(text);
    60	    let sheetContext = "";
    61	
    62	    if (intent === "add") {
    63	      await callSheet({ action: "add", text });
    64	    }
    65	
    66	    if (intent === "delete") {
    67	      await callSheet({ action: "delete", text });
    68	      sheetContext = "El borrado fue solicitado al sistema de agenda.";
    69	    }
    70	
    71	    if (intent === "search") {
    72	      try {
    73	        const lookup = await callSheet({ action: "search", text });
    74	        sheetContext = JSON.stringify(lookup);
    75	      } catch (error) {
    76	        sheetContext = `No se pudo consultar agenda: ${error.message}`;
    77	      }
    78	    }
    79	
    80	    const openai = new OpenAI({ apiKey });
    81	    const prompt = `
    82	Eres un asistente que interpreta comandos de agenda de forma natural.
    83	Responde solo con lo necesario y de manera resumida.
    84	No inventes datos de agenda: usa únicamente CONTEXTO_AGENDA cuando exista.
    85	Si no hay datos de agenda suficientes para responder una búsqueda, di exactamente: "No encontré datos guardados sobre eso.".
    86	Si el usuario dice "agendame..." o "recordame...", responde con "Te agendé ...".
    87	Si el usuario pide borrar algo, responde con "He borrado ...".
    88	Si el usuario pide buscar/pasar algo, responde con "Te paso ..." solo si el dato aparece en CONTEXTO_AGENDA.
    89	
    90	INTENCION_DETECTADA: ${intent}
    91	CONTEXTO_AGENDA: ${sheetContext || "(sin contexto)"}
    92	TEXTO_USUARIO: "${text}"
    93	`;
    94	
    95	    const response = await openai.audio.speech.create({
    96	      model: "gpt-4o-mini-tts",
    97	      voice: "coral",
    98	      input: prompt
    99	    });
   100	
   101	    const arrayBuffer = await response.arrayBuffer();
   102	    const base64Audio = Buffer.from(arrayBuffer).toString("base64");
   103	
   104	    return {
   105	      statusCode: 200,
   106	      body: JSON.stringify({ ok: true, audioBase64: base64Audio, intent })
   107	    };
   108	  } catch (err) {
   109	    console.error(err);
   110	    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
   111	  }
   112	};
