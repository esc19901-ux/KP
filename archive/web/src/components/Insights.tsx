import { useEffect, useState } from 'react'
import { loadInsights } from '../data'
import type { Insights, Segment } from '../types'

const BADGE = {
  quote: ['Schülerzitat', 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'],
  interpretation: ['KI-Interpretation', 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'],
  stat: ['Auswertung', 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200'],
} as const

export function Refs({ refs, onJump }: { refs: number[]; onJump(id: number): void }) {
  return <span className="inline-flex flex-wrap gap-1 ml-1 align-middle">{refs.slice(0, 8).map(r => <button key={r} onClick={() => onJump(r)} className="text-[11px] px-1.5 rounded bg-[var(--wa-head)] text-[var(--wa-green)] hover:underline">#{r}</button>)}</span>
}
export const Badge = ({ kind }: { kind: keyof typeof BADGE }) => <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded mr-2 ${BADGE[kind][1]}`}>{BADGE[kind][0]}</span>

export function InsightsPanel({ onJump }: { onJump(id: number): void }) {
  const [data, setData] = useState<Insights | null | undefined>(undefined)
  useEffect(() => { loadInsights().then(setData) }, [])
  if (data === undefined) return <div className="p-6 text-[var(--wa-sub)]">Lade …</div>
  if (!data) return <div className="p-6 text-[var(--wa-sub)]">Noch keine Auswertung veröffentlicht (insights.json fehlt).</div>
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-8">
      <p className="text-xs text-[var(--wa-sub)]">Methode: {data.method} · erstellt {data.generated}. <b>Schülerzitat</b> = wörtlich aus dem Chat, <b>Auswertung</b> = Zählung/Gruppierung, <b>KI-Interpretation</b> = Zusammenfassung durch ein Sprachmodell (kann Fehler enthalten). Verweise (#Nr.) öffnen die Originalnachricht.</p>
      {data.sections.map(s => (
        <section key={s.id}>
          <h2 className="text-lg font-semibold mb-1">{s.title}</h2>
          {s.note && <p className="text-xs text-[var(--wa-sub)] mb-2">{s.note}</p>}
          <ul className="space-y-2">
            {s.items.map((it, i) => (
              <li key={i} className="text-sm rounded-lg bg-[var(--wa-head)] p-3">
                <Badge kind={it.kind} />{it.label && <b className="mr-1">{it.label}</b>}{it.count ? <span className="text-[var(--wa-sub)] mr-1">×{it.count}</span> : null}
                <span className="whitespace-pre-wrap">{it.text}</span><Refs refs={it.refs} onJump={onJump} />
              </li>))}
          </ul>
        </section>))}
    </div>
  )
}

export function AskPanel({ onJump }: { onJump(id: number): void }) {
  const endpoint = import.meta.env.VITE_AI_ENDPOINT as string | undefined
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<{ q: string; segs?: Segment[]; err?: string }[]>([])
  async function ask() {
    if (!q.trim() || !endpoint) return
    const question = q.trim(); setQ(''); setBusy(true); setLog(l => [...l, { q: question }])
    try {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) })
      if (!r.ok) throw new Error(r.status === 429 ? 'Zu viele Anfragen, bitte später erneut versuchen.' : 'Fehler ' + r.status)
      const { segments } = await r.json() as { segments: Segment[] }
      setLog(l => l.map((e, i) => i === l.length - 1 ? { ...e, segs: segments } : e))
    } catch (e) { setLog(l => l.map((x, i) => i === l.length - 1 ? { ...x, err: (e as Error).message } : x)) }
    setBusy(false)
  }
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold mb-1">Fragen an den Chat</h2>
      <p className="text-xs text-[var(--wa-sub)] mb-4">Die Antworten stützen sich auf Suchtreffer im Chat. <Badge kind="quote" /> sind wörtliche Aussagen, <Badge kind="interpretation" /> sind Deutungen der KI. Bitte prüfe Prüfungsinhalte immer an offiziellen Quellen.</p>
      {!endpoint && <div className="p-3 rounded bg-amber-100 text-amber-900 text-sm mb-4">KI-Assistent ist nicht konfiguriert (VITE_AI_ENDPOINT fehlt).</div>}
      <div className="space-y-4 mb-4">
        {log.map((e, i) => (
          <div key={i}><div className="text-sm font-medium mb-1">🙋 {e.q}</div>
            {e.err ? <div className="text-sm text-red-600">{e.err}</div> : e.segs ? <div className="space-y-2">{e.segs.map((s, k) => (
              <div key={k} className="text-sm rounded-lg bg-[var(--wa-head)] p-3"><Badge kind={s.type} /><span className="whitespace-pre-wrap">{s.type === 'quote' ? '„' + s.text + '“' : s.text}</span><Refs refs={s.refs} onJump={onJump} /></div>))}</div>
              : <div className="text-sm text-[var(--wa-sub)]">Denke nach …</div>}
          </div>))}
      </div>
      <div className="flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && !busy && ask()} disabled={!endpoint || busy} placeholder="z. B. Welche Fragen wurden in Pharmakologie gestellt?" className="flex-1 rounded-lg bg-[var(--wa-head)] px-3 py-2 text-sm outline-none" />
        <button onClick={ask} disabled={!endpoint || busy || !q.trim()} className="px-4 rounded-lg bg-[var(--wa-green)] text-white text-sm disabled:opacity-40">Fragen</button>
      </div>
    </div>
  )
}
