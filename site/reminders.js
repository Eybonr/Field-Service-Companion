(() => {
  const url = '/api/reminders';
  const identity = 'ministry-reminder-device';
  const button = document.querySelector('#toggleAlerts');
  const status = document.querySelector('#alertStatus');
  const panel = document.querySelector('#reminderPanel');
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  let queue = Promise.resolve();
  let lastSync = '';
  let busy = false;

  function appointments() {
    const studies = state.students.map(record => ({record, kind:'study', time:record.studyReminder}));
    const visits = state.returnVisits.map(record => ({record, kind:'visit', time:record.visitTime && record.nextVisit && record.nextVisit+'T'+record.visitTime}));
    return [...studies,...visits].map(item => ({...item, at:Date.parse(item.time)}))
      .filter(item => Number.isFinite(item.at)).sort((a,b) => a.at-b.at);
  }
  function renderList() {
    const list = document.querySelector('#alertList');
    list.replaceChildren();
    for (const item of appointments()) {
      const row = document.createElement('li');
      const link = document.createElement('button');
      link.className = 'text-left underline';
      link.textContent = (item.kind === 'study' ? 'Bible study' : 'Return visit') + ' · ' + item.record.name + ' · ' + new Date(item.at).toLocaleString();
      link.onclick = () => item.kind === 'study' ? openStudentModal(item.record.id) : openVisitModal(item.record.id);
      row.append(link);
      const reminder = document.createElement('p');
      reminder.className = 'text-xs text-slate-500';
      reminder.textContent = 'Reminder · ' + new Date(item.at - 3600000).toLocaleString();
      row.append(reminder);
      list.append(row);
    }
    if (!list.childElementCount) list.textContent = 'No reminders scheduled.';
  }
  function updateButton() {
    button.disabled = busy || !supported;
    button.textContent = localStorage.getItem(identity) ? 'Turn off notifications' : 'Enable notifications';
  }
  async function post(secret,body) {
    const response = await fetch(url,{method:'POST',headers:{'Authorization':'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if (!response.ok) throw new Error('Could not save the reminder schedule. Check your connection and try again.');
  }
  async function sync() {
    const device = localStorage.getItem(identity);
    if (!device || !supported) return;
    if (Notification.permission !== 'granted') throw new Error('Notifications are blocked. Allow them in your device settings.');
    const registration = await navigator.serviceWorker.getRegistration();
    const sub = await registration?.pushManager.getSubscription();
    if (!sub) throw new Error('Turn notifications off and enable them again to reconnect this device.');
    const events = appointments().filter(e => e.at > Date.now()-86400000).map(({at,kind}) => ({at,kind}));
    const payload = {subscription:sub.toJSON(),events};
    const signature = JSON.stringify(payload);
    if (signature !== lastSync) await post(device,payload);
    lastSync = signature;
    status.textContent = 'Notifications are on. Your reminders are synced.';
  }
  function scheduleSync() {
    renderList();
    queue = queue.then(sync).catch(error => {status.textContent = error.message; lastSync = '';});
    return queue;
  }
  button.onclick = async () => {
    if (busy) return;
    busy = true;
    updateButton();
    try {
      let device = localStorage.getItem(identity);
      if (device) {
        await queue;
        await post(device,{disable:true});
        localStorage.removeItem(identity);
        lastSync = '';
        const reg = await navigator.serviceWorker.getRegistration();
        await (await reg?.pushManager.getSubscription())?.unsubscribe();
        status.textContent = 'Notifications are off on this device.';
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('Permission was not granted. Allow notifications in device settings to receive reminders.');
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        const response = await fetch(url,{cache:'no-store'});
        if (!response.ok) throw new Error('The reminder service is unavailable. Try again after deployment.');
        const {publicKey} = await response.json();
        const key = Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
        await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
        device = Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2,'0')).join('');
        localStorage.setItem(identity,device);
        await scheduleSync();
      }
    } catch (error) {status.textContent = error.message;}
    finally {busy = false; updateButton();}
  };
  if (!supported) status.textContent = 'On iPhone, add this site to your Home Screen and open it there. Use a browser that supports web notifications.';
  else if (!localStorage.getItem(identity)) status.textContent = 'Enable alerts on each device where you want reminders.';
  function openPanel() {
    if (location.hash === '#reminders') {panel.open = true; panel.scrollIntoView();}
  }
  window.addEventListener('online',scheduleSync);
  window.addEventListener('records-saved',scheduleSync);
  window.addEventListener('hashchange',openPanel);
  window.addEventListener('storage',event => {
    if (event.key === STORAGE_KEY) {state = loadState(); render(); scheduleSync();}
    if (event.key === identity) updateButton();
  });
  document.addEventListener('visibilitychange',() => {if (!document.hidden) scheduleSync();});
  setInterval(() => {if (!document.hidden && !busy && !lastSync) scheduleSync();},60000);
  updateButton();
  scheduleSync();
  openPanel();
})();
