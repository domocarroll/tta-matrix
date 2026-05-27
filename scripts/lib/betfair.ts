// ──────────────────────────────────────────────────────
// Betfair Exchange API — authoritative race-field resolver
// ──────────────────────────────────────────────────────
//
// Replaces the Perplexity open-web workaround with a structured,
// licensed-source feed. Betfair `listMarketCatalogue` + RUNNER_METADATA
// returns exactly the card we need per race per meeting:
//   CLOTH_NUMBER → horse number   runnerName → horse name
//   JOCKEY_NAME  → jockey          TRAINER_NAME → trainer
//   STALL_DRAW   → barrier
//
// Why Betfair (see memory tta-field-source-legality):
//  - data from a LICENSED operator → drops the AU race-fields grey zone
//  - free delayed app key (no £499 live key needed for pre-race fields)
//  - real global developer API → no geo-block (unlike TAB/Neds = HTTP 000)
//
// Credentials (env or repo .env), set after YOU create the account+key:
//   BETFAIR_USERNAME, BETFAIR_PASSWORD, BETFAIR_APP_KEY
// Optional overrides:
//   BETFAIR_IDENTITY_URL (default https://identitysso.betfair.com/api/login)
//   BETFAIR_API_URL      (default https://api.betfair.com/exchange/betting/rest/v1.0)
//
// Returns the SAME shape as the Perplexity resolver so the pipeline is
// source-agnostic: { byRace: Map<number, FieldRunner[]>, citations }.

import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import type { FieldRunner } from '../../packages/shared/src/index.ts'

const IDENTITY_URL = process.env.BETFAIR_IDENTITY_URL || 'https://identitysso.betfair.com/api/login'
const API_URL = process.env.BETFAIR_API_URL || 'https://api.betfair.com/exchange/betting/rest/v1.0'
const HORSE_RACING_EVENT_TYPE = '7'

function envOrDotenv(key: string): string | undefined {
  if (process.env[key]) return process.env[key]
  for (const p of ['.env', 'packages/web/.env']) {
    try {
      const m = readFileSync(resolvePath(process.cwd(), p), 'utf8').match(
        new RegExp(`^${key}=(.*)$`, 'm'),
      )
      if (m) return m[1].trim()
    } catch {
      /* next */
    }
  }
  return undefined
}

interface Creds {
  username: string
  password: string
  appKey: string
}

function loadCreds(): Creds | null {
  const username = envOrDotenv('BETFAIR_USERNAME')
  const password = envOrDotenv('BETFAIR_PASSWORD')
  const appKey = envOrDotenv('BETFAIR_APP_KEY')
  if (!username || !password || !appKey) return null
  return { username, password, appKey }
}

// Session token cached for the life of the process (one login per run).
let sessionToken: string | null = null
let sessionAppKey: string | null = null

