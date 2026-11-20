import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
export const devices = () => getStore({name:'reminder-devices', consistency:'strong'});

export async function appKeys() {
  const store = getStore({name:'reminder-config', consistency:'strong'});
  const saved = await store.get('keys', {type:'json'});
  if (saved) return saved;
  const keys = webpush.generateVAPIDKeys();
  const result = await store.setJSON('keys', keys, {onlyIfNew:true});
  return result.modified ? keys : store.get('keys', {type:'json'});
}

export function validSubscription(sub) {
  try {
    const url = new URL(sub.endpoint);
    const providers = ['fcm.googleapis.com','web.push.apple.com','updates.push.services.mozilla.com'];
    const approved = providers.includes(url.hostname) || url.hostname.endsWith('.notify.windows.com') ||
      url.hostname.endsWith('.push.apple.com') || url.hostname.endsWith('.push.services.mozilla.com');
    return approved && url.protocol === 'https:' && !url.port && !url.username && !url.password &&
      url.pathname.length > 1 && /^[\w-]{87}$/.test(sub.keys.p256dh) && /^[\w-]{22}$/.test(sub.keys.auth);
  } catch { return false; }
}

export async function dispatch(store, key, send, now = Date.now()) {
  const entry = await store.getWithMetadata(key, {type:'json'});
  if (!entry) return;
  const {data, etag} = entry;
  const due = data.events.filter(e => !e.sent && e.at <= now && now - e.at < 86400000);
  if (!due.length || data.lease > now) return;
  const claim = await store.setJSON(key, {...data, lease:now + 90000}, {onlyIfMatch:etag});
  if (!claim.modified) return;
  try {
    await send(data.subscription, due);
  } catch (error) {
    if ([404,410].includes(error.statusCode)) await store.setJSON(key, {...data, events:[], lease:0}, {onlyIfMatch:claim.etag});
    else throw error;
    return;
  }
  // An edit during delivery can replace the lease. Mark only matching occurrences.
  for (let i = 0; i < 4; i++) {
    const current = await store.getWithMetadata(key,{type:'json'});
    if (!current) return;
    const events = current.data.events.map(e => due.some(d => d.kind === e.kind && d.at === e.at) ? {...e,sent:true} : e);
    const result = await store.setJSON(key,{...current.data,events,lease:0},{onlyIfMatch:current.etag});
    if (result.modified) return;
  }
}
