import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function handler(event) {
  try {
    const { audioBase64 } = JSON.parse(event.body || "{}");
    if (!audioBase64) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: "No audio provided" }) };
    }

    const audioBuffer = Buffer.from(audioBase64, "base64");

    const transcript = await openai.audio.transcriptions.create({
      file: audioBuffer,
      model: "gpt-4o-mini-transcribe"
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, text: transcript.text })
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}
