#!/usr/bin/env python3
"""
The Conviction Game — Protocol & Data Economy Slides (31-35)

Appends 5 new slides to the existing 30-slide deck.
Covers the open protocol pivot + composable intelligence API.

Uses the SAME gws CLI pattern as build_deck.py.

Usage: python3 update_deck_protocol.py
"""

import json
import subprocess
import sys

# ═══════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════

PRESENTATION_ID = '1HfJX8BqqWALL1_dAe5O-TCwwCCRV6E6XkVRojZlRxdQ'

EMU = 914400  # 1 inch in EMU

def e(inches):
    return int(inches * EMU)

# Color palette (RGB 0-1 floats) — matches build_deck.py
BG      = {'red': 0.051, 'green': 0.067, 'blue': 0.090}  # #0d1117
BG_SECT = {'red': 0.067, 'green': 0.051, 'blue': 0.098}  # #110d19
BG_WARM = {'red': 0.090, 'green': 0.059, 'blue': 0.051}  # #170f0d
GOLD    = {'red': 0.941, 'green': 0.753, 'blue': 0.251}  # #f0c040
RED     = {'red': 0.914, 'green': 0.271, 'blue': 0.376}  # #e94560
WHT     = {'red': 1.0,   'green': 1.0,   'blue': 1.0}
GRY     = {'red': 0.73,  'green': 0.73,  'blue': 0.76}
DIM     = {'red': 0.45,  'green': 0.45,  'blue': 0.50}

# New colors for protocol section
BG_PROTO = {'red': 0.051, 'green': 0.102, 'blue': 0.090}  # #0d1a17
BG_DEEP  = {'red': 0.051, 'green': 0.059, 'blue': 0.102}  # #0d0f1a
BG_ASK   = {'red': 0.039, 'green': 0.055, 'blue': 0.090}  # #0a0e17

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
# Request Builders (same as build_deck.py)
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

def mk_line(page, oid, x, y, w, h, color):
    """Create a horizontal line (rectangle shape used as divider)."""
    return {'createShape': {
        'objectId': oid,
        'shapeType': 'RECTANGLE',
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
    }}

def mk_line_fill(oid, color):
    """Fill a line/rectangle shape with a solid color, matching outline."""
    return [
        {'updateShapeProperties': {
            'objectId': oid,
            'shapeProperties': {
                'shapeBackgroundFill': {
                    'solidFill': {'color': {'rgbColor': color}}
                },
                'outline': {
                    'outlineFill': {
                        'solidFill': {'color': {'rgbColor': color}}
                    },
                    'weight': {'magnitude': 0.5, 'unit': 'PT'}
                }
            },
            'fields': 'shapeBackgroundFill.solidFill.color,outline'
        }}
    ]

# ═══════════════════════════════════════════════════════════
# Update Moat Slide (28) — add 6th layer
# ═══════════════════════════════════════════════════════════

def update_moat_slide():
    """
    Try to update the moat section divider (slide 27) subtitle
    from 'Five layers' to 'Six layers'.
    Also update slide 28 body text to include the 6th moat layer.

    This uses deleteText + insertText on existing object IDs.
    If the objects don't exist (different IDs), we skip gracefully.
    """
    reqs = []

    # Update section divider subtitle: "Five layers" -> "Six layers"
    # Object ID from build_deck.py: body_27
    try:
        reqs.append({'deleteText': {
            'objectId': 'body_27',
            'textRange': {'type': 'ALL'}
        }})
        reqs.append({'insertText': {
            'objectId': 'body_27',
            'text': 'Six layers. Each reinforces the others.',
            'insertionIndex': 0
        }})
        reqs.append({'updateTextStyle': {
            'objectId': 'body_27',
            'style': {
                'fontSize': {'magnitude': 22, 'unit': 'PT'},
                'foregroundColor': {'opaqueColor': {'rgbColor': DIM}},
                'fontFamily': 'Open Sans'
            },
            'textRange': {'type': 'ALL'},
            'fields': 'fontSize,foregroundColor,fontFamily'
        }})
        reqs.append({'updateParagraphStyle': {
            'objectId': 'body_27',
            'style': {
                'alignment': 'CENTER',
                'lineSpacing': 150
            },
            'textRange': {'type': 'ALL'},
            'fields': 'alignment,lineSpacing'
        }})
    except Exception:
        pass

    # Update moat slide title: "Five Layers Deep" -> "Six Layers Deep"
    try:
        reqs.append({'deleteText': {
            'objectId': 'title_28',
            'textRange': {'type': 'ALL'}
        }})
        reqs.append({'insertText': {
            'objectId': 'title_28',
            'text': 'Six Layers Deep',
            'insertionIndex': 0
        }})
        reqs.append({'updateTextStyle': {
            'objectId': 'title_28',
            'style': {
                'fontSize': {'magnitude': 28, 'unit': 'PT'},
                'foregroundColor': {'opaqueColor': {'rgbColor': WHT}},
                'bold': True,
                'fontFamily': 'Montserrat'
            },
            'textRange': {'type': 'ALL'},
            'fields': 'fontSize,foregroundColor,bold,fontFamily'
        }})
    except Exception:
        pass

    # Update moat body with 6 layers instead of 5
    try:
        reqs.append({'deleteText': {
            'objectId': 'body_28',
            'textRange': {'type': 'ALL'}
        }})
        reqs.append({'insertText': {
            'objectId': 'body_28',
            'text': (
                '1.  THE ROOM\n'
                '     The people inside each box. Can\u2019t clone. Can\u2019t fake.\n\n'
                '2.  DATA\n'
                '     Months of conviction-vs-truth. Can\u2019t generate retroactively.\n\n'
                '3.  MECHANISM\n'
                '     QV + ZK + MACI. 12\u201318 months to replicate.\n\n'
                '4.  PERSONAL SWARMS\n'
                '     Co-evolved with each punter. Non-transferable.\n\n'
                '5.  NETWORK EFFECTS\n'
                '     More boxes \u2192 richer aggregate \u2192 more boxes.\n\n'
                '6.  META-INTELLIGENCE\n'
                '     Cross-box aggregation. Exclusively ours.\n'
                '     The ONLY layer that can\u2019t be self-hosted.'
            ),
            'insertionIndex': 0
        }})
        reqs.append({'updateTextStyle': {
            'objectId': 'body_28',
            'style': {
                'fontSize': {'magnitude': 14, 'unit': 'PT'},
                'foregroundColor': {'opaqueColor': {'rgbColor': GRY}},
                'fontFamily': 'Open Sans'
            },
            'textRange': {'type': 'ALL'},
            'fields': 'fontSize,foregroundColor,fontFamily'
        }})
        reqs.append({'updateParagraphStyle': {
            'objectId': 'body_28',
            'style': {
                'lineSpacing': 130
            },
            'textRange': {'type': 'ALL'},
            'fields': 'lineSpacing'
        }})
    except Exception:
        pass

    return reqs

