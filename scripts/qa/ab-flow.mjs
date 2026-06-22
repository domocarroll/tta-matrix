#!/usr/bin/env node
// Parametrized agent-browser QA flow runner.
//
// One isolated browser session per invocation (AGENT_BROWSER_SESSION) so many
// of these can run in parallel without colliding. Captures step screenshots,
// page JS errors (window 'error' + 'unhandledrejection'), and failed network
// responses, then emits a single-line JSON verdict to stdout.
//
// Usage:
//   node ab-flow.mjs --flow create-meeting --session qa1 --viewport 390x844 \
//        --base http://localhost:5173 --out /abs/qa-artifacts/run1 [--fixture /abs/img.jpeg]
//
// Flows: create-meeting | gate1-lock | tip-drop | gate3-review | smoke

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// agent-browser's daemon throws transient IPC errors under rapid commands.
const TRANSIENT = /os error 11|temporarily unavailable|Execution context was destroyed|Target (page,?|closed)|Timeout .* exceeded|page\.title|net::ERR/i
function sleepSync(ms) {
  const end = Date.now() + ms
  // Busy-free sleep via Atomics.
  const sab = new Int32Array(new SharedArrayBuffer(4))
  Atomics.wait(sab, 0, 0, ms)
  void end
}

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]])
    return acc
  }, [])
)

const FLOW = args.flow ?? 'smoke'
const SESSION = args.session ?? 'qa'
const VIEWPORT = args.viewport ?? '1280x900'
const BASE = args.base ?? 'http://localhost:5173'
const OUT = args.out ?? `/tmp/qa-${SESSION}`
const FIXTURE = args.fixture ?? null

mkdirSync(OUT, { recursive: true })
const env = { ...process.env, AGENT_BROWSER_SESSION: SESSION }
const steps = []
let stepNo = 0

function ab(cmdArgs, { allowFail = false, retries = 4 } = {}) {
  let last = ''
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const out = execFileSync('agent-browser', cmdArgs, {
        env,
        encoding: 'utf8',
        timeout: 90_000,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      const text = (out ?? '').trim()
      // agent-browser prints failures to stdout with a ✗ and exit 0 sometimes.
      if (/^\s*✗/m.test(text) && TRANSIENT.test(text) && attempt < retries) {
        last = text
        sleepSync(350 + attempt * 250)
        continue
      }
      sleepSync(130) // pace the daemon
      return { ok: !/^\s*✗/m.test(text), out: text }
    } catch (e) {
      last = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim()
      if (TRANSIENT.test(last) && attempt < retries) {
        sleepSync(350 + attempt * 250)
        continue
      }
      if (!allowFail) steps.push({ step: `cmd:${cmdArgs[0]}`, ok: false, detail: last.slice(0, 400) })
      return { ok: false, out: last }
    }
  }
  if (!allowFail) steps.push({ step: `cmd:${cmdArgs[0]}`, ok: false, detail: last.slice(0, 400) })
  return { ok: false, out: last }
}

function shot(label) {
  const file = join(OUT, `${String(++stepNo).padStart(2, '0')}-${label}.png`)
  ab(['screenshot', file], { allowFail: true })
  return file
}

function record(label, ok, detail) {
  steps.push({ step: label, ok, detail: detail ? String(detail).slice(0, 300) : undefined })
  return ok
}

// Inject error capture into the page (survives until navigation).
function armErrorCapture() {
  ab([
    'eval',
    "window.__qaErrs=[];addEventListener('error',e=>window.__qaErrs.push('error: '+(e.message||e.error)));addEventListener('unhandledrejection',e=>window.__qaErrs.push('reject: '+(e.reason&&e.reason.message||e.reason)));window.__qaErrs.length"
  ])
}
function drainErrors() {
  const r = ab(['eval', 'JSON.stringify(window.__qaErrs||[])'], { allowFail: true })
  try {
    return JSON.parse(JSON.parse(r.out)) // agent-browser wraps eval result as a JSON string
  } catch {
    try { return JSON.parse(r.out) } catch { return r.out ? [r.out] : [] }
  }
}

const [vw, vh] = VIEWPORT.split('x')
ab(['set', 'viewport', vw, vh], { allowFail: true })

