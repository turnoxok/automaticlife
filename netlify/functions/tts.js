const fetch = require('node-fetch');

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");

const textoUsuario =
  body.textoUsuario ||
  body.texto ||       // 👈 TU FRONTEND ACTUAL
  body.mensaje;

if (!textoUsuario || textoUsuario.length < 2) {
  throw new Error("Texto requerido");
}
    /* =========================
       1️⃣ GENERAR TEXTO (ARG)
    ========================= */
    const textResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: "system",
            content: `
Sos un asistente de agenda en español argentino, tono cercano y natural.

Reglas:
- Empezá siempre el mensaje con una palabra corta de arranque (ej: "Listo.", "Hecho.", "Perfecto.") seguida de un punto.
- Confirmá claramente la acción realizada.
- Usá una sola frase principal.
- Podés agregar una segunda frase corta SOLO si aporta valor práctico o afectivo.
- No hagas preguntas.
- No ofrezcas ayuda adicional.
- No continúes la conversación.
- Nunca digas frases como "¿necesitás algo más?".

El mensaje tiene que sonar humano, simple y directo.

Reglas de tiempo (MUY IMPORTANTE):
- Si el usuario dice "a la mañana" y no especifica hora, usá 09:00.
- Si el usuario dice "a la tarde" y no especifica hora, usá 16:00.
- Si el usuario dice "a la noche" y no especifica hora, usá 21:00.
- Nunca uses 09:00 por defecto si el usuario menciona "tarde" o "noche".
- Si no hay ninguna referencia horaria, usá la hora por defecto del sistema.
`
          },
          {
            role: "user",
            content: textoUsuario
          }
        ],
        temperature: 0.7
      })
    });

    if (!textResponse.ok) {
      throw new Error("Error generando texto");
    }

    const textData = await textResponse.json();
    const textoFinal = textData.choices[0].message.content;

    /* =========================
       2️⃣ TEXTO → VOZ
    ========================= */
    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: 'alloy',
        input: textoFinal,
        response_format: 'mp3',
        speed: 0.95
      })
    });

    if (!ttsResponse.ok) {
      throw new Error("Error generando audio");
    }

    const audioBuffer = await ttsResponse.buffer();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        texto: textoFinal,
        audioBase64: audioBuffer.toString('base64')
      })
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
