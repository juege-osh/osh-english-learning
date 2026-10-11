'use strict';
const VERSION=__VERSION__,CACHE='english-offline-'+VERSION,ASSETS=__ASSETS__;
async function notify(data){for(const client of await self.clients.matchAll({includeUncontrolled:true}))client.postMessage(data);}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);let done=0;
 for(const asset of ASSETS){
  const response=await fetch(new URL(asset.name,self.registration.scope),{cache:'reload'});
  if(!response.ok)throw Error('Offline asset failed: '+asset.name);
  const bytes=await response.clone().arrayBuffer();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(digest!==asset.sha256)throw Error('Offline integrity failed: '+asset.name);
  await cache.put(new URL(asset.name,self.registration.scope),response);
  await notify({type:'OFFLINE_PROGRESS',done:++done,total:ASSETS.length});
 }
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{await self.clients.claim();await notify({type:'OFFLINE_READY'});})()));
self.addEventListener('message',event=>{if(event.data?.type==='CHECK_OFFLINE')event.waitUntil((async()=>{const cache=await caches.open(CACHE);const checks=await Promise.all(ASSETS.map(a=>cache.match(new URL(a.name,self.registration.scope))));event.source?.postMessage({type:checks.every(Boolean)?'OFFLINE_READY':'OFFLINE_MISSING'});})());});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url),scope=new URL(self.registration.scope);
 if(event.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const key=event.request.mode==='navigate'?new URL('index.html',scope):url;return await cache.match(key)||fetch(event.request);})());
});
