import { memo, useState, type ReactNode } from 'react'
import { fmtTime, mediaUrl } from '../data'
import type { Msg, Participant } from '../types'

const URL_RE = /(https?:\/\/[^\s]+)/g

function renderText(text: string, hl: string[]): ReactNode[] {
  return text.split(URL_RE).flatMap((part, i) => {
    if (i % 2) return [<a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-sky-600 underline break-all">{part}</a>]
    if (!hl.length) return [part]
    const re = new RegExp('(' + hl.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi')
    return part.split(re).map((p, k) => (k % 2 ? <mark key={i + '-' + k}>{p}</mark> : p))
  })
}

function MediaView({ m, onOpen }: { m: NonNullable<Msg['m']>; onOpen: (src: string) => void }) {
  const box = 'rounded-md overflow-hidden mb-1'
  switch (m.type) {
    case 'image': case 'sticker':
      return <img loading="lazy" src={mediaUrl(m.thumb!)} width={m.w} height={m.h} alt="Bild" onClick={() => onOpen(mediaUrl(m.src!))}
        className={`${box} cursor-zoom-in max-w-full h-auto ${m.type === 'sticker' ? 'w-32' : ''}`} />
    case 'video': return <video className={box + ' max-w-full'} controls preload="none" src={mediaUrl(m.src!)} />
    case 'audio': return <audio className="max-w-full" controls preload="none" src={mediaUrl(m.src!)} />
    case 'document': return <a className="flex items-center gap-2 p-2 rounded-md bg-black/5 dark:bg-white/10 text-sm mb-1" href={mediaUrl(m.src!)} target="_blank" rel="noopener">📄 <span className="break-all">{m.name}</span></a>
    case 'contact': return <div className="text-sm italic text-[var(--wa-sub)]">👤 Kontaktkarte (nicht veröffentlicht)</div>
    case 'omitted': return <div className="text-sm italic text-[var(--wa-sub)]">🖼️ Medien im Export nicht enthalten</div>
    default: return <div className="text-sm italic text-[var(--wa-sub)]">📎 Anhang nicht verfügbar</div>
  }
}

interface Props { msg: Msg; who?: Participant; hl: string[]; flash: boolean; showName: boolean; onOpenImg: (s: string) => void; onFilter: (idx: number) => void }

export default memo(function Bubble({ msg, who, hl, flash, showName, onOpenImg, onFilter }: Props) {
  const [open, setOpen] = useState(false)
  const long = msg.x.length > 1200
  const text = long && !open ? msg.x.slice(0, 1200) + '…' : msg.x
  return (
    <div className="px-3 sm:px-[8%] py-[2px]">
      <div id={'m' + msg.id} className={`relative max-w-[85%] sm:max-w-[65%] rounded-lg rounded-tl-none px-2.5 pt-1.5 pb-1 shadow-sm bg-[var(--wa-bubble)] ${flash ? 'flash' : ''}`}>
        {showName && who && <button onClick={() => onFilter(msg.s)} className="block text-[13px] font-medium leading-tight mb-0.5 hover:underline" style={{ color: who.color }}>{who.name}</button>}
        {msg.m && <MediaView m={msg.m} onOpen={onOpenImg} />}
        {text && <div className="whitespace-pre-wrap break-words text-[14.5px] leading-snug">{renderText(text, hl)}</div>}
        {long && <button className="text-xs text-[var(--wa-green)]" onClick={() => setOpen(!open)}>{open ? 'Weniger' : 'Mehr lesen'}</button>}
        <div className="text-[11px] text-[var(--wa-sub)] text-right -mb-0.5 ml-6 select-none">{msg.e ? 'bearbeitet · ' : ''}{fmtTime(msg.t)}</div>
      </div>
    </div>
  )
})
