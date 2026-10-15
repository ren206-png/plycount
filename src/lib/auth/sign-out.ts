// ============================================================
// Sign out. Three things have to happen, and none may block the others:
//   1. the SERVER ends the session and clears the auth cookies in its
//      response (POST /api/auth/signout) so the next page load is signed out;
//   2. the browser client drops its own local session and in-memory state;
//   3. we do a full page load of /login so nobody is left on a protected page.
// Step 3 always runs, even if 1 or 2 fail.
// ============================================================
interface SignOutClient {
  auth: { signOut: (options?: { scope: 'local' }) => Promise<unknown> }
}

function serverSignOut(): Promise<unknown> {
  return fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' })
}

export async function signOutAndLeave(
  client: SignOutClient,
  navigate: (url: string) => void,
  destination = '/login',
  endSessionOnServer: () => Promise<unknown> = serverSignOut
): Promise<void> {
  try {
    await Promise.allSettled([endSessionOnServer(), client.auth.signOut({ scope: 'local' })])
  } finally {
    navigate(destination)
  }
}
