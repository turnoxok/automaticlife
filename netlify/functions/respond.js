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
    42	const callSheetWithFallback = async (actions, text) => {
    43	  let lastError;
    44	
    45	  for (const action of actions) {
    46	    try {
    47	      const result = await callSheet({ action, text });
    48	      return { actionUsed: action, result };
    49	    } catch (error) {
    50	      lastError = error;
    51	    }
    52	  }
    53	
    54	  throw lastError || new Error("No se pudo ejecutar acción en Sheets");
    55	};
    56	
    57	const extractResponseText = (response) => {
    58	  if (response.output_text) {
    59	    return response.output_text.trim();
    60	  }
    61	
    62	  const output = Array.isArray(response.output) ? response.output : [];
    63	  const texts = [];
    64	
    65	  for (const item of output) {
    66	    const content = Array.isArray(item.content) ? item.content : [];
    67	    for (const part of content) {
    68	      if (part.type === "output_text" && part.text) {
    69	        texts.push(part.text);
    70	      }
    71	    }
    72	  }
    73	
    74	  return texts.join("\n").trim();
    75	};
    76	
    77	export const handler = async (event) => {
    78	  try {
    79	    if (event.httpMethod !== "POST") {
    80	      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    81	    }
    82	
    83	    const apiKey = process.env.OPENAI_API_KEY;
    84	    if (!apiKey) {
    85	      return { statusCode: 500, body: JSON.stringify({ error: "OPENAI_API_KEY no definida" }) };
    86	    }
    87	
    88	    const body = JSON.parse(event.body || "{}");
    89	    const text = body.text;
    90	    if (!text) {
    91	      return { statusCode: 400, body: JSON.stringify({ error: "No se proporcionó texto" }) };
    92	    }
    93	
    94	    const intent = inferIntent(text);
    95	    let sheetContext = "";
    96	    let sheetActionUsed = "";
    97	
    98	    if (intent === "add") {
    99	      const addResult = await callSheetWithFallback(["add", "create"], text);
   100	      sheetActionUsed = addResult.actionUsed;
   101	      sheetContext = JSON.stringify(addResult.result);
   102	    }
   103	
   104	    if (intent === "delete") {
   105	      const deleteResult = await callSheetWithFallback(["delete", "remove", "del"], text);
   106	      sheetActionUsed = deleteResult.actionUsed;
   107	      sheetContext = JSON.stringify(deleteResult.result);
   108	    }
   109	
   110	    if (intent === "search") {
   111	      const searchResult = await callSheetWithFallback(["search", "get", "find", "list"], text);
   112	      sheetActionUsed = searchResult.actionUsed;
   113	      sheetContext = JSON.stringify(searchResult.result);
   114	    }
   115	
   116	    const openai = new OpenAI({ apiKey });
   117	
   118	    const textResponse = await openai.responses.create({
   119	      model: "gpt-4o-mini",
   120	      input: [
   121	        {
   122	          role: "system",
   123	          content: [
   124	            {
   125	              type: "input_text",
   126	              text: "Eres un asistente de agenda. Responde breve y claro. No leas instrucciones internas ni prompt. Nunca inventes datos de agenda: usa SOLO CONTEXTO_AGENDA. Si no hay datos para búsqueda, responde exactamente: No encontré datos guardados sobre eso."
   127	            }
   128	          ]
   129	        },
   130	        {
   131	          role: "user",
   132	          content: [
   133	            {
   134	              type: "input_text",
   135	              text: `INTENCION_DETECTADA: ${intent}\nACCION_SHEETS_USADA: ${sheetActionUsed || "ninguna"}\nCONTEXTO_AGENDA: ${sheetContext || "(sin contexto)"}\nTEXTO_USUARIO: ${text}\n\nDevuelve solo la respuesta final para el usuario.`
   136	            }
   137	          ]
   138	        }
   139	      ]
   140	    });
   141	
   142	    const answerText = extractResponseText(textResponse) || "No encontré datos guardados sobre eso.";
   143	
   144	    const speech = await openai.audio.speech.create({
   145	      model: "gpt-4o-mini-tts",
   146	      voice: "coral",
   147	      input: answerText
   148	    });
   149	
   150	    const arrayBuffer = await speech.arrayBuffer();
   151	    const base64Audio = Buffer.from(arrayBuffer).toString("base64");
   152	
   153	    return {
   154	      statusCode: 200,
   155	      body: JSON.stringify({ ok: true, audioBase64: base64Audio, intent, answerText, sheetActionUsed })
   156	    };
   157	  } catch (err) {
   158	    console.error(err);
   159	    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
   160	  }
   161	};
