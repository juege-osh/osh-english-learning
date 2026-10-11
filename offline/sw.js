'use strict';
const VERSION="93d19aa427953abb",CACHE='english-offline-'+VERSION,ASSETS=[{"name": "app-icon.svg", "sha256": "52465cad915402f816dc36170ca9785276a923f1ba662ad72a3dc2a77b1f81fc"}, {"name": "app.js", "sha256": "8c9be5790a56218f4bfbf30b237582bf20fa75752921ee78698fbf83cb48577f"}, {"name": "core.js", "sha256": "a6b7f2843d1f3f2e28ea81f79805174bb0bfb02c4f2cbb6931dcc78a85377f63"}, {"name": "game-effects.css", "sha256": "ec5a2f4291661c4806bfcf4dff2a6b4cd460de28714442f9e33085eececfa7ff"}, {"name": "game-effects.js", "sha256": "16b9771e71334600aca2fe59c210c34436d0d2274d0f97b47513f18b8c6c8b3e"}, {"name": "index.html", "sha256": "474117f36de42341c4832af6aad5cb6157ec80635463cd51bb27e2aa20c93d21"}, {"name": "manifest.webmanifest", "sha256": "c7e9ed2ca8d8002ff0e40c89adc6a111c5ca0c1bafe816f0b8ef754f94d4eed1"}, {"name": "run-controls.js", "sha256": "484dd4fa8398f3d02b2349ce86b13d8303468a43c9d6d7c405ccea6705a7ed95"}, {"name": "style.css", "sha256": "9ffc466adb2def2adae0ac858b64a3a143a98966260d300473a32e4e7409744b"}, {"name": "vocabulary.js", "sha256": "fe5a8ca5039a7fcd17437bdd495fde0c786eaded875aa709dfb1a93a26e18073"}, {"name": "install.js", "sha256": "e1da1bafd0c3ed0aeb25c12c024db1cab0d5c3fbbce2825fc3f77dd882514ed6"}];
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
