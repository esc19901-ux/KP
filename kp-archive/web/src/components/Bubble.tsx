import { memo, useState, type ReactNode } from 'react'
import { fmtTime, mediaUrl } from '../data'
import type { Msg, Participant } from '../types'

const URL_RE = /(https?:\/\/[^\s]+)/g

function renderText(text: string, hl: string[]): ReactNode[] {
  return text.split(URL_RE).flatMap((part, i) => {
    if (i % 2) return [<a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-[#027eb5] hover:underline break-all">{part}</a>]
    if (!hl.length) return [part]
    const re = new RegExp('(' + hl.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi')
    return part.split(re).map((p, k) => (k % 2 ? <mark key={i + '-' + k}>{p}</mark> : p))
  })
}

function MediaView({ m, onOpen }: { m: NonNullable<Msg['m']>; onOpen: (src: string) => void }) {
  switch (m.type) {
    case 'image': case 'sticker':
      return <img loading="lazy" src={mediaUrl(m.thumb!)} width={m.w} height={m.h} alt="Bild" onClick={() => onOpen(mediaUrl(m.src!))}
        className={`cursor-zoom-in max-w-full h-auto block ${m.type === 'sticker' ? 'w-32' : 'rounded-[6px] mb-1'}`} />
    case 'video': return <video className="rounded-[6px] max-w-full mb-1" controls preload="none" src={mediaUrl(m.src!)} />
    case 'audio': return <audio className="max-w-full h-10 mb-1" controls preload="none" src={mediaUrl(m.src!)} />
    case 'document': return <a className="flex items-center gap-3 p-3 rounded-md bg-black/[.05] text-sm mb-1 hover:bg-black/[.08]" href={mediaUrl(m.src!)} target="_blank" rel="noopener"><span className="text-2xl">📄</span><span className="break-all">{m.name}</span></a>
    case 'contact': return <div className="text-sm italic text-[var(--wa-sub)] mb-1">👤 Kontaktkarte</div>
    case 'omitted': return <div className="text-[13px] italic text-[var(--wa-sub)] mb-1">🚫 Medien im Export nicht enthalten</div>
    default: return <div className="text-[13px] italic text-[var(--wa-sub)] mb-1">📎 Anhang nicht verfügbar</div>
  }
}

interface Props { msg: Msg; who?: Participant; hl: string[]; flash: boolean; first: boolean; onOpenImg: (s: string) => void; onFilter: (idx: number) => void }

export default memo(function Bubble({ msg, who, hl, flash, first, onOpenImg, onFilter }: Props) {
  const [open, setOpen] = useState(false)
  if (msg.sys) return (
    <div id={'m' + msg.id} className="flex justify-center px-6 py-1">
      <span className={`text-[12.5px] text-[#54656f] text-center rounded-lg px-3 py-1 shadow-[0_1px_.5px_rgba(11,20,26,.13)] ${msg.id === 0 ? 'bg-[#ffeecd]' : 'bg-white'} ${flash ? 'flash' : ''}`}>{renderText(msg.x, hl)}</span>
    </div>)
  const long = msg.x.length > 1200
  const text = long && !open ? msg.x.slice(0, 1200) + '…' : msg.x
  const time = <span className="float-right ml-3 mt-[5px] -mb-[3px] text-[11px] leading-[15px] text-[var(--wa-sub)] select-none whitespace-nowrap">{msg.e ? 'bearbeitet ' : ''}{fmtTime(msg.t)}</span>
  return (
    <div className={`px-3 md:px-[7%] ${first ? 'pt-[10px]' : 'pt-[2px]'}`}>
      <div id={'m' + msg.id} className={`bubble relative inline-block max-w-[88%] md:max-w-[65%] min-w-[72px] bg-[var(--wa-bubble)] rounded-[7.5px] ${first ? 'rounded-tl-none tail' : ''} px-[9px] pt-[6px] pb-[6px] ${flash ? 'flash' : ''}`}>
        {first && who && <button onClick={() => onFilter(msg.s)} className="block text-left text-[12.8px] font-medium leading-[20px] hover:underline max-w-full truncate" style={{ color: who.color }}>{who.name}</button>}
        {msg.m && <MediaView m={msg.m} onOpen={onOpenImg} />}
        <div className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words">
          {text && renderText(text, hl)}{long && <> <button className="text-[#027eb5]" onClick={() => setOpen(!open)}>{open ? 'Weniger' : 'Mehr lesen'}</button></>}
          {time}
        </div>
      </div>
    </div>
  )
})
