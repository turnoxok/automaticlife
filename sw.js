self.addEventListener('push', event => {
  const data = event.data.json();
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Olvidex', {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      requireInteraction: true,
      actions: [
        { action: 'completar', title: '✓ Listo' },
        { action: 'posponer', title: '+10 min' }
      ]
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'completar') {
    // Notificar a la app
    self.clients.matchAll({ type: 'window' }).then(clients => {
      clients.forEach(c => c.postMessage({ 
        type: 'COMPLETAR', 
        body: event.notification.body 
      }));
    });
  } else if (event.action === 'posponer') {
    // Posponer 10 minutos - la app principal lo maneja
  } else {
    self.clients.openWindow('/');
  }
});
