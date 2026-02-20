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
    const { texto } = JSON.parse(event.body);

    if (!texto) {
      throw new Error('Texto requerido');
    }

    const textoFinal = `
Leé el siguiente texto con acento argentino rioplatense, entonación natural, cercana y humana.
Usá voseo cuando corresponda. Pausas suaves, sin tono neutro artificial.

${texto}
`;

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
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

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI error: ${errText}`);
    }

    const buffer = await response.buffer();

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ok: true,
        audioBase64: buffer.toString('base64'),
        formato: 'mp3'
      })
    };

  } catch (err) {
    console.error('TTS error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
