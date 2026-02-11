// netlify/functions/transcribe.js
const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

exports.handler = async (event, context) => {
  try {
    const { audioBase64 } = JSON.parse(event.body);
    if (!audioBase64) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: "No audio" }) };
    }

    // Convertir base64 a buffer
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Llamar a OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioBuffer,
      model: "gpt-4o-mini-transcribe",
      response_format: "json"
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, text: transcription.text })
    };
  } catch (err) {
    console.error("Error transcribing audio:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
