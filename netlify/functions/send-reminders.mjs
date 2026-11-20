import webpush from 'web-push';
import {appKeys,devices,dispatch} from '../../server/reminder-store.mjs';
export const config = {schedule:'* * * * *'};
export default async function handler(req, context) {
  const store = devices();
  let vapid;
  const send = async (sub,events) => {
    vapid ||= await appKeys();
    const kinds = [...new Set(events.map(e => e.kind))];
    await webpush.sendNotification(sub,JSON.stringify({kinds,at:Math.min(...events.map(e => e.at))}),{
      TTL:3600, timeout:6000, vapidDetails:{subject:context.site.url || new URL(req.url).origin, ...vapid}
    });
  };
  for await (const page of store.list({paginate:true})) {
    for (let i=0;i<page.blobs.length;i+=12) {
      const results = await Promise.allSettled(page.blobs.slice(i,i+12).map(b => dispatch(store,b.key,send)));
      if (results.some(r => r.status === 'rejected')) console.warn('Reminder delivery will be retried.');
    }
  }
}