# ═══════════════════════════════════════════════════════════
# New Slides (31-35)
# ═══════════════════════════════════════════════════════════

def build_protocol_slides():
    R = []

    # ── Slide 31: THE PROTOCOL (section divider) ──
    sid = 'protocol_div'
    R += [mk_slide(sid), mk_bg(sid, BG_PROTO)]
    R += mk_text(sid, f'{sid}_title', 0.8, 1.5, 8.4, 1.2,
                 'THE PROTOCOL',
                 size=48, color=GOLD, bold=True, font='Montserrat', align='CENTER')
    # Gold divider line (0.83 inches wide, ~0.03 inches tall)
    line_id = f'{sid}_line'
    R.append(mk_line(sid, line_id, 4.08, 2.85, 0.83, 0.03, GOLD))
    R += mk_line_fill(line_id, GOLD)
    R += mk_text(sid, f'{sid}_sub', 0.8, 3.2, 8.4, 0.8,
                 'Linux, not Salesforce.',
                 size=22, color=DIM, align='CENTER')

    # ── Slide 32: Anyone Can Build a Box ──
    sid = 'protocol_box'
    R += [mk_slide(sid), mk_bg(sid, BG_PROTO)]
    R += mk_text(sid, f'{sid}_title', 0.8, 0.4, 8.4, 0.8,
                 'Anyone Can Build a Box',
                 size=36, color=WHT, bold=True, font='Montserrat')
    R += mk_text(sid, f'{sid}_body', 0.8, 1.6, 8.4, 1.8,
                 'Your mates. A racing club. A pub league.\n'
                 'Self-hosted. Raspberry Pi. $5 VPS.',
                 size=20, color=GRY, spacing=170)
    R += mk_text(sid, f'{sid}_cmd', 0.8, 3.0, 8.4, 0.7,
                 'npx conviction init',
                 size=28, color=GOLD, bold=True, font='Roboto Mono',
                 align='START', spacing=150)
    R += mk_text(sid, f'{sid}_dim', 0.8, 3.9, 8.4, 1.2,
                 'Bridges to WhatsApp. Sportsbet. Discord.\n'
                 'No permission needed.',
                 size=18, color=DIM, spacing=160)

    # ── Slide 33: We Sell the View ──
    sid = 'protocol_view'
    R += [mk_slide(sid), mk_bg(sid, BG_PROTO)]
    R += mk_text(sid, f'{sid}_free', 0.8, 1.0, 8.4, 0.7,
                 'The boxes are free.',
                 size=28, color=WHT, bold=True, font='Montserrat',
                 align='CENTER')
    R += mk_text(sid, f'{sid}_gold', 0.8, 1.9, 8.4, 1.5,
                 'The view across all boxes\nis the product.',
                 size=40, color=GOLD, bold=True, font='Montserrat',
                 align='CENTER', spacing=130)
    R += mk_text(sid, f'{sid}_dim', 0.8, 3.8, 8.4, 0.8,
                 'Where communities disagree = actionable alpha.',
                 size=18, color=DIM, align='CENTER')

    # ── Slide 34: Composable Intelligence ──
    sid = 'data_compose'
    R += [mk_slide(sid), mk_bg(sid, BG_DEEP)]
    R += mk_text(sid, f'{sid}_title', 0.8, 0.3, 8.4, 0.7,
                 'Composable Intelligence',
                 size=36, color=WHT, bold=True, font='Montserrat')
    # API tier list — each line styled with appropriate color
    # Free tier (dim)
    R += mk_text(sid, f'{sid}_t1', 1.0, 1.4, 5.5, 0.5,
                 '/signals/consensus',
                 size=18, color=DIM, font='Roboto Mono')
    R += mk_text(sid, f'{sid}_l1', 7.0, 1.4, 2.5, 0.5,
                 'FREE',
                 size=18, color=DIM, font='Roboto Mono', bold=True)
    # Paid tiers (gold)
    R += mk_text(sid, f'{sid}_t2', 1.0, 1.9, 5.5, 0.5,
                 '/signals/divergence',
                 size=18, color=GOLD, font='Roboto Mono')
    R += mk_text(sid, f'{sid}_l2', 7.0, 1.9, 2.5, 0.5,
                 'PAID',
                 size=18, color=GOLD, font='Roboto Mono', bold=True)
    R += mk_text(sid, f'{sid}_t3', 1.0, 2.4, 5.5, 0.5,
                 '/signals/historical',
                 size=18, color=GOLD, font='Roboto Mono')
    R += mk_text(sid, f'{sid}_l3', 7.0, 2.4, 2.5, 0.5,
                 'PAID',
                 size=18, color=GOLD, font='Roboto Mono', bold=True)
    # Premium tier (gold, bold)
    R += mk_text(sid, f'{sid}_t4', 1.0, 2.9, 5.5, 0.5,
                 '/signals/anomaly',
                 size=18, color=GOLD, font='Roboto Mono', bold=True)
    R += mk_text(sid, f'{sid}_l4', 7.0, 2.9, 2.5, 0.5,
                 'PREMIUM',
                 size=18, color=GOLD, font='Roboto Mono', bold=True)
    # Enterprise tier (gold, bold)
    R += mk_text(sid, f'{sid}_t5', 1.0, 3.4, 5.5, 0.5,
                 '/atoms/compose',
                 size=18, color=GOLD, font='Roboto Mono', bold=True)
    R += mk_text(sid, f'{sid}_l5', 7.0, 3.4, 2.5, 0.5,
                 'ENTERPRISE',
                 size=18, color=GOLD, font='Roboto Mono', bold=True)
    # Tagline
    R += mk_text(sid, f'{sid}_tag', 0.8, 4.2, 8.4, 0.7,
                 'SQL for market intelligence.',
                 size=24, color=GOLD, bold=True, font='Montserrat',
                 align='CENTER')

    # ── Slide 35: Updated Ask ──
    sid = 'ask_updated'
    R += [mk_slide(sid), mk_bg(sid, BG_ASK)]
    R += mk_text(sid, f'{sid}_top', 0.8, 1.0, 8.4, 1.2,
                 'The game doesn\u2019t need to be explained.',
                 size=36, color=WHT, bold=True, font='Montserrat',
                 align='CENTER')
    R += mk_text(sid, f'{sid}_gold', 0.8, 2.4, 8.4, 1.0,
                 'It needs to be played.',
                 size=40, color=GOLD, bold=True, font='Montserrat',
                 align='CENTER')
    R += mk_text(sid, f'{sid}_cta', 0.8, 3.8, 8.4, 1.2,
                 'Want to run a box?\n'
                 'Want the view across all of them?',
                 size=20, color=DIM, align='CENTER', spacing=170)

    return R

