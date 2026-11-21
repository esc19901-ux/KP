#!/usr/bin/env python3
"""Admin data-prep: WhatsApp export (zip or folder) -> static JSON + optimized media.

Usage:
  python scripts/prepare.py path/to/export.zip [--out web/public/data] [--keep-names] [--no-media]

By default senders are pseudonymised ("Teilnehmer 12"), phone numbers inside texts are
redacted, join/leave/number-change events and contact cards (.vcf) are dropped.
The sender mapping is written to data-private/ (never published).
"""
import argparse, json, re, shutil, sys, zipfile, tempfile, hashlib
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

MAX_MEDIA_MB = 25  # skip huge attachments (GitHub limit is 100 MB/file)

# ---- format detection -------------------------------------------------------
PATTERNS = [
    # 03/07/2025, 22:19 - text      |  7/3/25, 10:19 PM - text
    re.compile(r'^(?P<d>\d{1,2}[/.]\d{1,2}[/.]\d{2,4}),? (?P<t>\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm])?) - (?P<rest>.*)$'),
    # [03.07.25, 22:19:05] text   (iOS)
    re.compile(r'^\u200e?\[(?P<d>\d{1,2}[/.]\d{1,2}[/.]\d{2,4}),? (?P<t>\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm])?)\] (?P<rest>.*)$'),
]
ATTACH = [re.compile(r'^(?P<f>.+?) \((?:file attached|Datei angehängt)\)$'),
          re.compile(r'^\u200e?<(?:attached|angehängt): (?P<f>.+)>$')]
OMITTED = re.compile(r'^\u200e?<(?:Media omitted|Medien ausgeschlossen)>$|^\u200e?(?:image|video|audio|sticker|GIF|document) omitted$')
EDITED = re.compile(r'\s*<(?:This message was edited|Diese Nachricht wurde bearbeitet)>$')
MENTION = re.compile(r'@~?\u2068?[A-Za-zÀ-ÿ][\wÀ-ÿ.\'-]*(?: [A-ZÀ-Ý][\wÀ-ÿ.\'-]*)?\u2069?')
PHONE = re.compile(r'\+\d[\d \-()]{7,}\d|\b0\d{2,4}[ /-]?\d{6,}\b')

def match_line(line):
    line = line.lstrip('\u200e\ufeff')
    for p in PATTERNS:
        m = p.match(line)
        if m: return m
    return None

def detect_date_order(dates):
    """Return 'dmy' or 'mdy' by looking at which field exceeds 12."""
    a = b = 0
    for d in dates:
        x, y = re.split(r'[/.]', d)[:2]
        if int(x) > 12: a += 1
        if int(y) > 12: b += 1
    return 'mdy' if b == 0 and a == 0 and False else ('mdy' if b > a else 'dmy')

def parse_dt(d, t, order):
    x, y, yr = re.split(r'[/.]', d)
    day, mon = (int(x), int(y)) if order == 'dmy' else (int(y), int(x))
    yr = int(yr); yr += 2000 if yr < 100 else 0
    t = t.strip().upper().replace('\u202f', ' ')
    fmt = '%I:%M:%S %p' if re.search(r'[AP]M', t) and t.count(':') == 2 else \
          '%I:%M %p' if re.search(r'[AP]M', t) else '%H:%M:%S' if t.count(':') == 2 else '%H:%M'
    tm = datetime.strptime(t, fmt)
    return datetime(yr, mon, day, tm.hour, tm.minute, tm.second)

def parse_chat(text):
    raw = []  # (date, time, rest) with continuation lines merged
    for line in text.replace('\r\n', '\n').split('\n'):
        m = match_line(line)
        if m: raw.append([m['d'], m['t'], m['rest']])
        elif raw: raw[-1][2] += '\n' + line
    order = detect_date_order([r[0] for r in raw])
    msgs = []
    for d, t, rest in raw:
        ts = parse_dt(d, t, order)
        sender, body = None, rest
        if ': ' in rest.split('\n', 1)[0]:
            sender, body = rest.split(': ', 1)
        msgs.append({'ts': ts, 'sender': sender, 'text': body.rstrip('\n')})
    return msgs, order

