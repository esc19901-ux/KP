import MiniSearch from 'minisearch'
import type { Corpus, Insights, Meta, Msg } from './types'

const base = import.meta.env.BASE_URL + 'data/'
const j = async <T,>(p: string): Promise<T> => { const r = await fetch(base + p); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json() }
export const mediaUrl = (p: string) => base + p

export const loadMeta = () => j<Meta>('meta.json')
export const loadInsights = () => j<Insights>('insights.json').catch(() => null)

/** Months are separate files; for archives up to ~100k messages loading them all is fine because the UI is virtualised. */
export async function loadMessages(meta: Meta): Promise<Msg[]> {
  const parts = await Promise.all(meta.months.map(m => j<Msg[]>(`months/${m.month}.json`)))
  return parts.flat()
}

export const fmtDate = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
export const fmtTime = (t: string) => t.slice(11, 16)
const toDE = (d: string) => d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4)

export interface Hit { id: number; sender: number; t: string; text: string; score: number }
export interface SearchEngine { search(q: string, limit?: number): Hit[] }

export async function buildSearch(meta: Meta): Promise<SearchEngine> {
  const corpus = await j<Corpus>('search.json')
  const docs = corpus.map(([id, s, t, x]) => ({ id, s, t, x, who: s >= 0 ? meta.participants[s]?.name ?? '' : '', date: `${t.slice(0, 10)} ${toDE(t)}` }))
  const ms = new MiniSearch({ fields: ['x', 'who', 'date'], storeFields: ['s', 't', 'x'], idField: 'id',
    searchOptions: { prefix: true, fuzzy: 0.15, combineWith: 'AND', boost: { x: 2 } } })
  ms.addAll(docs)
  return {
    search(q, limit = 200) {
      const phrases = [...q.matchAll(/"([^"]+)"/g)].map(m => m[1].toLowerCase())
      const rest = q.replace(/"[^"]*"/g, ' ').trim()
      let hits: Hit[]
      if (rest) hits = ms.search(rest).map(r => ({ id: r.id, sender: r.s, t: r.t, text: r.x, score: r.score }))
      else hits = phrases.length ? docs.map(d => ({ id: d.id, sender: d.s, t: d.t, text: d.x, score: 0 })) : []
      if (phrases.length) hits = hits.filter(h => phrases.every(p => h.text.toLowerCase().includes(p)))
      return hits.slice(0, limit)
    }
  }
}
