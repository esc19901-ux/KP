import { useState } from 'react'
import type { Hit } from '../data'
import type { Meta } from '../types'

interface Props {
  meta: Meta; query: string; setQuery(q: string): void; hits: Hit[]; onHit(id: number): void
  participant: number | null; setParticipant(i: number | null): void
  from: string; to: string; setRange(f: string, t: string): void; onGoDate(d: string): void; onClose?: () => void
}
export const Avatar = ({ size = 49 }: { size?: number }) => (
  <span className="rounded-full bg-[#dfe5e7] grid place-items-center shrink-0 overflow-hidden" style={{ width: size, height: size }}>
    <svg viewBox="0 0 212 212" width={size} height={size}><path fill="#fff" d="M106 106c15 0 27-12 27-27S121 52 106 52 79 64 79 79s12 27 27 27zm0 13c-24 0-72 12-72 36v14h144v-14c0-24-48-36-72-36z" opacity=".95"/></svg>
  </span>)
const snippet = (t: string, q: string) => {
  const w = q.replace(/"/g, '').split(/\s+/).filter(Boolean)[0]?.toLowerCase()
  const i = w ? t.toLowerCase().indexOf(w) : 0
  const s = Math.max(0, i - 30)
  return (s ? '…' : '') + t.slice(s, s + 120).replace(/\s+/g, ' ')
}
const dmy = (d: string) => d.slice(0, 10).split('-').reverse().join('.')
const Chip = ({ on, children, ...r }: { on: boolean; children: React.ReactNode; onClick(): void }) =>
  <button {...r} className={`px-3 py-[5px] rounded-full text-[14px] border ${on ? 'bg-[#d9fdd3] text-[#008069] border-transparent' : 'bg-[#f0f2f5] text-[#54656f] border-transparent hover:bg-[#e9edef]'}`}>{children}</button>

export default function Sidebar(p: Props) {
  const [tab, setTab] = useState<'hits' | 'people' | 'date'>('people')
  const days = Object.keys(p.meta.days)
  const active = p.from || p.to || p.participant !== null
  const shown = p.query ? 'hits' : tab
  return (
    <div className="flex flex-col h-full bg-white border-r border-[#e9edef]">
      <div className="h-[59px] bg-[#f0f2f5] px-4 flex items-center gap-3 shrink-0">
        <Avatar size={40} />
        <div className="min-w-0 flex-1"><div className="font-medium text-[16px] truncate">{p.meta.title}</div></div>
        {p.onClose && <button className="text-[#54656f] text-2xl md:hidden" onClick={p.onClose} aria-label="Schließen">✕</button>}
      </div>
      <div className="px-3 py-2 bg-white">
        <div className="flex items-center gap-4 bg-[#f0f2f5] rounded-lg px-3 h-[35px]">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#54656f"><path d="M15.9 14.3H15l-.3-.3A6.5 6.5 0 1 0 14 15l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>
          <input value={p.query} onChange={e => p.setQuery(e.target.value)} placeholder="Suchen oder neuen Chat beginnen" className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-[#667781]" />
          {p.query && <button onClick={() => p.setQuery('')} className="text-[#54656f]">✕</button>}
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Chip on={shown === 'hits'} onClick={() => setTab('hits')}>Treffer{p.query ? ` ${p.hits.length}` : ''}</Chip>
          <Chip on={shown === 'people'} onClick={() => { setTab('people'); p.setQuery('') }}>Teilnehmer</Chip>
          <Chip on={shown === 'date'} onClick={() => { setTab('date'); p.setQuery('') }}>Datum</Chip>
          {active && <button className="text-[13px] text-[#008069] px-2" onClick={() => { p.setRange('', ''); p.setParticipant(null) }}>Filter löschen</button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin">
        {shown === 'hits' && (p.query
          ? p.hits.map(h => (
            <button key={h.id} onClick={() => p.onHit(h.id)} className="flex gap-3 w-full text-left px-3 hover:bg-[#f5f6f6]">
              <Avatar />
              <div className="flex-1 min-w-0 py-3 border-b border-[#e9edef]">
                <div className="flex justify-between"><span className="text-[16px] truncate">{p.meta.participants[h.sender]?.name ?? 'Gruppe'}</span><span className="text-[12px] text-[#667781] shrink-0 ml-2">{dmy(h.t)}</span></div>
                <div className="text-[13.5px] text-[#667781] truncate">{snippet(h.text, p.query)}</div>
              </div>
            </button>))
          : <div className="p-6 text-center text-[14px] text-[#667781]">Suche nach Wörtern, "Phrasen", Namen oder Datum.</div>)}
        {shown === 'people' && p.meta.participants.map((pt, i) => (
          <button key={i} onClick={() => p.setParticipant(p.participant === i ? null : i)} className={`flex gap-3 w-full text-left px-3 hover:bg-[#f5f6f6] ${p.participant === i ? 'bg-[#f0f2f5]' : ''}`}>
            <Avatar />
            <div className="flex-1 min-w-0 py-3 border-b border-[#e9edef] flex items-center justify-between"><span className="text-[16px] truncate">{pt.name}</span><span className="text-[12px] text-[#667781] ml-2">{pt.count}</span></div>
          </button>))}
        {shown === 'date' && (
          <div className="p-4 space-y-4 text-[14px] text-[#3b4a54]">
            <label className="block">Von<input type="date" value={p.from} min={days[0]} max={days.at(-1)} onChange={e => p.setRange(e.target.value, p.to)} className="mt-1 block w-full bg-[#f0f2f5] rounded-lg px-3 py-2" /></label>
            <label className="block">Bis<input type="date" value={p.to} min={days[0]} max={days.at(-1)} onChange={e => p.setRange(p.from, e.target.value)} className="mt-1 block w-full bg-[#f0f2f5] rounded-lg px-3 py-2" /></label>
            <label className="block">Zu Datum springen<input type="date" min={days[0]} max={days.at(-1)} onChange={e => e.target.value && p.onGoDate(e.target.value)} className="mt-1 block w-full bg-[#f0f2f5] rounded-lg px-3 py-2" /></label>
          </div>)}
      </div>
    </div>
  )
}
