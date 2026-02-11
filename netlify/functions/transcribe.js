const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.handler = async (event) => {
  try {
    const boundary = event.headers["content-type"].split("boundary=")[1];
    const body = Buffer.from(event.body, "base64");

    // extrae el archivo del form-data (simple y efectivo)
    const start = body.indexOf("\r\n\r\n") + 4;
    const end = body.lastIndexOf(`\r\n--${boundary}--`);
    const audioBuffer = body.slice(start, end);

    const filePath = "/tmp/audio.webm";
    fs.writeFileSync(filePath, audioBuffer);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "es",
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ text: transcription.text }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
