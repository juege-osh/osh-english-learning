'use strict';
// Installation support only: authenticated data and vocabulary always use the network.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
