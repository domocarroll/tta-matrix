import { json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'

export const GET = () =>
  json({
    ok: true,
    hasKey: Boolean(env.ANTHROPIC_API_KEY),
    model: env.TTA_MODEL || 'claude-sonnet-4-6'
  })
