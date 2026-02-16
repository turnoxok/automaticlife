// Service Worker para notificaciones push y recordatorios
const CACHE_NAME = 'automatic-life-v1';

self.addEventListener('install', event => {
  console.log('SW instalado');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('SW activado');
  return self.clients.claim();
});

// Escuchar push notifications
self.addEventListener('push', event => {
  console.log('Push recibido:', event);
  
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'Recordatorio',
      body: event.data.text(),
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: 'reminder-' + Date.now(),
      requireInteraction: true,
      actions: [
        { action: 'completar', title: '✓ Completar' },
        { action: 'posponer', title: '⏰ +10 min' }
      ]
    };
  }
  
  const options = {
    body: data.body || 'Tienes un recordatorio pendiente',
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/badge-72x72.png',
    tag: data.tag || 'reminder',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || [
      { action: 'completar', title: '✓ Completar' },
      { action: 'posponer', title: '⏰ +10 min' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Automatic Life', options)
  );
  
  // Notificar a la ventana principal
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'REMINDER_TRIGGERED',
          message: data.body || 'Recordatorio'
        });
      });
    })
  );
});

// Manejar clicks en notificaciones
self.addEventListener('notificationclick', event => {
  console.log('Notificación clickeada:', event.action);
  
  event.notification.close();
  
  if (event.action === 'completar') {
    // Marcar como completado
    console.log('Marcar como completado');
  } else if (event.action === 'posponer') {
    // Posponer 10 minutos
    console.log('Posponer 10 minutos');
  } else {
    // Abrir app
    event.waitUntil(
      self.clients.openWindow('/')
    );
  }
});

// Sincronización en background (para cuando vuelve la conexión)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-reminders') {
    event.waitUntil(syncReminders());
  }
});

async function syncReminders() {
  console.log('Sincronizando recordatorios...');
  // Aquí podrías sincronizar recordatorios pendientes
}
