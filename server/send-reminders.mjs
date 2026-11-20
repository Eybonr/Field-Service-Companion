import webpush from 'web-push';
import {appKeys,devices,dispatch,deviceKeys} from './reminder-store.mjs';
export default async function sendDue(origin) {
  const store = devices();
  let vapid;
  const send = async (sub,events) => {
    vapid ||= await appKeys();
    const kinds = [...new Set(events.map(e => e.kind))];
    await webpush.sendNotification(sub,JSON.stringify({kinds,at:Math.min(...events.map(e => e.at))}),{
      TTL:3600, timeout:6000, vapidDetails:{subject:origin, ...vapid}
    });
  };
  const keys = deviceKeys();
  for (let i=0;i<keys.length;i+=12) {
    const results = await Promise.allSettled(keys.slice(i,i+12).map(key => dispatch(store,key,send)));
    if (results.some(result => result.status === 'rejected')) console.warn('Reminder delivery will be retried.');
  }
}
