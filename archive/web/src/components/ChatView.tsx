import { useEffect, useImperativeHandle, forwardRef, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import Bubble from './Bubble'
import { fmtDate } from '../data'
import type { Meta, Row } from '../types'

export interface ChatHandle { scrollToRow(i: number): void }
interface Props { rows: Row[]; meta: Meta; hl: string[]; flashId: number | null; onOpenImg: (s: string) => void; onFilter: (i: number) => void }

export default forwardRef<ChatHandle, Props>(function ChatView({ rows, meta, hl, flashId, onOpenImg, onFilter }, ref) {
  const parent = useRef<HTMLDivElement>(null)
  const v = useVirtualizer({ count: rows.length, getScrollElement: () => parent.current, estimateSize: i => rows[i]?.kind === 'date' ? 44 : 70, overscan: 12 })
  useImperativeHandle(ref, () => ({ scrollToRow: i => v.scrollToIndex(i, { align: 'center' }) }), [v])
  // start at the newest message like WhatsApp does
  const first = useRef(true)
  useEffect(() => { if (first.current && rows.length) { v.scrollToIndex(rows.length - 1, { align: 'end' }); first.current = false } }, [rows.length, v])

  if (!rows.length) return <div className="flex-1 grid place-items-center text-[var(--wa-sub)] chat-bg">Keine Nachrichten gefunden.</div>
  return (
    <div ref={parent} className="flex-1 overflow-y-auto chat-bg" style={{ contain: 'strict' }}>
      <div style={{ height: v.getTotalSize(), position: 'relative' }}>
        {v.getVirtualItems().map(vi => {
          const row = rows[vi.index]
          const prev = rows[vi.index - 1]
          return (
            <div key={vi.key} data-index={vi.index} ref={v.measureElement} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}>
              {row.kind === 'date'
                ? <div className="flex justify-center py-2 sticky top-0"><span className="text-xs px-3 py-1 rounded-lg bg-[var(--wa-panel)] text-[var(--wa-sub)] shadow-sm">{fmtDate(row.date)}</span></div>
                : <Bubble msg={row.msg} who={meta.participants[row.msg.s]} hl={hl} flash={flashId === row.msg.id}
                    showName={!(prev && prev.kind === 'msg' && prev.msg.s === row.msg.s)} onOpenImg={onOpenImg} onFilter={onFilter} />}
            </div>
          )
        })}
      </div>
    </div>
  )
})
