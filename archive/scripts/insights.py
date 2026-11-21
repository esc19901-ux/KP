#!/usr/bin/env python3
"""Build web/public/data/insights.json from the prepared messages.

Default (no API key): transparent keyword/count analysis. Every item links to original messages.
With ANTHROPIC_API_KEY set and --llm: adds AI summaries, each labelled 'interpretation'.
"""
import argparse, json, os, re, glob, urllib.request
from collections import Counter, defaultdict
from datetime import date

TOPICS = {
 'Innere Medizin': r'innere|internist|diabetes|herzinsuff|pneumonie|copd|niereninsuff|hypertonie|pankreatitis',
 'Chirurgie': r'chirurg|appendi|ileus|hernie|cholezyst|op-|operation|akutes abdomen',
 'Pharmakologie': r'medikament|wirkstoff|nebenwirkung|kontraindikation|dosierung|antibiot|analget|pharmak',
 'Notfall / Reanimation': r'notfall|reanimation|\bals\b|\bbls\b|schock|anaphyla|herzstillstand',
 'Anästhesie / Intensiv': r'an[äa]sthesie|intensiv|beatmung|narkose',
 'Radiologie / Röntgen': r'r[öo]ntgen|\bct\b|\bmrt\b|sonograph|ultraschall|befund',
 'EKG / Kardiologie': r'\bekg\b|kardio|herzinfarkt|\bstemi\b|vorhofflimmern|herzzentrum',
 'Neurologie': r'neurolog|schlaganfall|\bgcs\b|epilep|meningitis',
 'Gynäkologie / Pädiatrie': r'gyn[äa]kolog|schwanger|p[äa]diatr|kinder',
 'Psychiatrie': r'psychiatr|depression|suizid|schizophren',
 'Recht / Ethik / Aufklärung': r'aufkl[äa]rung|schweigepflicht|patientenverf|einwilligung|rechtsmedizin|leichenschau',
 'Fachsprache / Kommunikation': r'fachsprache|fachbegriff|arztbrief|anamnese|patientenvorstellung|fallvorstellung',
 'Prüfungsablauf / Anmeldung': r'anmeldung|termin|ladung|pr[üu]fungsprotokoll|protokoll|ergebnis|bescheid|gleichwertigkeit',
 'Lernmaterial': r'lernkarte|amboss|skript|buch|kurs|pdf|altprotokoll',
}
PLACES = ['Dresden', 'Leipzig', 'Chemnitz', 'Meißen', 'Oschatz', 'Zwickau', 'Görlitz', 'Bautzen', 'Freiberg']
EXP = re.compile(r'bestanden|durchgefallen|nicht bestanden|pr[üu]fer|meine pr[üu]fung|ich hatte|bei uns|fragen (waren|gestellt)|kp (in|war)', re.I)
EXAM_Q = re.compile(r'(was|welche|wie|warum|wann|nennen sie|erkl[äa]ren sie)\b.*\?|\?$', re.I)