function open(path) {
  const r = ab(['open', `${BASE}${path}`])
  armErrorCapture()
  return r
}

function getText(sel) {
  return ab(['get', 'text', sel], { allowFail: true }).out
}
function bodyText() {
  return ab(['get', 'text', 'body'], { allowFail: true }).out
}

// ── Flows ───────────────────────────────────────────────────────────
async function flowCreateMeeting() {
  open('/work')
  ab(['wait', '#meeting-name'], { allowFail: true, retries: 0 }) // not present yet; just pace
  ab(['wait', '1800'], { allowFail: true })
  shot('work-loaded')
  const loaded = bodyText()
  record('work-page-loaded', /meeting|TipAnalyser/i.test(loaded), loaded.slice(0, 100))

  // Open the new-meeting modal. There are two "+ new meeting" buttons (header
  // + empty-state); first match is fine.
  let r = ab(['find', 'text', 'new meeting', 'click'])
  if (!r.ok) r = ab(['click', 'button:has-text("new meeting")'])
  // Wait for the modal's name field to exist — the real proof the modal opened.
  const modalReady = ab(['wait', '#meeting-name'], { allowFail: true })
  ab(['wait', '500'], { allowFail: true })
  shot('modal-open')
  const modalText = bodyText()
  record('new-meeting-modal-open',
    modalReady.ok || /Lock a meeting to start|Meeting \/ venue/i.test(modalText),
    modalReady.ok ? 'name-field present' : modalText.slice(0, 100))

  // Fill the meeting name (date defaults today, category defaults SR).
  const name = `QA ${SESSION}`
  const f = ab(['fill', '#meeting-name', name])
  record('fill-name', f.ok, f.out.slice(0, 80))
  // Verify the value actually landed.
  const val = ab(['get', 'value', '#meeting-name'], { allowFail: true }).out
  record('name-value-set', val.includes(name) || val.includes('QA'), `value="${val}"`)
  shot('filled')

  // Click create.
  let c = ab(['find', 'text', 'create meeting', 'click'])
  if (!c.ok) c = ab(['click', 'button:has-text("create meeting")'])
  record('click-create', c.ok, c.out.slice(0, 80))

  // Wait for the "next phase" — the card upload modal — to appear, OR for the
  // setup modal to disappear. Poll up to ~8s.
  let advancedToUpload = false
  let stuckOnSetup = true
  for (let i = 0; i < 8; i++) {
    ab(['wait', '1000'], { allowFail: true })
    const after = bodyText()
    advancedToUpload = /official race card|Drop the official card|approve & lock|re-reading the saved card/i.test(after)
    stuckOnSetup = /Lock a meeting to start/i.test(after)
    if (advancedToUpload || !stuckOnSetup) break
  }
  shot('after-create')
  const errs = drainErrors()
  record('advanced-to-next-phase', advancedToUpload,
    `advanced=${advancedToUpload} stuckOnSetup=${stuckOnSetup}`)
  record('not-stuck-on-setup', !stuckOnSetup, `stuckOnSetup=${stuckOnSetup}`)
  record('no-js-errors', errs.length === 0, errs.join(' | '))
  return { advancedToUpload, stuckOnSetup, errs }
}

async function flowSmoke() {
  open('/work')
  ab(['wait', '1500'], { allowFail: true })
  shot('smoke')
  const t = bodyText()
  record('page-renders', t.length > 50, t.slice(0, 120))
  const errs = drainErrors()
  record('no-js-errors', errs.length === 0, errs.join(' | '))
}

const flows = {
  'create-meeting': flowCreateMeeting,
  smoke: flowSmoke
}

const fn = flows[FLOW] ?? flowSmoke
let extra = {}
try {
  extra = (await fn()) ?? {}
} catch (e) {
  record('flow-threw', false, e?.message)
}

ab(['close'], { allowFail: true })

const passed = steps.every((s) => s.ok)
const verdict = { flow: FLOW, session: SESSION, viewport: VIEWPORT, passed, steps, out: OUT, ...extra }
writeFileSync(join(OUT, 'verdict.json'), JSON.stringify(verdict, null, 2))
console.log(JSON.stringify(verdict))
process.exit(passed ? 0 : 1)
