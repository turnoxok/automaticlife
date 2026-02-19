const webpush = require('web-push');

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
    const { subscription, title, body } = JSON.parse(event.body);
    
    if (!subscription || !subscription.endpoint) {
      throw new Error('Subscription inválida');
    }

    webpush.setVapidDetails(
      'mailto:tu@email.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const payload = JSON.stringify({
      title: title || 'Olvidex',
      body: body || 'Tienes un recordatorio'
    });

    await webpush.sendNotification(subscription, payload);
    
    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ ok: true }) 
    };
    
  } catch (err) {
    console.error('Push error:', err);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ ok: false, error: err.message }) 
    };
  }
};
