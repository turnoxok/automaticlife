import { OpenAI } from "openai";

export const handler = async (event) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "OPENAI_API_KEY no definida" })
      };
    }

    const body = JSON.parse(event.body || "{}");
    const base64Audio = body.audio || event.body;

    if (!base64Audio) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No se proporcionó audio" })
      };
    }

    // Convertir base64 a buffer
    const buffer = Buffer.from(base64Audio, "base64");

    // Crear FormData manualmente
    const boundary = "----FormBoundary" + Math.random().toString(36).substring(2);
    const formData = [];
    
    // Campo file
    formData.push(`--${boundary}\r\n`);
    formData.push(`Content-Disposition: form-data; name="file"; filename="audio.webm"\r\n`);
    formData.push(`Content-Type: audio/webm\r\n\r\n`);
    formData.push(buffer);
    formData.push(`\r\n`);
    
    // Campo model
    formData.push(`--${boundary}\r\n`);
    formData.push(`Content-Disposition: form-data; name="model"\r\n\r\n`);
    formData.push(`whisper-1\r\n`);
    
    // Campo language
    formData.push(`--${boundary}\r\n`);
    formData.push(`Content-Disposition: form-data; name="language"\r\n\r\n`);
    formData.push(`es\r\n`);
    
    // Campo response_format
    formData.push(`--${boundary}\r\n`);
    formData.push(`Content-Disposition: form-data; name="response_format"\r\n\r\n`);
    formData.push(`json\r\n`);
    
    formData.push(`--${boundary}--\r\n`);

    // Unir todo
    const formDataBuffer = Buffer.concat(
      formData.map(part => Buffer.isBuffer(part) ? part : Buffer.from(part, 'utf8'))
    );

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": formDataBuffer.length
      },
      body: formDataBuffer
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Whisper API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        text: data.text || "",
        language: data.language || "es"
      })
    };

  } catch (err) {
    console.error("Error en transcripción:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: "Error al transcribir el audio",
        details: err.message
      })
    };
  }
};
