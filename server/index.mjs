import express from 'express';
import {fileURLToPath} from 'node:url';
import reminders from './reminders.mjs';
import research from './research.mjs';
import sendDue from './send-reminders.mjs';

const app = express();
const port = Number(process.env.PORT || 3000);
const origin = process.env.PUBLIC_ORIGIN || (process.env.RAILWAY_PUBLIC_DOMAIN
  ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:' + port);
app.disable('x-powered-by');
app.get('/health', (_req,res) => res.type('text').send('OK'));
app.use('/api', express.text({type:() => true,limit:'100kb'}));
function route(handler) {
  return async (req,res) => {
    const url = new URL(origin);
    const incoming = new URL(req.originalUrl, origin);
    url.pathname = incoming.pathname;
    url.search = incoming.search;
    const headers = new Headers();
    for (const name of ['authorization','content-type','origin']) {
      if (req.get(name)) headers.set(name,req.get(name));
    }
    const request = new Request(url,{method:req.method,headers,body:req.method==='POST' ? req.body : undefined});
    const result = await handler(request);
    res.status(result.status);
    result.headers.forEach((value,key) => res.set(key,value));
    res.send(await result.text());
  };
}
app.get('/api/research',route(research));
app.get('/api/reminders',route(reminders));
app.post('/api/reminders',route(reminders));
app.use(express.static(fileURLToPath(new URL('../site/',import.meta.url)),{
  setHeaders(res,path) {
    if (path.endsWith('/sw.js') || path.endsWith('/index.html')) res.set('Cache-Control','no-cache');
    if (path.endsWith('.webmanifest')) res.type('application/manifest+json');
  }
}));
let running = false;
async function tick() {
  if (running) return;
  running = true;
  try { await sendDue(origin); }
  catch { console.error('Reminder scheduler will retry.'); }
  finally { running = false; }
}
app.listen(port,'0.0.0.0',() => { void tick(); setInterval(tick,30000); });
