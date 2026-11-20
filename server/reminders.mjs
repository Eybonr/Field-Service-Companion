import {createHash} from 'node:crypto';
import {appKeys,devices,validSubscription} from './reminder-store.mjs';
export default async function handler(req) {
  if (req.method === 'GET') return Response.json({publicKey:(await appKeys()).publicKey}, {headers:{'Cache-Control':'no-store'}});
  if (req.method !== 'POST' || req.headers.get('origin') !== new URL(req.url).origin) return new Response(null,{status:403});
  const secret = req.headers.get('authorization') || '';
  if (!/^Bearer [a-f0-9]{64}$/.test(secret)) return new Response(null,{status:401});
  const key = createHash('sha256').update(secret).digest('hex');
  const raw = await req.text();
  if (raw.length > 100000) return new Response(null,{status:413});
  let body;
  try { body = JSON.parse(raw); } catch { return new Response(null,{status:400}); }
  const store = devices();
  if (body?.disable === true) {
    await store.delete(key);
    return new Response(null,{status:204});
  }
  if (!validSubscription(body?.subscription) || !Array.isArray(body.events) || body.events.length > 1000 ||
    !body.events.every(e => e && ['visit','study'].includes(e.kind) && Number.isSafeInteger(e.at))) return new Response(null,{status:400});
  const previous = await store.getWithMetadata(key,{type:'json'});
  const events = body.events.map(({kind,at}) => ({kind,at,sent:previous?.data.events.some(e => e.kind === kind && e.at === at && e.sent) || false}));
  const {endpoint,keys:{auth,p256dh}} = body.subscription;
  const result = await store.setJSON(key,{subscription:{endpoint,keys:{auth,p256dh}},events,lease:previous?.data.lease || 0},
    previous ? {onlyIfMatch:previous.etag} : {onlyIfNew:true});
  return new Response(null,{status:result.modified ? 204 : 409});
}
