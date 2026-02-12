 1	const OpenAI = require("openai");
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
   162	
   163	module.exports = { handler };