# ---- media ------------------------------------------------------------------
def process_media(src: Path, out: Path):
    ext = src.suffix.lower()
    if src.stat().st_size > MAX_MEDIA_MB * 1024 * 1024:
        return {'type': 'skipped', 'name': src.name, 'reason': 'too large'}
    dst = out / 'media'; dst.mkdir(parents=True, exist_ok=True)
    key = hashlib.md5(src.name.encode()).hexdigest()[:10]
    if ext in ('.jpg', '.jpeg', '.png', '.webp', '.gif'):
        from PIL import Image
        im = Image.open(src); im.load()
        kind = 'sticker' if src.name.startswith('STK') else 'image'
        full = im.copy(); full.thumbnail((1400, 1400) if kind == 'image' else (256, 256))
        thumb = im.copy(); thumb.thumbnail((360, 360))
        if full.mode not in ('RGB', 'RGBA'): full = full.convert('RGB'); thumb = thumb.convert('RGB')
        full.save(dst / f'{key}.webp', quality=80); thumb.save(dst / f'{key}_t.webp', quality=70)
        return {'type': kind, 'name': src.name, 'src': f'media/{key}.webp', 'thumb': f'media/{key}_t.webp',
                'w': thumb.width, 'h': thumb.height}
    kind = {'.mp4': 'video', '.opus': 'audio', '.ogg': 'audio', '.m4a': 'audio', '.pdf': 'document'}.get(ext)
    if kind:
        shutil.copy2(src, dst / f'{key}{ext}')
        return {'type': kind, 'name': src.name, 'src': f'media/{key}{ext}'}
    return {'type': 'skipped', 'name': src.name, 'reason': 'unsupported'}

