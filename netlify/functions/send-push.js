// .netlify/functions/send-push.js
const webpush = require('web-push');
const fetch = require('node-fetch'); 

exports.handler = async (event, context) => {
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
    const { userId, message, title } = JSON.parse(event.body);

    // Configurar VAPID
    webpush.setVapidDetails(
      'mailto:tu-email@ejemplo.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    // Obtener suscripción del usuario desde Apps Script
    const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyxCVkoXs_wu5T7jKXtriMsJTryA6_XrCrW9I2qJGDWfFffwAOwRrzp38cEMz8XqN54/exec";
    
    const res = await fetch(SHEETS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getPushSubscription",
        userId: userId
      })
    });

    const data = await res.json();

    if (!data.subscription) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ ok: false, error: "Usuario sin suscripción push" })
      };
    }

    const subscription = JSON.parse(data.subscription);

    // Enviar notificación
    const payload = JSON.stringify({
      title: title || "LiliX",
      body: message,
      icon: "/icon-192x192.png",
      badge: "/badge-72x72.png",
      tag: "reminder-" + Date.now(),
      requireInteraction: true,
      actions: [
        { action: "completar", title: "✓ Completar" },
        { action: "posponer", title: "⏰ +10 min" }
      ]
    });

    await webpush.sendNotification(subscription, payload);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, message: "Notificación enviada" })
    };

  } catch (error) {
    console.error("Error enviando push:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
