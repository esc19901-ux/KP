import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ChatView, { type ChatHandle } from './components/ChatView'
import Sidebar, { Avatar } from './components/Sidebar'
import { AskPanel, InsightsPanel } from './components/Insights'
import { buildSearch, loadMeta, loadMessages, type SearchEngine } from './data'
import type { Meta, Msg, Row } from './types'

type Tab = 'chat' | 'insights' | 'ask'

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [engine, setEngine] = useState<SearchEngine | null>(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<Tab>('chat')
  const [query, setQuery] = useState(''); const [participant, setParticipant] = useState<number | null>(null)
  const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const [flashId, setFlashId] = useState<number | null>(null)
  const [img, setImg] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false)
  const chat = useRef<ChatHandle>(null)
  const pending = useRef<number | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    (async () => {
      try { const m = await loadMeta(); setMeta(m); setMsgs(await loadMessages(m)); setEngine(await buildSearch(m)) }
      catch (e) { setErr((e as Error).message) }
    })()
  }, [])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []; let last = ''
    for (const m of msgs) {
      const d = m.t.slice(0, 10)
      if (participant !== null && m.s !== participant) continue
      if ((from && d < from) || (to && d > to)) continue
      if (d !== last) { out.push({ kind: 'date', date: d }); last = d }
      out.push({ kind: 'msg', msg: m })
    }
    return out
  }, [msgs, participant, from, to])
  const rowIndex = useMemo(() => new Map(rows.flatMap((r, i) => r.kind === 'msg' ? [[r.msg.id, i] as const] : [])), [rows])

  const hits = useMemo(() => (engine && query.trim() ? engine.search(query.trim()) : []), [engine, query])
  const hl = useMemo(() => query.replace(/"/g, '').split(/\s+/).filter(w => w.length > 1), [query])

  // Jump to a message: drop filters that would hide it, then scroll once rows contain it.
  const jump = useCallback((id: number) => {
    const m = msgs[id]; if (!m) return
    const d = m.t.slice(0, 10)
    if ((participant !== null && participant !== m.s) || (from && d < from) || (to && d > to)) { setParticipant(null); setFrom(''); setTo('') }
    pending.current = id; setTick(t => t + 1); setTab('chat'); setDrawer(false); setFlashId(null)
  }, [msgs, participant, from, to])

  useEffect(() => {
    if (tab !== 'chat' || pending.current === null) return
    const i = rowIndex.get(pending.current); if (i === undefined) return
    const id = pending.current; pending.current = null
    requestAnimationFrame(() => { chat.current?.scrollToRow(i); setFlashId(id); setTimeout(() => setFlashId(x => (x === id ? null : x)), 2500) })
  }, [rowIndex, tab, rows, tick])

  const goDate = (d: string) => { const e = meta && Object.keys(meta.days).find(x => x >= d); if (e && meta) jump(meta.days[e][0]) }

  if (err) return <div className="p-8 text-red-600">Daten konnten nicht geladen werden: {err}</div>
  if (!meta) return <div className="h-full grid place-items-center text-[var(--wa-sub)]">Lade Archiv …</div>

  const side = <Sidebar meta={meta} query={query} setQuery={setQuery} hits={hits} onHit={jump} participant={participant} setParticipant={i => { setParticipant(i); setTab('chat'); setDrawer(false) }}
    from={from} to={to} setRange={(f, t) => { setFrom(f); setTo(t) }} onGoDate={goDate} onClose={() => setDrawer(false)} />
  const tabs = [['chat', 'Chat'], ['insights', 'KI-Auswertung'], ['ask', 'KI fragen']] as const
  return (
    <div className="h-full max-w-[1600px] mx-auto flex bg-white shadow-xl" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <aside className="hidden md:block w-[30%] min-w-[340px] max-w-[440px] shrink-0">{side}</aside>
      {drawer && <div className="fixed inset-0 z-30 md:hidden bg-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>{side}</div>}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="bg-[#008069] md:bg-[#f0f2f5] text-white md:text-[#111b21] flex flex-wrap md:flex-nowrap items-center gap-x-3 px-3 md:px-4 min-h-[59px] py-1.5 md:py-0 shrink-0 md:border-l md:border-[#e9edef]">
          <button className="md:hidden text-xl px-1" onClick={() => setDrawer(true)} aria-label="Suche und Filter">☰</button>
          <Avatar size={40} />
          <div className="min-w-0 mr-auto leading-tight">
            <div className="font-medium text-[16px] truncate">{meta.title}</div>
            <div className="text-[13px] opacity-80 md:text-[#667781] truncate">{participant !== null ? `Nur: ${meta.participants[participant].name}` : `${meta.participants.length} Teilnehmer`}{(from || to) ? ` · ${from || '…'} bis ${to || '…'}` : ''}</div>
          </div>
          <nav className="flex gap-1 order-last w-full md:order-none md:w-auto -mx-1 md:mx-0">{tabs.map(([k, l]) =>
            <button key={k} onClick={() => setTab(k)} className={`text-[13px] md:text-sm px-2.5 py-1 rounded-full whitespace-nowrap ${tab === k ? 'bg-white/25 md:bg-[#d9fdd3] md:text-[#008069] font-medium' : 'opacity-80 md:text-[#54656f]'}`}>{l}</button>)}</nav>
        </header>
        {tab === 'chat' && <ChatView ref={chat} rows={rows} meta={meta} hl={hl} flashId={flashId} onOpenImg={setImg} onFilter={i => setParticipant(i)} />}
        {tab === 'insights' && <div className="flex-1 overflow-y-auto chat-bg"><div className="bg-white min-h-full"><InsightsPanel onJump={jump} /></div></div>}
        {tab === 'ask' && <div className="flex-1 overflow-y-auto chat-bg"><div className="bg-white min-h-full"><AskPanel onJump={jump} /></div></div>}
        <footer className="bg-[#f0f2f5] px-4 py-[10px] flex items-center gap-3 shrink-0" style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
          <div className="flex-1 bg-white rounded-lg px-3 py-[9px] text-[14px] text-[#667781] truncate">Archiv – nur lesen. Hier können keine Nachrichten gesendet werden.</div>
        </footer>
      </main>
      {img && <div className="fixed inset-0 z-40 bg-black/85 grid place-items-center p-4" onClick={() => setImg(null)}><img src={img} className="max-h-full max-w-full" alt="" /></div>}
    </div>
  )
}
