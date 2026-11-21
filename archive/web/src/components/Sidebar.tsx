import { useMemo, useState } from 'react'
import { fmtDate, type Hit } from '../data'
import type { Meta } from '../types'

interface Props {
  meta: Meta; query: string; setQuery(q: string): void; hits: Hit[]; onHit(id: number): void
  participant: number | null; setParticipant(i: number | null): void
  from: string; to: string; setRange(f: string, t: string): void; onGoDate(d: string): void; onClose?: () => void
}
const snippet = (t: string, q: string) => {
  const w = q.replace(/"/g, '').split(/\s+/).filter(Boolean)[0]?.toLowerCase()
  const i = w ? t.toLowerCase().indexOf(w) : 0
  const s = Math.max(0, i - 40)
  return (s ? '…' : '') + t.slice(s, s + 140).replace(/\s+/g, ' ') + (t.length > s + 140 ? '…' : '')
}

export default function Sidebar(p: Props) {
  const [tab, setTab] = useState<'search' | 'people'>('search')
  const days = useMemo(() => Object.keys(p.meta.days), [p.meta])
  return (
    <div className="flex flex-col h-full bg-[var(--wa-panel)] border-r border-[var(--wa-line)]">
      <div className="bg-[var(--wa-head)] p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[var(--wa-green)] grid place-items-center text-white text-xl shrink-0">👥</div>
        <div className="min-w-0">
          <div className="font-semibold truncate">{p.meta.title}</div>
          <div className="text-xs text-[var(--wa-sub)]">{p.meta.total.toLocaleString('de-DE')} Nachrichten · {p.meta.participants.length} Teilnehmer</div>
          <div className="text-xs text-[var(--wa-sub)]">{p.meta.first.slice(0, 10).split('-').reverse().join('.')} – {p.meta.last.slice(0, 10).split('-').reverse().join('.')}</div>
        </div>
        {p.onClose && <button className="ml-auto text-2xl md:hidden" onClick={p.onClose} aria-label="Schließen">✕</button>}
      </div>
      <div className="p-2 border-b border-[var(--wa-line)]">
        <input value={p.query} onChange={e => p.setQuery(e.target.value)} placeholder='Suchen (Wörter, "Phrase", Name, Datum)'
          className="w-full rounded-lg bg-[var(--wa-head)] px-3 py-2 text-sm outline-none" />
        <div className="flex gap-2 mt-2 text-xs items-center">
          <label className="flex items-center gap-1">Von <input type="date" value={p.from} min={days[0]} max={days.at(-1)} onChange={e => p.setRange(e.target.value, p.to)} className="bg-[var(--wa-head)] rounded px-1 py-1" /></label>
          <label className="flex items-center gap-1">Bis <input type="date" value={p.to} min={days[0]} max={days.at(-1)} onChange={e => p.setRange(p.from, e.target.value)} className="bg-[var(--wa-head)] rounded px-1 py-1" /></label>
        </div>
        <div className="flex gap-2 mt-2 text-xs items-center">
          <label className="flex items-center gap-1">Zu Datum springen <input type="date" min={days[0]} max={days.at(-1)} onChange={e => e.target.value && p.onGoDate(e.target.value)} className="bg-[var(--wa-head)] rounded px-1 py-1" /></label>
          {(p.from || p.to || p.participant !== null) && <button className="ml-auto text-[var(--wa-green)]" onClick={() => { p.setRange('', ''); p.setParticipant(null) }}>Filter löschen</button>}
        </div>
      </div>
      <div className="flex text-sm border-b border-[var(--wa-line)]">
        {(['search', 'people'] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 ${tab === t ? 'border-b-2 border-[var(--wa-green)] font-medium' : 'text-[var(--wa-sub)]'}`}>{t === 'search' ? `Treffer${p.query ? ` (${p.hits.length})` : ''}` : 'Teilnehmer'}</button>)}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'search' && (p.query
          ? p.hits.map(h => (
            <button key={h.id} onClick={() => p.onHit(h.id)} className="block w-full text-left px-4 py-2 border-b border-[var(--wa-line)] hover:bg-[var(--wa-head)]">
              <div className="flex justify-between text-xs"><span style={{ color: p.meta.participants[h.sender]?.color }} className="font-medium truncate">{p.meta.participants[h.sender]?.name}</span><span className="text-[var(--wa-sub)] shrink-0 ml-2">{h.t.slice(0, 10).split('-').reverse().join('.')}</span></div>
              <div className="text-sm text-[var(--wa-sub)] line-clamp-2">{snippet(h.text, p.query)}</div>
            </button>))
          : <div className="p-4 text-sm text-[var(--wa-sub)]">Suchbegriff eingeben. Mit Anführungszeichen nach Phrasen suchen. Ein Klick auf einen Treffer springt zur Originalnachricht ({fmtDate(p.meta.last.slice(0, 10)).split(',')[0]} … neueste unten).</div>)}
        {tab === 'people' && p.meta.participants.map((pt, i) => (
          <button key={i} onClick={() => p.setParticipant(p.participant === i ? null : i)} className={`flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-[var(--wa-head)] ${p.participant === i ? 'bg-[var(--wa-head)]' : ''}`}>
            <span className="w-8 h-8 rounded-full grid place-items-center text-white text-xs shrink-0" style={{ background: pt.color }}>{pt.name.replace(/\D/g, '').slice(-2) || pt.name[0]}</span>
            <span className="flex-1 truncate text-sm">{pt.name}</span><span className="text-xs text-[var(--wa-sub)]">{pt.count}</span>
          </button>))}
      </div>
    </div>
  )
}
