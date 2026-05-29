// 3-Gate workspace is the front door. /classic stays reachable as a
// rollback escape hatch for one week. Reversible: change target back to
// '/classic' (or delete this file to restore the single-shot landing).
import { redirect } from '@sveltejs/kit'

export const load = () => {
  redirect(308, '/work')
}
