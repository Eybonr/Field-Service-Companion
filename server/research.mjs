import { load } from 'cheerio/slim';

const library = 'https://wol.jw.org';
export function publicationResults(html) {
  const $ = load(html);
  const results = [];
  const seen = new Set();
  $('.resultsContainer .results').each((_, group) => {
    const a = $(group).children('.caption').find('a.lnk').first();
    const href = a.attr('href');
    if (!href) return;
    const url = new URL(href, library);
    if (url.origin !== library || !url.pathname.startsWith('/en/wol/')) return;
    if (seen.has(url.pathname) || results.length >= 10) return;
    seen.add(url.pathname);
    results.push({ title: a.text().trim(), url: url.href, reference: $(group).find('.ref').first().text().trim() });
  });
  if (!results.length && !$('#searchResultsForm').length) throw new Error('Library search unavailable');
  return results;
}
export default async function handler(request) {
  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (request.method !== 'GET' || !q || q.length > 200) return new Response(null, {status:400});
  const url = new URL('/en/wol/s/r1/lp-e', library);
  url.searchParams.set('q', q);
  try {
    const response = await fetch(url, {signal:AbortSignal.timeout(6500), redirect:'error'});
    if (!response.ok) throw new Error('Library unavailable');
    return Response.json(publicationResults(await response.text()), {headers:{'Cache-Control':'public, max-age=300'}});
  } catch {
    return Response.json({error:'Library search unavailable'}, {status:503});
  }
}
