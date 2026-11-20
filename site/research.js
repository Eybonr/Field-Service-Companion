const researchPanel = (() => {
  const panel = document.createElement('section');
  panel.className = 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4';
  panel.innerHTML = `
    <h2 class="text-xl font-bold">Field service research</h2>
    <form role="search" class="space-y-2">
      <label for="researchQuery" class="text-sm">Enter a question, keywords, or a scripture.</label>
      <div class="flex gap-2"><input id="researchQuery" type="search" required maxlength="200" placeholder="Why does God allow suffering?" class="min-w-0 flex-1 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
      <button class="rounded-xl bg-brand-600 text-white px-4 font-semibold">Search</button></div>
    </form>
    <div class="flex flex-wrap gap-2" aria-label="Suggested searches"></div>
    <div data-topics></div><div data-library></div><div data-links class="space-y-2"></div>
  `;
  const form = panel.querySelector('form');
  const input = form.querySelector('input');
  const suggestions = panel.querySelector('[aria-label="Suggested searches"]');
  const topics = panel.querySelector('[data-topics]');
  const library = panel.querySelector('[data-library]');
  library.setAttribute('aria-live','polite');
  const links = panel.querySelector('[data-links]');
  let version = 0;
  let controller;
  function element(tag, text, classes) {
    const node = document.createElement(tag);
    node.className = classes;
    node.textContent = text;
    return node;
  }
  function link(title, address) {
    const node = element('a', title, 'text-brand-700 dark:text-teal-300 underline');
    node.href = address;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    return node;
  }
  function searchLink(base, query) {
    const url = new URL(base);
    url.searchParams.set('q', query);
    return url.href;
  }
  function heading(text) { return element('h3',text,'font-bold text-sm mb-2'); }
  function words(text) {
    return text.toLowerCase().normalize('NFKD').replace(/[’']/g,'').match(/[a-z0-9]+/g) || [];
  }
  const common = new Set(words('a an the is it of for what why when where in on does do did how who that are will be to and my me i can we with you our us there about'));
  function showTopics(query) {
    topics.replaceChildren();
    const terms = [...new Set(words(query).filter(t => !common.has(t)))];
    const ranked = researchTopics.map(topic => {
      const index = new Set(words([topic.title,topic.keywords,...topic.verses.map(v=>v[0])].join(' ')));
      return {topic,score:terms.filter(t => index.has(t)).length};
    }).filter(r => r.score && (r.score > 1 || terms.length < 2 || terms.some(t=>t.length>3 && !['god','bible','jesus'].includes(t) && words(r.topic.title+' '+r.topic.keywords).includes(t))));
    ranked.sort((a,b)=>b.score-a.score);
    if (ranked.length) topics.append(heading('Bible Questions Answered · JW.org'));
    for (const {topic} of ranked.slice(0,3)) {
      const card = element('article','','border-t border-slate-200 dark:border-slate-700 py-3');
      card.append(link(topic.title,topic.url));
      const verses = element('p','','text-sm mt-1');
      verses.append('Read in JW Library: ');
      topic.verses.forEach(([title,path],i) => {
        if (i) verses.append(' · ');
        const passage = path.split('#v')[1].replace('-v', '-');
        const verseLink = link(title, 'jwlibrary:///finder?' + new URLSearchParams({wtlocale:'E', bible:passage}));
        verseLink.removeAttribute('target');
        const webLink = link('JW.org', new URL(path, 'https://www.jw.org').href);
        webLink.setAttribute('aria-label', 'Read ' + title + ' on JW.org');
        verses.append(verseLink, ' (', webLink, ')');
      });
      card.append(verses);
      topics.append(card);
    }
  }
  async function search() {
    const query = input.value.trim();
    if (!query) {input.focus(); return;}
    const current = ++version;
    controller?.abort();
    controller = new AbortController();
    showTopics(query);
    const wol = searchLink('https://wol.jw.org/en/wol/s/r1/lp-e',query);
    const jw = searchLink('https://www.jw.org/en/search/',query);
    links.replaceChildren();
    for (const [title,url] of [['See all results in Watchtower ONLINE LIBRARY',wol],['Search JW.org for this question',jw]]) {
      const row = document.createElement('p');
      row.append(link(title,url));
      links.append(row);
    }
    library.textContent = 'Searching Watchtower ONLINE LIBRARY…';
    try {
      const response = await fetch('/api/research?'+new URLSearchParams({q:query}),{signal:controller.signal});
      if (!response.ok) throw new Error();
      const results = await response.json();
      if (current !== version) return;
      library.replaceChildren(heading('Watchtower ONLINE LIBRARY'));
      if (!results.length) library.append('No publication titles found. Try fewer words or open the full library search below.');
      for (const hit of results) {
        const row = element('article','','border-t border-slate-200 dark:border-slate-700 py-2');
        row.append(link(hit.title,hit.url));
        if (hit.reference) row.append(element('p',hit.reference,'text-sm text-slate-500 dark:text-slate-400'));
        library.append(row);
      }
    } catch {
      if (current === version) library.textContent = 'Live results are unavailable. Open the official search below when connected.';
    }
  }
  form.addEventListener('submit',e => {e.preventDefault();search();});
  for (const example of ['Suffering','Resurrection','Prayer','God’s Kingdom']) {
    const button = element('button',example,'rounded-full px-3 py-1 bg-slate-100 dark:bg-slate-800 text-sm');
    button.type = 'button';
    button.onclick = () => {input.value = example;search();};
    suggestions.append(button);
  }
  return panel;
})();