# ═══════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════

def main():
    pid = PRESENTATION_ID

    # Verify presentation exists and get current slide count
    print('Reading existing presentation...')
    pres = gws('get',
               params={'presentationId': pid})
    slide_count = len(pres.get('slides', []))
    print(f'  Found {slide_count} existing slides.')

    # Update moat slide text (slides 27-28)
    print('Updating moat slides (27-28) to six layers...')
    moat_reqs = update_moat_slide()
    if moat_reqs:
        try:
            batch(pid, moat_reqs)
            print('  Moat slides updated.')
        except Exception as ex:
            print(f'  Warning: Could not update moat slides: {ex}')
            print('  Continuing with new slides...')

    # Build new protocol slides (31-35)
    print('Building protocol slides (31-35)...')
    reqs = build_protocol_slides()
    total = len(reqs)
    print(f'  {total} API requests generated')

    # Send in batches of 150 for safety
    BATCH = 150
    for i in range(0, total, BATCH):
        chunk = reqs[i:i + BATCH]
        end = min(i + BATCH, total)
        print(f'  Sending {i + 1}\u2013{end} of {total}...')
        batch(pid, chunk)

    url = f'https://docs.google.com/presentation/d/{pid}/edit'
    print(f'\n\u2713 Protocol slides appended!')
    print(f'  Slides 31-35 added to existing deck.')
    print(f'  {url}')
    return pid

if __name__ == '__main__':
    main()
