import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import webpush from 'web-push';

const directory = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR;
if (!directory) throw new Error('Set DATA_DIR for local use or attach a Railway volume.');
mkdirSync(directory, {recursive:true});
const db = new DatabaseSync(join(directory,'ministry.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS devices (key TEXT PRIMARY KEY, data TEXT NOT NULL, etag TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, data TEXT NOT NULL);`);

const read = db.prepare('SELECT data,etag FROM devices WHERE key=?');
const insert = db.prepare('INSERT OR IGNORE INTO devices VALUES(?,?,?)');
const update = db.prepare('UPDATE devices SET data=?,etag=? WHERE key=? AND etag=?');
const remove = db.prepare('DELETE FROM devices WHERE key=?');
const keys = db.prepare('SELECT key FROM devices');
export const deviceKeys = () => keys.all().map(row => row.key);
const store = {
  getWithMetadata(key) {
    const row = read.get(key);
    return row && {data:JSON.parse(row.data),etag:row.etag};
  },
  setJSON(key,value,condition) {
    const etag = randomUUID();
    const data = JSON.stringify(value);
    const result = condition.onlyIfNew ? insert.run(key,data,etag) : update.run(data,etag,key,condition.onlyIfMatch);
    return {modified:result.changes === 1,etag};
  },
  delete(key) {remove.run(key);}
};
export const devices = () => store;
export function appKeys() {
  const readKeys = db.prepare("SELECT data FROM config WHERE key='vapid'");
  const row = readKeys.get();
  if (row) return JSON.parse(row.data);
  db.prepare("INSERT OR IGNORE INTO config VALUES('vapid',?)").run(JSON.stringify(webpush.generateVAPIDKeys()));
  return JSON.parse(readKeys.get().data);
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
