#!/usr/bin/env python3
"""
The Conviction Game — Google Slides Deck Builder

Creates a 30-slide dark-themed pitch deck via gws CLI.
Emotional arc: Recognition → Problem → Concepts → Synthesis → Game → Business → Moat → Ask

Usage: python3 build_deck.py
"""

import json
import subprocess
import sys

# ═══════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════

EMU = 914400  # 1 inch in EMU

def e(inches):
    return int(inches * EMU)

# Color palette (RGB 0-1 floats)
BG      = {'red': 0.051, 'green': 0.067, 'blue': 0.090}  # #0d1117
BG_SECT = {'red': 0.067, 'green': 0.051, 'blue': 0.098}  # #110d19
BG_WARM = {'red': 0.090, 'green': 0.059, 'blue': 0.051}  # #170f0d
GOLD    = {'red': 0.941, 'green': 0.753, 'blue': 0.251}  # #f0c040
RED     = {'red': 0.914, 'green': 0.271, 'blue': 0.376}  # #e94560
WHT     = {'red': 1.0,   'green': 1.0,   'blue': 1.0}
GRY     = {'red': 0.73,  'green': 0.73,  'blue': 0.76}
DIM     = {'red': 0.45,  'green': 0.45,  'blue': 0.50}

# ═══════════════════════════════════════════════════════════
# API Helpers
# ═══════════════════════════════════════════════════════════

def gws(method, **kw):
    cmd = ['gws', 'slides', 'presentations', method]
    if 'params' in kw:
        cmd += ['--params', json.dumps(kw['params'])]
    if 'body' in kw:
        cmd += ['--json', json.dumps(kw['body'])]
    cmd += ['--format', 'json']
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"ERROR [{method}]: {r.stderr[:500]}", file=sys.stderr)
        sys.exit(1)
    return json.loads(r.stdout)

def batch(pid, reqs):
    return gws('batchUpdate',
               params={'presentationId': pid},
               body={'requests': reqs})

# ═══════════════════════════════════════════════════════════
# Request Builders
# ═══════════════════════════════════════════════════════════

def mk_slide(sid):
    return {'createSlide': {
        'objectId': sid,
        'slideLayoutReference': {'predefinedLayout': 'BLANK'}
    }}

def mk_bg(sid, color):
    return {'updatePageProperties': {
        'objectId': sid,
        'pageProperties': {
            'pageBackgroundFill': {
                'solidFill': {'color': {'rgbColor': color}}
            }
        },
        'fields': 'pageBackgroundFill.solidFill.color'
    }}

def mk_text(page, oid, x, y, w, h, text,
            size=20, color=None, bold=False,
            font='Open Sans', align='START', spacing=150):
    if color is None:
        color = WHT
    return [
        {'createShape': {
            'objectId': oid,
            'shapeType': 'TEXT_BOX',
            'elementProperties': {
                'pageObjectId': page,
                'size': {
                    'width': {'magnitude': e(w), 'unit': 'EMU'},
                    'height': {'magnitude': e(h), 'unit': 'EMU'}
                },
                'transform': {
                    'scaleX': 1, 'scaleY': 1,
                    'translateX': e(x), 'translateY': e(y),
                    'unit': 'EMU'
                }
            }
        }},
        {'insertText': {
            'objectId': oid,
            'text': text,
            'insertionIndex': 0
        }},
        {'updateTextStyle': {
            'objectId': oid,
            'style': {
                'fontSize': {'magnitude': size, 'unit': 'PT'},
                'foregroundColor': {'opaqueColor': {'rgbColor': color}},
                'bold': bold,
                'fontFamily': font
            },
            'textRange': {'type': 'ALL'},
            'fields': 'fontSize,foregroundColor,bold,fontFamily'
        }},
        {'updateParagraphStyle': {
            'objectId': oid,
            'style': {
                'alignment': align,
                'lineSpacing': spacing
            },
            'textRange': {'type': 'ALL'},
            'fields': 'alignment,lineSpacing'
        }}
    ]