async function login(creds: Creds): Promise<string | null> {
  if (sessionToken) return sessionToken
  const res = await fetch(IDENTITY_URL, {
    method: 'POST',
    headers: {
      'X-Application': creds.appKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: `username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`,
  })
  if (!res.ok) {
    console.warn(`    betfair login HTTP ${res.status} ${res.statusText}`)
    return null
  }
  const data = (await res.json()) as { token?: string; status?: string; error?: string }
  if (data.status !== 'SUCCESS' || !data.token) {
    console.warn(`    betfair login failed: ${data.status} ${data.error ?? ''}`)
    return null
  }
  sessionToken = data.token
  sessionAppKey = creds.appKey
  return sessionToken
}

interface MarketRunner {
  selectionId: number
  runnerName: string
  metadata?: Record<string, string | null>
}
interface MarketCatalogue {
  marketId: string
  marketName: string
  marketStartTime?: string
  runners?: MarketRunner[]
}

/** Pull the runner number from a Betfair AU win-market name like "R3 1200m". */
function parseRaceNumber(marketName: string): number | null {
  const m = marketName.match(/^R(\d+)/i) || marketName.match(/\bRace\s*(\d+)/i)
  return m ? Number(m[1]) : null
}

function toFieldRunner(r: MarketRunner): FieldRunner | null {
  const md = r.metadata ?? {}
  const number = Number(md.CLOTH_NUMBER)
  const name = (r.runnerName || '').trim()
  if (!Number.isFinite(number) || number <= 0 || name === '') return null
  return {
    number,
    name,
    jockey: (md.JOCKEY_NAME || 'TBA').trim() || 'TBA',
    trainer: (md.TRAINER_NAME || 'TBA').trim() || 'TBA',
    barrier: Number.isFinite(Number(md.STALL_DRAW)) ? Number(md.STALL_DRAW) : 0,
    scratched: false, // catalogue lists active runners; scratchings need listMarketBook
  }
}

/**
 * Resolve the official field for a meeting+date from Betfair.
 * @param meeting venue name as Betfair lists it ("Doomben", "Randwick")
 * @param date    YYYY-MM-DD (race date)
 */
export async function resolveFieldBetfair(
  meeting: string,
  date: string,
): Promise<{ byRace: Map<number, FieldRunner[]>; citations: string[] } | null> {
  if (!meeting || meeting.toLowerCase() === 'unknown') return null
  const creds = loadCreds()
  if (!creds) {
    console.warn('    betfair creds missing (BETFAIR_USERNAME/PASSWORD/APP_KEY)')
    return null
  }
  const token = await login(creds)
  if (!token) return null

  // AU race day spans the UTC boundary; a 36h window from local-midnight-UTC
  // safely covers it without pulling the next day's metro card.
  const from = `${date}T00:00:00Z`
  const to = new Date(new Date(from).getTime() + 36 * 3600_000).toISOString().replace(/\.\d+Z$/, 'Z')

  const body = {
    filter: {
      eventTypeIds: [HORSE_RACING_EVENT_TYPE],
      marketCountries: ['AU'],
      marketTypeCodes: ['WIN'],
      venues: [meeting],
      marketStartTime: { from, to },
    },
    marketProjection: ['RUNNER_METADATA', 'MARKET_START_TIME', 'EVENT'],
    maxResults: '200',
    sort: 'FIRST_TO_START',
  }

  const res = await fetch(`${API_URL}/listMarketCatalogue/`, {
    method: 'POST',
    headers: {
      'X-Application': sessionAppKey as string,
      'X-Authentication': token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.warn(`    betfair listMarketCatalogue HTTP ${res.status} ${res.statusText}`)
    return null
  }
  const markets = (await res.json()) as MarketCatalogue[]
  if (!Array.isArray(markets) || markets.length === 0) return null

  // Order by start time so we can fall back to positional race numbers.
  const ordered = [...markets].sort((a, b) =>
    (a.marketStartTime ?? '').localeCompare(b.marketStartTime ?? ''),
  )
  const byRace = new Map<number, FieldRunner[]>()
  ordered.forEach((mkt, i) => {
    const raceNumber = parseRaceNumber(mkt.marketName) ?? i + 1
    const runners = (mkt.runners ?? [])
      .map(toFieldRunner)
      .filter((r): r is FieldRunner => r !== null)
    if (runners.length > 0) byRace.set(raceNumber, runners)
  })
  if (byRace.size === 0) return null

  return {
    byRace,
    citations: [`betfair:listMarketCatalogue venue=${meeting} date=${date}`],
  }
}

// Standalone CLI for validating creds + a meeting:
//   npx tsx scripts/lib/betfair.ts "Doomben" 2026-05-23
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , meeting, date] = process.argv
  if (!meeting || !date) {
    console.error('usage: npx tsx scripts/lib/betfair.ts "<Venue>" <YYYY-MM-DD>')
    process.exit(1)
  }
  resolveFieldBetfair(meeting, date)
    .then((r) => {
      if (!r) {
        console.error('No field resolved (check creds / venue / date).')
        process.exit(1)
      }
      console.log(`✓ ${r.byRace.size} races resolved for ${meeting} ${date}`)
      for (const [raceNum, runners] of [...r.byRace.entries()].sort((a, b) => a[0] - b[0])) {
        console.log(`  R${raceNum}: ${runners.length} runners`)
        for (const x of runners.slice(0, 3))
          console.log(`     #${x.number} ${x.name} — ${x.jockey} (bar ${x.barrier})`)
      }
    })
    .catch((e) => {
      console.error('FATAL:', e instanceof Error ? e.message : e)
      process.exit(1)
    })
}
