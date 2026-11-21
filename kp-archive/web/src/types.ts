export interface Media { type: 'image'|'sticker'|'video'|'audio'|'document'|'contact'|'omitted'|'missing'|'skipped'; name?: string; src?: string; thumb?: string; w?: number; h?: number }
export interface Msg { id: number; t: string; s: number; x: string; e?: 1; m?: Media; sys?: 1 }
export interface Participant { name: string; count: number; color: string }
export interface Meta { title: string; total: number; first: string; last: string; participants: Participant[]; months: { month: string; count: number; firstId: number }[]; days: Record<string, [number, number]>; anonymised: boolean; media: number }
export type Row = { kind: 'date'; date: string } | { kind: 'msg'; msg: Msg }
export type Corpus = [number, number, string, string][]
export interface Segment { type: 'quote' | 'interpretation'; text: string; refs: number[] }
export interface InsightItem { kind: 'quote' | 'interpretation' | 'stat'; text: string; refs: number[]; count?: number; label?: string }
export interface InsightSection { id: string; title: string; note?: string; items: InsightItem[] }
export interface Insights { generated: string; method: string; sections: InsightSection[] }
