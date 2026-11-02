// Notifications, imported into the generated service worker (vite.config.js workbox.importScripts). The server sends
// an EMPTY push (no payload); the words come from push.message (the 9 PM reminder every day: "not filled yet" or
// "filled ✓"; announcements; attendance notices), or, offline, from here. A new notification pops up and vibrates;
// an announcement already shown on this phone only refreshes quietly (Phase 9). A push address the browser renews is reported (push.renew).
/* eslint-env serviceworker */
(function () {
  function istWeekday(now) { return new Date(now.getTime() + 5.5 * 3600e3).getUTCDay(); }   // 0 = Sunday
  function reminder(now) {
    return istWeekday(now) === 0
      ? { title: 'Attendance and your week', body: "Mark today's class attendance and submit your week by Monday 9 PM." }
      : { title: "Hare Krishna! Today's sadhana", body: "Time to update today's sadhana. Tap to open it." };
  }
  self.__sadhanaReminder = reminder;
  // announcements shown on this phone (ann-<id>), kept in a small cache: true when this one was shown before
  function seenBefore(tag) {
    if (!/^ann-/.test(tag) || !self.caches) return Promise.resolve(false);
    var key = new Request('/__shown/' + tag);
    return caches.open('sr-shown').then(function (c) {
      return c.match(key).then(function (hit) { return hit ? true : c.put(key, new Response('1')).then(function () { return false; }); });
    }).catch(function () { return false; });
  }
  // the push carries no content: ask the server what this one is (the 9 PM reminder, an announcement, …);
  // if that fails (no network), show the reminder text chosen here
  var API = 'https://sadhana-record-api.iyfdelhi-sadhana.workers.dev/';
  function whatToShow() {
    return Promise.resolve().then(function () { return self.registration.pushManager.getSubscription(); }).then(function (sub) {
      if (!sub) throw new Error('no subscription');
      return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ v: 1, action: 'push.message', data: { endpoint: sub.endpoint } }) });
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok || !j.data || !j.data.title) throw new Error('no message');
      return j.data;
    });
  }
  self.addEventListener('push', function (event) {
    event.waitUntil(Promise.race([whatToShow(), new Promise(function (_, no) { setTimeout(function () { no(new Error('slow')); }, 6000); })])
      .catch(function () { var r = reminder(new Date()); return { title: r.title, body: r.body, url: '/#/home', tag: 'sadhana-reminder' }; })
      .then(function (m) {
        // Phase 9 (9 Oct 2026): an announcement this phone has already shown never pops up or vibrates again (a second
        // push for it — two registrations of one phone, a redelivery — only refreshes it quietly in the tray)
        var tag = m.tag || 'sadhana';
        return seenBefore(tag).then(function (again) {
          return self.registration.showNotification(m.title, {
            body: m.body, icon: '/icons/icon-192.png', badge: '/icons/maskable-192.png', tag: tag, renotify: !again,
            vibrate: again ? [] : [180, 90, 180], silent: again, timestamp: Date.now(), data: { url: m.url || '/#/home' },
          });
        });
      }));
  });
  // the browser renewed this phone's push address: move the server's row (and the person on it) to the new one
  self.addEventListener('pushsubscriptionchange', function (event) {
    var old = event.oldSubscription;
    event.waitUntil(Promise.resolve(event.newSubscription || self.registration.pushManager.subscribe(old ? old.options : { userVisibleOnly: true }))
      .then(function (sub) {
        var j = sub.toJSON();
        return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ v: 1, action: 'push.renew', requestId: 'renew-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10), data: { oldEndpoint: old ? old.endpoint : '', endpoint: j.endpoint, keys: j.keys } }) });
      }).catch(function () { /* the app re-registers the phone when it is next opened */ }));
  });
  self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    var url = (event.notification.data && event.notification.data.url) || '/#/home';
    if (!/^\/#\//.test(url)) url = '/#/home';                 // only ever a page of this app
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if ('focus' in c) return c.focus().then(function (w) { return (w || c).navigate ? (w || c).navigate(url) : w; }).catch(function () { return self.clients.openWindow(url); });
      }
      return self.clients.openWindow(url);
    }));
  });
})();
