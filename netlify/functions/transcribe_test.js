// netlify/functions/transcribe_test.js
export const handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, text: "FUNCION NUEVA OK" })
  };
};