# ---- main -------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('export'); ap.add_argument('--out', default='web/public/data')
    ap.add_argument('--keep-names', action='store_true', help='do NOT pseudonymise senders (publishes real names/numbers!)')
    ap.add_argument('--no-media', action='store_true'); ap.add_argument('--title')
    a = ap.parse_args()
    out = Path(a.out)
    if out.exists(): shutil.rmtree(out)
    (out / 'months').mkdir(parents=True)

    src = Path(a.export)
    if src.suffix == '.zip':
        tmp = Path(tempfile.mkdtemp()); zipfile.ZipFile(src).extractall(tmp); src = tmp
    txts = sorted(src.rglob('*.txt'), key=lambda p: -p.stat().st_size)
    if not txts: sys.exit('No .txt chat export found')
    chat = txts[0]
    files = {p.name: p for p in src.rglob('*') if p.is_file()}
    # zip names sometimes arrive mojibake'd; also index a repaired variant
    for n, p in list(files.items()):
        try: files.setdefault(n.encode('cp437').decode('utf-8'), p)
        except Exception: pass

    msgs, order = parse_chat(chat.read_text(encoding='utf-8-sig'))
    print(f'{len(msgs)} entries, date order {order}')
    title = a.title or re.sub(r'^WhatsApp Chat (?:with|mit) ', '', chat.stem)

    pseud, mapping = {}, {}
    def who(s):
        if a.keep_names: return s.lstrip('~ \u202f\u00a0').strip()
        if s not in pseud:
            pseud[s] = f'Teilnehmer {len(pseud) + 1}'; mapping[pseud[s]] = s
        return pseud[s]
    def clean(t):
        if a.keep_names: return t
        t = MENTION.sub('@Teilnehmer', t)
        t = PHONE.sub('[Nummer entfernt]', t)
        for real, p in sorted(pseud.items(), key=lambda kv: -len(kv[0])):
            if not PHONE.fullmatch(real) and len(real) > 3: t = t.replace(real.lstrip('~ '), p)
        return t

    # first pass assigns pseudonyms in order of appearance
    for m in msgs:
        if m['sender']: who(m['sender'])

    out_msgs, skipped = [], Counter()
    for m in msgs:
        if m['sender'] is None:
            skipped['system'] += 1
            if not a.keep_names: continue
        text = m['text'].replace('~\u202f', '').replace('@\u2068~', '@').replace('@\u2068', '@').replace('\u2069', '').replace('@~', '@') if a.keep_names else m['text']; media = None; edited = bool(EDITED.search(text)); text = EDITED.sub('', text)
        first = text.split('\n', 1)[0]
        for p in ATTACH:
            am = p.match(first.lstrip('\u200e'))
            if am:
                fn = am['f']; srcf = files.get(fn)
                if fn.lower().endswith('.vcf'):
                    media = {'type': 'contact', 'name': 'Kontaktkarte'}; skipped['vcf'] += 1
                elif a.no_media or not srcf: media = {'type': 'missing', 'name': fn}
                else: media = process_media(srcf, out)
                text = text.split('\n', 1)[1] if '\n' in text else ''
                break
        else:
            if OMITTED.match(first.strip()): media = {'type': 'omitted'}; text = ''
        if media and media.get('name') and 'Ã' in media['name']:
            try: media['name'] = media['name'].encode('latin-1').decode('utf-8')
            except Exception: pass
        if media and a.keep_names is False: media.pop('name', None) if media['type'] != 'document' else None
        entry = {'id': len(out_msgs), 't': m['ts'].strftime('%Y-%m-%dT%H:%M'),
                 's': who(m['sender']) if m['sender'] else None, 'x': clean(text)}
        if edited: entry['e'] = 1
        if media: entry['m'] = media
        if m['sender'] is None: entry['sys'] = 1
        out_msgs.append(entry)

    out_msgs.sort(key=lambda e: (e['t'], e['id']))  # stable chronological order
    for i, e in enumerate(out_msgs): e['id'] = i

    senders = Counter(e['s'] for e in out_msgs if e['s'])
    names = [s for s, _ in senders.most_common()]
    palette = ['#d62f8a', '#1f7aec', '#02a698', '#e65f2b', '#7f66ff', '#b58900', '#00a884', '#c4283c', '#2a8cbf', '#8a6d3b', '#6a9a00', '#a64ca6']
    sidx = {n: i for i, n in enumerate(names)}
    parts = [{'name': n, 'count': c, 'color': palette[i % len(palette)]} for i, (n, c) in enumerate(senders.most_common())]
    for e in out_msgs: e['s'] = sidx[e['s']] if e['s'] is not None else -1

    months = defaultdict(list)
    for e in out_msgs: months[e['t'][:7]].append(e)
    meta_months = []
    for mo, items in sorted(months.items()):
        (out / 'months' / f'{mo}.json').write_text(json.dumps(items, ensure_ascii=False, separators=(',', ':')))
        meta_months.append({'month': mo, 'count': len(items), 'firstId': items[0]['id']})
    days = Counter(e['t'][:10] for e in out_msgs)
    first_by_day = {}
    for e in out_msgs: first_by_day.setdefault(e['t'][:10], e['id'])

    meta = {'title': title, 'total': len(out_msgs), 'first': out_msgs[0]['t'], 'last': out_msgs[-1]['t'],
            'participants': parts, 'months': meta_months,
            'days': {d: [first_by_day[d], c] for d, c in sorted(days.items())},
            'anonymised': not a.keep_names, 'media': sum(1 for e in out_msgs if e.get('m'))}
    (out / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')))
    # compact search corpus: [id, sender idx, 'YYYY-MM-DD HH:MM', text]
    corpus = [[e['id'], e['s'], e['t'], e['x']] for e in out_msgs if e['x']]
    (out / 'search.json').write_text(json.dumps(corpus, ensure_ascii=False, separators=(',', ':')))
    Path('data-private').mkdir(exist_ok=True)
    Path('data-private/sender-map.json').write_text(json.dumps(mapping, ensure_ascii=False, indent=1))
    print(f'wrote {len(out_msgs)} messages, {len(parts)} participants, {len(meta_months)} months, skipped {dict(skipped)}')
    print('media dir:', sum(f.stat().st_size for f in (out / "media").glob("*")) // 1024, 'KB' if (out / "media").exists() else '')

if __name__ == '__main__':
    main()
