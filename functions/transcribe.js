import fetch from "node-fetch";
import FormData from "form-data";

export async function handler(event) {
  try {
    const buffer = Buffer.from(event.body, "base64");

    const form = new FormData();
    form.append("file", buffer, {
      filename: "audio.webm",
      contentType: "audio/webm"
    });
    form.append("model", "whisper-1");
    form.append("language", "es");

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: form,
      }
    );

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify({ text: data.text }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
