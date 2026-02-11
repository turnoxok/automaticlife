export const handler = async (event) => {
  try {
    // Solo POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "OPENAI_API_KEY no definida" }),
      };
    }

    // El body llega como base64
    const buffer = Buffer.from(event.body, "base64");

    // Armamos FormData
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([buffer], { type: "audio/webm" }),
      "audio.webm"
    );
    formData.append("model", "whisper-1");
    formData.append("language", "es");

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      }
    );

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        text: data.text || "",
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: err.message,
      }),
    };
  }
};