def S(n):
    return f'slide_{n:02d}'

def T(n):
    return f'title_{n:02d}'

def B(n):
    return f'body_{n:02d}'

def X(n, tag):
    return f'x_{n:02d}_{tag}'

# ═══════════════════════════════════════════════════════════
# Slide Content
# ═══════════════════════════════════════════════════════════

def build_slides():
    R = []

    # ── 1: Title ──
    n = 1
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 1.4, 8.4, 1.5,
                 'THE CONVICTION GAME',
                 size=52, color=GOLD, bold=True, font='Montserrat', align='CENTER')
    R += mk_text(S(n), B(n), 0.8, 3.2, 8.4, 0.8,
                 'Rewilding the Punter Commons',
                 size=22, color=GRY, align='CENTER')

    # ── 2: Every Saturday ──
    n = 2
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 0.4, 8.4, 0.8,
                 'Every Saturday...',
                 size=36, color=WHT, bold=True, font='Montserrat')
    R += mk_text(S(n), B(n), 0.8, 1.6, 8.4, 3.5,
                 'Thousands of punters study the form.\n'
                 'They read the tip sheets.\n'
                 'They argue with their mates.\n'
                 'They develop private convictions.\n\n'
                 'Then they bet \u2014 individually \u2014\n'
                 'into a system designed to take their money.',
                 size=20, color=GRY, spacing=180)

    # ── 3: Intelligence is extraordinary ──
    n = 3
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 0.8, 8.4, 1.0,
                 'Their collective intelligence\nis extraordinary.',
                 size=36, color=WHT, bold=True, font='Montserrat',
                 align='CENTER', spacing=130)
    R += mk_text(S(n), B(n), 1.5, 2.5, 7.0, 2.5,
                 'It consistently outperforms any individual tipster.\n\n'
                 'But that intelligence is never captured.\n'
                 'Never aggregated.\n'
                 'Never returned to the people who generated it.',
                 size=20, color=GRY, align='CENTER', spacing=180)

    # ── 4: Section — THE PROBLEM ──
    n = 4
    R += [mk_slide(S(n)), mk_bg(S(n), BG_WARM)]
    R += mk_text(S(n), T(n), 0.8, 2.0, 8.4, 1.2,
                 'THE PROBLEM',
                 size=48, color=RED, bold=True, font='Montserrat', align='CENTER')

    # ── 5: $32 Billion ──
    n = 5
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 0.3, 8.4, 1.0,
                 '$32 BILLION',
                 size=52, color=GOLD, bold=True, font='Montserrat', align='CENTER')
    R += mk_text(S(n), X(n, 'sub'), 0.8, 1.3, 8.4, 0.5,
                 'Australian wagering market, annually',
                 size=18, color=DIM, align='CENTER')
    R += mk_text(S(n), B(n), 1.2, 2.2, 7.6, 3.0,
                 'Three operators control it.\n'
                 'Sportsbet. Ladbrokes. TAB.\n\n'
                 'They are information extractors.\n\n'
                 'Punters generate intelligence through betting patterns.\n'
                 'Bookmakers absorb it, adjust odds, keep the edge.',
                 size=18, color=GRY, spacing=170)

    # ── 6: Intelligence flows one way ──
    n = 6
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 0.4, 8.4, 0.8,
                 'Intelligence flows one way.',
                 size=36, color=WHT, bold=True, font='Montserrat')
    R += mk_text(S(n), B(n), 0.8, 1.8, 8.4, 3.5,
                 'The punter commons existed.\n'
                 'In pubs. At the track. In WhatsApp groups.\n'
                 'Every gathering place where punters sit together.\n\n'
                 'Industrialised bookmaking enclosed it.\n'
                 'Not destroyed. Enclosed.\n\n'
                 'The intelligence is still there\n'
                 'in every punter\u2019s head.\n\n'
                 'There\u2019s just no venue that aggregates it honestly\n'
                 'and returns it to the people who generated it.',
                 size=18, color=GRY, spacing=165)

    # ── 7: What if the pub could think? ──
    n = 7
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 1.4, 8.4, 1.5,
                 'What if the pub\ncould think?',
                 size=44, color=GOLD, bold=True, font='Montserrat',
                 align='CENTER', spacing=120)
    R += mk_text(S(n), B(n), 0.8, 3.3, 8.4, 0.8,
                 'The WhatsApp group. The track. Any place punters gather.',
                 size=18, color=DIM, align='CENTER')

    # ── 8: Section — SIX CONCEPTS ──
    n = 8
    R += [mk_slide(S(n)), mk_bg(S(n), BG_SECT)]
    R += mk_text(S(n), T(n), 0.8, 1.5, 8.4, 1.0,
                 'SIX CONCEPTS',
                 size=48, color=GOLD, bold=True, font='Montserrat', align='CENTER')
    R += mk_text(S(n), B(n), 1.5, 3.0, 7.0, 1.0,
                 'Each one earns the next.',
                 size=22, color=DIM, align='CENTER')

    # ── 9: Ground Truth ──
    n = 9
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), X(n, 'num'), 0.8, 0.3, 1.0, 0.5,
                 '01', size=16, color=DIM, font='Montserrat', bold=True)
    R += mk_text(S(n), T(n), 0.8, 0.6, 8.4, 0.8,
                 'GROUND TRUTH',
                 size=36, color=GOLD, bold=True, font='Montserrat')
    R += mk_text(S(n), B(n), 0.8, 1.8, 5.0, 3.2,
                 'Horse racing delivers objective,\n'
                 'unchallengeable, publicly verifiable truth\n'
                 'every thirty minutes.\n\n'
                 'No committee decides.\n'
                 'The horse crossed the line first.\n\n'
                 'This is the exam.\n'
                 'Racing gives you an exam\n'
                 'every thirty minutes.',
                 size=18, color=GRY, spacing=165)
    R += mk_text(S(n), X(n, 'stat'), 6.3, 1.8, 3.2, 2.0,
                 '~200\ntruth events\nper week',
                 size=32, color=GOLD, bold=True, font='Montserrat',
                 align='CENTER', spacing=120)

    # ── 10: Conviction ──
    n = 10
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), X(n, 'num'), 0.8, 0.3, 1.0, 0.5,
                 '02', size=16, color=DIM, font='Montserrat', bold=True)
    R += mk_text(S(n), T(n), 0.8, 0.6, 8.4, 0.8,
                 'CONVICTION',
                 size=36, color=GOLD, bold=True, font='Montserrat')
    R += mk_text(S(n), B(n), 0.8, 1.8, 8.4, 3.5,
                 '\u201cI\u2019m CERTAIN Horse 5 wins Race 3.\u201d\n'
                 '\u201cI THINK Horse 2 has a chance in Race 7.\u201d\n'
                 '\u201cRace 4? No idea.\u201d\n\n'
                 'These are three different levels of conviction.\n'
                 'Every tipping platform treats them identically.\n\n'
                 'A conviction allocation captures the gradient.\n'
                 'You distribute a limited budget of credits.\n'
                 'The budget forces honesty about where you\n'
                 'actually have an edge.',
                 size=18, color=GRY, spacing=160)

    # ── 11: Quadratic Cost ──
    n = 11
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), X(n, 'num'), 0.8, 0.3, 1.0, 0.5,
                 '03', size=16, color=DIM, font='Montserrat', bold=True)
    R += mk_text(S(n), T(n), 0.8, 0.6, 8.4, 0.8,
                 'QUADRATIC COST',
                 size=36, color=GOLD, bold=True, font='Montserrat')
    R += mk_text(S(n), B(n), 0.8, 1.6, 4.5, 3.5,
                 'The cost of expressing conviction\n'
                 'grows as the square.\n\n'
                 '1 vote  =   1 credit\n'
                 '2 votes =   4 credits\n'
                 '3 votes =   9 credits\n'
                 '5 votes = 25 credits\n\n'
                 'Double the conviction.\n'
                 'Four times the cost.',
                 size=18, color=GRY, spacing=160, font='Roboto Mono')
    R += mk_text(S(n), X(n, 'stat'), 5.8, 1.6, 3.8, 1.5,
                 '3.3\u00d7',
                 size=72, color=GOLD, bold=True, font='Montserrat', align='CENTER')
    R += mk_text(S(n), X(n, 'lbl'), 5.8, 3.3, 3.8, 1.5,
                 'more signal per credit\nfrom distributed honesty\nvs concentrated manipulation',
                 size=14, color=DIM, align='CENTER', spacing=140)

    # ── 12: Zero-Knowledge Proofs ──
    n = 12
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), X(n, 'num'), 0.8, 0.3, 1.0, 0.5,
                 '04', size=16, color=DIM, font='Montserrat', bold=True)
    R += mk_text(S(n), T(n), 0.8, 0.6, 8.4, 0.8,
                 'ZERO-KNOWLEDGE PROOFS',
                 size=36, color=GOLD, bold=True, font='Montserrat')
    R += mk_text(S(n), B(n), 0.8, 1.8, 8.4, 3.5,
                 'Prove something is true\n'
                 'without revealing anything else.\n\n'
                 '\u201cI am a member of this community\u201d\n'
                 '\u2014 without revealing which member.\n\n'
                 '\u201cI predicted Horse 5 would win\u201d\n'
                 '\u2014 proved by opening a sealed envelope after the race.\n\n'
                 '\u201cMy track record is 34% strike rate\u201d\n'
                 '\u2014 without revealing who I am.',
                 size=18, color=GRY, spacing=160)

    # ── 13: Anti-Collusion ──
    n = 13
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), X(n, 'num'), 0.8, 0.3, 1.0, 0.5,
                 '05', size=16, color=DIM, font='Montserrat', bold=True)
    R += mk_text(S(n), T(n), 0.8, 0.6, 8.4, 0.8,
                 'ANTI-COLLUSION',
                 size=36, color=GOLD, bold=True, font='Montserrat')
    R += mk_text(S(n), B(n), 0.8, 1.8, 8.4, 3.5,
                 'Five mates agree in a WhatsApp group:\n'
                 '\u201cWe\u2019re all piling on Horse 3 to skew the signal.\u201d\n\n'
                 'But any member can secretly change their vote.\n'
                 'And the ringleader can\u2019t tell.\n\n'
                 'The override is invisible until the final tally.\n'
                 'The rational move is to silently defect\n'
                 'and vote honestly.\n\n'
                 'This doesn\u2019t catch cartels.\n'
                 'It makes them impossible to coordinate.',
                 size=18, color=GRY, spacing=160)

    # ── 14: Social Deduction ──
    n = 14
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), X(n, 'num'), 0.8, 0.3, 1.0, 0.5,
                 '06', size=16, color=DIM, font='Montserrat', bold=True)
    R += mk_text(S(n), T(n), 0.8, 0.6, 8.4, 0.8,
                 'SOCIAL DEDUCTION',
                 size=36, color=GOLD, bold=True, font='Montserrat')
    R += mk_text(S(n), B(n), 0.8, 1.6, 5.0, 3.5,
                 'Games like Among Us\n'
                 'and Blood on the Clocktower:\n\n'
                 'Night phase \u2014 secret actions.\n'
                 'Day phase \u2014 public discussion.\n\n'
                 'Some players are honest.\n'
                 'Some are lying.\n'
                 'Nobody knows who.\n\n'
                 'The drama is emergent.\n'
                 'That IS the engagement.',
                 size=18, color=GRY, spacing=160)
    R += mk_text(S(n), X(n, 'key'), 5.5, 2.0, 4.0, 2.5,
                 'Punters who\nwould never care\nabout ZK proofs\n\nWILL care about\ncatching someone\ngaming the system.',
                 size=16, color=RED, bold=True, align='CENTER', spacing=140)

    # ── 15: Section — THE SYNTHESIS ──
    n = 15
    R += [mk_slide(S(n)), mk_bg(S(n), BG_SECT)]
    R += mk_text(S(n), T(n), 0.8, 1.5, 8.4, 1.0,
                 'THE SYNTHESIS',
                 size=48, color=GOLD, bold=True, font='Montserrat', align='CENTER')
    R += mk_text(S(n), B(n), 1.5, 3.0, 7.0, 1.0,
                 'Six concepts. One system.',
                 size=22, color=DIM, align='CENTER')

    # ── 16: The Closed Loop ──
    n = 16
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 0.3, 8.4, 0.7,
                 'The Closed System',
                 size=32, color=WHT, bold=True, font='Montserrat')
    R += mk_text(S(n), B(n), 0.8, 1.2, 8.4, 4.0,
                 'Ground Truth  \u2192  provides the exam for\n'
                 '    Conviction  \u2192  priced by\n'
                 '        Quadratic Cost  \u2192  protected by\n'
                 '            Zero-Knowledge  \u2192  hardened by\n'
                 '                Anti-Collusion  \u2192  experienced as\n'
                 '                    Social Deduction  \u2192  validated by\n'
                 '                        Ground Truth  \u2190  the loop closes',
                 size=18, color=GRY, font='Roboto Mono', spacing=200)

    # ── 17: The 30-Minute Cycle ──
    n = 17
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 0.3, 8.4, 0.7,
                 'The 30-Minute Cycle',
                 size=32, color=WHT, bold=True, font='Montserrat')
    R += mk_text(S(n), B(n), 0.8, 1.5, 8.4, 3.5,
                 'NIGHT  \u2014  Allocate conviction. Private. Simultaneous. Hidden.\n\n'
                 'DAWN  \u2014  Race runs. Ground truth arrives. Credits settle.\n\n'
                 'DAY   \u2014  Forensics. Patterns surface. \u201cUnusual concentration in Race 4.\u201d\n\n'
                 'DUSK  \u2014  Discussion. Who called it? Voluntary reveals.\n\n'
                 '\u21bb  Repeat. 8\u201310 times per meeting.',
                 size=17, color=GRY, spacing=165)

    # ── 18: Honesty dominates ──
    n = 18
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 1.2, 8.4, 2.0,
                 'Honesty is the dominant strategy\nafter ~20 races.',
                 size=36, color=WHT, bold=True, font='Montserrat',
                 align='CENTER', spacing=130)
    R += mk_text(S(n), B(n), 1.5, 3.5, 7.0, 1.5,
                 'This isn\u2019t an aspiration.\nIt\u2019s a mathematical property of the mechanism.',
                 size=20, color=DIM, align='CENTER', spacing=150)

    # ── 19: Section — THE GAME ──
    n = 19
    R += [mk_slide(S(n)), mk_bg(S(n), BG_SECT)]
    R += mk_text(S(n), T(n), 0.8, 1.5, 8.4, 1.0,
                 'THE GAME',
                 size=48, color=GOLD, bold=True, font='Montserrat', align='CENTER')
    R += mk_text(S(n), B(n), 1.5, 3.0, 7.0, 1.0,
                 'What it feels like to play.',
                 size=22, color=DIM, align='CENTER')

    # ── 20: What a Saturday looks like ──
    n = 20
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 0.3, 8.4, 0.7,
                 'A Saturday Inside',
                 size=32, color=WHT, bold=True, font='Montserrat')
    R += mk_text(S(n), B(n), 0.8, 1.3, 8.4, 4.0,
                 'MORNING   Tip sheets arrive. AI extracts data.\n'
                 '          Study form. Allocate conviction.\n\n'
                 'RACE 1    Allocations close 5 min before.\n'
                 '          Race runs. Ground truth. Credits settle.\n\n'
                 'BETWEEN   Forensics surface. Community discusses.\n'
                 '          \u201cUnusual pattern in Race 1.\u201d Who called it?\n\n'
                 'RACE 2    The loop repeats. 8\u201310 times per meeting.\n\n'
                 'EVENING   Daily stats. Leaderboard moves.\n'
                 '          The Analyst checks strike rate.\n'
                 '          The Shark hunts patterns.',
                 size=16, color=GRY, spacing=145)

    # ── 21: Four Player Archetypes ──
    n = 21
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 0.3, 8.4, 0.6,
                 'Four Kinds of Player',
                 size=28, color=WHT, bold=True, font='Montserrat')
    R += mk_text(S(n), X(n, 'a1'), 0.5, 1.2, 4.3, 1.7,
                 'THE ANALYST\n'
                 'Studies form obsessively.\n'
                 'Lives for the leaderboard.\n'
                 'Wants to prove they\u2019re the best.',
                 size=15, color=GRY, spacing=150)
    R += mk_text(S(n), X(n, 'a2'), 5.2, 1.2, 4.3, 1.7,
                 'THE PUNTER\n'
                 'Hunches. Longshots.\n'
                 'The thrill of the unlikely call.\n'
                 'Finds overlays nobody else saw.',
                 size=15, color=GRY, spacing=150)
    R += mk_text(S(n), X(n, 'a3'), 0.5, 3.2, 4.3, 1.7,
                 'THE SOCIALISER\n'
                 'Lives in chat.\n'
                 'Community IS the product.\n'
                 'Belonging over winning.',
                 size=15, color=GRY, spacing=150)
    R += mk_text(S(n), X(n, 'a4'), 5.2, 3.2, 4.3, 1.7,
                 'THE SHARK\n'
                 'Hunts anomaly patterns.\n'
                 'Exposes manipulation.\n'
                 'The immune system.',
                 size=15, color=RED, spacing=150)

    # ── 22: The Shark ──
    n = 22
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 1.0, 8.4, 1.2,
                 'The Shark doesn\u2019t exist\non any tipping platform today.',
                 size=32, color=WHT, bold=True, font='Montserrat',
                 align='CENTER', spacing=130)
    R += mk_text(S(n), B(n), 1.5, 2.8, 7.0, 2.2,
                 'Social deduction creates the Shark archetype.\n'
                 'Catching someone gaming the system is genuinely fun.\n\n'
                 'The Shark is the immune system.\n'
                 'And they play for free.',
                 size=18, color=GRY, align='CENTER', spacing=160)

    # ── 23: Section — THE DIGITAL CORPORATE BOX ──
    n = 23
    R += [mk_slide(S(n)), mk_bg(S(n), BG_WARM)]
    R += mk_text(S(n), T(n), 0.8, 1.5, 8.4, 1.0,
                 'THE DIGITAL\nCORPORATE BOX',
                 size=44, color=GOLD, bold=True, font='Montserrat', align='CENTER',
                 spacing=120)
    R += mk_text(S(n), B(n), 1.5, 3.2, 7.0, 1.0,
                 'Your punters are already at the track.\nWe built the boxes.',
                 size=22, color=DIM, align='CENTER', spacing=150)

    # ── 24: Three Tiers — Grandstand → Members → Box Seat ──
    n = 24
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 0.3, 8.4, 0.6,
                 'Three Seats at the Track',
                 size=28, color=WHT, bold=True, font='Montserrat')
    R += mk_text(S(n), X(n, 't1'), 0.5, 1.2, 2.8, 3.8,
                 'GRANDSTAND\nFree \u2022 WhatsApp\n\n'
                 'Race fields\nConsensus tips\nResults\n\n'
                 'You can see the race\nfrom the hill.',
                 size=16, color=DIM, align='CENTER', spacing=145)
    R += mk_text(S(n), X(n, 't2'), 3.6, 1.2, 2.8, 3.8,
                 'MEMBERS\n$25/mo \u2022 Matrix\n\n'
                 'Full conviction game\nLeaderboard\nForensics\nCommunity chat\n\n'
                 'Inside the fence.',
                 size=16, color=WHT, align='CENTER', spacing=145)
    R += mk_text(S(n), X(n, 't3'), 6.7, 1.2, 2.8, 3.8,
                 'BOX SEAT\n$100/mo \u2022 Premium\n\n'
                 'Personal AI swarm\nTuned to your form\nAdvanced analytics\n\n'
                 'Your name on the door.',
                 size=16, color=GOLD, align='CENTER', spacing=145)

    # ── 25: Break-even ──
    n = 25
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 1.2, 8.4, 1.5,
                 'Break-even at\n4 paying users.',
                 size=44, color=GOLD, bold=True, font='Montserrat',
                 align='CENTER', spacing=120)
    R += mk_text(S(n), B(n), 1.5, 3.3, 7.0, 1.5,
                 'Infrastructure costs: $22\u2013100/month.\n'
                 'The business is essentially unkillable on a cash basis.',
                 size=18, color=DIM, align='CENTER', spacing=160)

    # ── 26: Every bookmaker gets a box ──
    n = 26
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 0.3, 8.4, 0.7,
                 'Every Bookmaker Gets Their Own Box',
                 size=28, color=WHT, bold=True, font='Montserrat')
    R += mk_text(S(n), B(n), 0.8, 1.3, 5.0, 2.5,
                 'Same track. Same races.\nDifferent box. Different brand.\n\n'
                 'The bookmaker doesn\u2019t build\nthe racecourse.\n'
                 'They lease a box.\n\n'
                 'Marginal cost per new box \u2192 near zero.\n'
                 'Boxes compete on race day.',
                 size=17, color=GRY, spacing=150)
    R += mk_text(S(n), X(n, 'key'), 5.5, 1.3, 4.0, 3.8,
                 '\u201cWhich box called\nmore winners?\u201d\n\n'
                 'Sportsbet\u2019s box: 7 of 10.\nLadbrokes\u2019 box: 5.\n\n'
                 'That\u2019s content.\n'
                 'That\u2019s tribal identity.\n'
                 'That\u2019s a Saturday\nat Flemington.',
                 size=16, color=RED, bold=True, align='CENTER', spacing=145)

    # ── 27: Section — THE MOAT ──
    n = 27
    R += [mk_slide(S(n)), mk_bg(S(n), BG_SECT)]
    R += mk_text(S(n), T(n), 0.8, 1.5, 8.4, 1.0,
                 'THE MOAT',
                 size=48, color=GOLD, bold=True, font='Montserrat', align='CENTER')
    R += mk_text(S(n), B(n), 1.5, 3.0, 7.0, 1.0,
                 'Five layers. Each reinforces the others.',
                 size=22, color=DIM, align='CENTER')

    # ── 28: Five-layer moat ──
    n = 28
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 0.3, 8.4, 0.5,
                 'Five Layers Deep',
                 size=28, color=WHT, bold=True, font='Montserrat')
    R += mk_text(S(n), B(n), 0.8, 1.0, 8.4, 4.3,
                 '1.  THE ROOM\n'
                 '     The people inside each box.\n'
                 '     Can\u2019t clone a WhatsApp group.\n'
                 '     Can\u2019t manufacture pub trust.\n\n'
                 '2.  DATA\n'
                 '     Months of conviction-vs-truth. Can\u2019t fake.\n'
                 '     Can\u2019t generate retroactively.\n\n'
                 '3.  MECHANISM\n'
                 '     QV + ZK + MACI. 12\u201318 months to replicate.\n\n'
                 '4.  PERSONAL SWARMS\n'
                 '     Co-evolved with each punter. Non-transferable.\n'
                 '     Switching cost is cognitive, not financial.\n\n'
                 '5.  THE VIEW ACROSS ALL BOXES\n'
                 '     Cross-community signal. Exclusively ours.\n'
                 '     No single bookmaker has this view.\n'
                 '     Only the box-builder does.',
                 size=15, color=GRY, spacing=135)

    # ── 29: Risk/reward asymmetry ──
    n = 29
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 0.5, 8.4, 0.7,
                 'The Asymmetry',
                 size=36, color=WHT, bold=True, font='Montserrat', align='CENTER')
    R += mk_text(S(n), X(n, 'down'), 0.8, 1.6, 4.0, 1.5,
                 'DOWNSIDE\n$50\u2013100/month\nin infrastructure',
                 size=20, color=DIM, font='Montserrat', align='CENTER', spacing=150)
    R += mk_text(S(n), X(n, 'up'), 5.2, 1.6, 4.0, 1.5,
                 'UPSIDE\nThe racecourse\nin a $32B market',
                 size=20, color=GOLD, font='Montserrat', bold=True,
                 align='CENTER', spacing=150)
    R += mk_text(S(n), B(n), 0.8, 3.5, 8.4, 1.8,
                 'Comps: Polymarket ($9B). Kalshi ($22B).\n'
                 'Timing: Vitalik endorsement Feb 2026. ACMA Polymarket ban.\n'
                 'ZK market: $1.28B \u2192 $7.59B by 2033.',
                 size=16, color=DIM, align='CENTER', spacing=170)

    # ── 30: The Ask ──
    n = 30
    R += [mk_slide(S(n)), mk_bg(S(n), BG)]
    R += mk_text(S(n), T(n), 0.8, 1.0, 8.4, 1.5,
                 'The game doesn\u2019t need\nto be explained.',
                 size=40, color=WHT, bold=True, font='Montserrat',
                 align='CENTER', spacing=130)
    R += mk_text(S(n), B(n), 0.8, 2.8, 8.4, 1.0,
                 'It needs to be played.',
                 size=40, color=GOLD, bold=True, font='Montserrat', align='CENTER')
    R += mk_text(S(n), X(n, 'cta'), 0.8, 3.9, 8.4, 0.6,
                 'Let\u2019s build it.',
                 size=24, color=DIM, align='CENTER')
    R += mk_text(S(n), X(n, 'b2b'), 0.8, 4.6, 8.4, 0.6,
                 'Want a box with your logo on it?',
                 size=18, color=DIM, align='CENTER')

    return R

# ═══════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════

def main():
    print('Creating presentation...')
    pres = gws('create', body={'title': 'The Conviction Game'})
    pid = pres['presentationId']
    print(f'  ID: {pid}')

    # Find default slide to delete
    default_id = pres['slides'][0]['objectId']

    # Build all slide requests
    print('Building 30 slides...')
    reqs = build_slides()
    reqs.append({'deleteObject': {'objectId': default_id}})

    total = len(reqs)
    print(f'  {total} API requests generated')

    # Send in batches of 150 for safety
    BATCH = 150
    for i in range(0, total, BATCH):
        chunk = reqs[i:i+BATCH]
        end = min(i+BATCH, total)
        print(f'  Sending {i+1}\u2013{end} of {total}...')
        batch(pid, chunk)

    url = f'https://docs.google.com/presentation/d/{pid}/edit'
    print(f'\n\u2713 Deck created!')
    print(f'  {url}')
    return pid

if __name__ == '__main__':
    main()
