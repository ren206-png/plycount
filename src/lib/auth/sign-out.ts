// ============================================================
// Sign out. Ending the Supabase session is not enough on its own: the
// dashboard is already rendered and nothing re-runs the middleware, so
// without a navigation the page just sits there and the button looks
// broken. After signing out we always do a full page load of /login
// (which also clears any in-memory state), even if the sign-out request
// itself failed, so the user is never left stranded on a protected page.
// ============================================================
interface SignOutClient {
  auth: { signOut: () => Promise<unknown> }
}

export async function signOutAndLeave(
  client: SignOutClient,
  navigate: (url: string) => void,
  destination = '/login'
): Promise<void> {
  try {
    await client.auth.signOut()
  } finally {
    navigate(destination)
  }
}