def norm(t): return re.sub(r'[^a-zäöüß0-9 ]', '', t.lower())
def toks(t): return {w for w in norm(t).split() if len(w) > 3}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--data', default='web/public/data'); ap.add_argument('--llm', action='store_true')
    a = ap.parse_args()
    msgs = [m for f in sorted(glob.glob(f'{a.data}/months/*.json')) for m in json.load(open(f))]
    texts = [m for m in msgs if m['x'] and not m.get('sys')]
    sections = []

    # 1. topics
    cnt, refs = Counter(), defaultdict(list)
    for m in texts:
        for k, rx in TOPICS.items():
            if re.search(rx, m['x'], re.I): cnt[k] += 1; refs[k].append(m['id'])
    sections.append({'id': 'topics', 'title': 'Häufig genannte Themen', 'note': 'Zählung von Nachrichten mit passenden Stichwörtern (Auswertung, keine Interpretation).',
        'items': [{'kind': 'stat', 'label': k, 'count': c, 'text': '', 'refs': refs[k][-8:]} for k, c in cnt.most_common()]})
    pc, pr = Counter(), defaultdict(list)
    for m in texts:
        for p in PLACES:
            if p.lower() in m['x'].lower(): pc[p] += 1; pr[p].append(m['id'])
    sections.append({'id': 'places', 'title': 'Prüfungsorte (Erwähnungen)', 'items': [{'kind': 'stat', 'label': p, 'count': c, 'text': '', 'refs': pr[p][-8:]} for p, c in pc.most_common()]})

    # 2. exam questions: question-like messages that mention exam vocabulary
    cands = [m for m in texts if '?' in m['x'] and 25 < len(m['x']) < 400 and re.search(r'pr[üu]fer|gefragt|frage|prüfung|fall|patient|medikament|diagnos|therapie', m['x'], re.I)]
    sections.append({'id': 'questions', 'title': 'Fragen rund um die Prüfung', 'note': 'Wörtliche Nachrichten (Auswahl der neuesten 25), keine bestätigten Prüfungsfragen.',
        'items': [{'kind': 'quote', 'text': m['x'].replace('\n', ' ')[:300], 'refs': [m['id']]} for m in cands[-25:]]})

    # 3. repeated questions: group question messages with high token overlap
    qs = [(m, toks(m['x'])) for m in texts if '?' in m['x'] and len(toks(m['x'])) >= 3]
    groups = []
    for m, t in qs:
        for g in groups:
            if len(t & g['t']) / len(t | g['t']) >= 0.5: g['ids'].append(m['id']); break
        else: groups.append({'t': t, 'ids': [m['id']], 'ex': m['x']})
    rep = sorted([g for g in groups if len(g['ids']) >= 3], key=lambda g: -len(g['ids']))[:15]
    sections.append({'id': 'repeated', 'title': 'Wiederholt gestellte Fragen', 'note': 'Ähnliche Fragen (Wortüberlappung ≥ 50 %), Beispiel wörtlich zitiert.',
        'items': [{'kind': 'quote', 'count': len(g['ids']), 'text': g['ex'].replace('\n', ' ')[:300], 'refs': g['ids'][:8]} for g in rep]})

    # 4. student experiences: longer first-person reports
    exp = [m for m in texts if len(m['x']) > 250 and EXP.search(m['x'])]
    sections.append({'id': 'experiences', 'title': 'Erfahrungsberichte', 'note': 'Längere Nachrichten mit Erfahrungsstichwörtern, gekürzt, wörtlich (neueste 15).',
        'items': [{'kind': 'quote', 'text': m['x'][:600] + ('…' if len(m['x']) > 600 else ''), 'refs': [m['id']]} for m in exp[-15:][::-1]]})

    method = 'Stichwort- und Häufigkeitsanalyse (ohne KI)'
    if a.llm:
        key = os.environ['ANTHROPIC_API_KEY']; model = os.environ.get('AI_MODEL', 'claude-sonnet-5-5')
        ctx = '\n'.join(f"[{m['id']}] {m['x'][:500]}" for m in exp[-40:] + cands[-40:])
        body = {'model': model, 'max_tokens': 2000, 'messages': [{'role': 'user', 'content':
            'Fasse aus diesen Chatnachrichten (Format [id] Text) Vorbereitungsempfehlungen für die Kenntnisprüfung zusammen. '
            'Antworte NUR als JSON-Liste [{"text": "...", "refs": [ids]}], jede Empfehlung muss durch Nachrichten-IDs belegt sein.\n\n' + ctx}]}
        req = urllib.request.Request('https://api.anthropic.com/v1/messages', json.dumps(body).encode(), {'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'})
        out = json.load(urllib.request.urlopen(req))['content'][0]['text']
        items = json.loads(re.sub(r'^```(?:json)?|```$', '', out.strip(), flags=re.M).strip())
        sections.append({'id': 'recs', 'title': 'Vorbereitungsempfehlungen (KI)', 'note': 'Von einem Sprachmodell aus den Nachrichten abgeleitet; bitte mit den verlinkten Originalen abgleichen.',
            'items': [{'kind': 'interpretation', 'text': i['text'], 'refs': i['refs']} for i in items]})
        method = f'Stichwortanalyse + KI-Zusammenfassung ({model})'

    json.dump({'generated': date.today().isoformat(), 'method': method, 'sections': sections}, open(f'{a.data}/insights.json', 'w'), ensure_ascii=False)
    print({s['id']: len(s['items']) for s in sections})

if __name__ == '__main__': main()
