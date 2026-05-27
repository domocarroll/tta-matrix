// Classic (v0) is the interface Pete is onboarded on — make it the front
// door. The old single-shot UI in +page.svelte is preserved but routed past.
// Reversible: delete this file to restore the single-shot landing.
import { redirect } from '@sveltejs/kit'

export const load = () => {
  redirect(308, '/classic')
}
