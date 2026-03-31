import { writable } from 'svelte/store'

// Holds the current user's Firestore profile + uid.
// Populated by +layout.svelte once after auth resolves.
// null = unauthenticated (or profile not yet loaded)
export const userProfile = writable(null)
