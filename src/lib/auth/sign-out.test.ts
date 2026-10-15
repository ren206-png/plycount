import { describe, expect, it, vi } from 'vitest'
import { signOutAndLeave } from './sign-out'

function setup(overrides: { server?: () => Promise<unknown>; client?: () => Promise<unknown> } = {}) {
  const calls: string[] = []
  const server = vi.fn(overrides.server ?? (async () => { calls.push('server') }))
  const signOut = vi.fn(overrides.client ?? (async () => { calls.push('client') }))
  const navigate = vi.fn((url: string) => { calls.push('navigate:' + url) })
  return { calls, server, signOut, navigate, client: { auth: { signOut } } }
}

describe('signOutAndLeave', () => {
  it('ends the session on the server and in the browser, then goes to the login page', async () => {
    const { calls, server, signOut, navigate, client } = setup()

    await signOutAndLeave(client, navigate, '/login', server)

    expect(server).toHaveBeenCalledTimes(1)
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(calls.at(-1)).toBe('navigate:/login')
    expect(calls).toContain('server')
    expect(calls).toContain('client')
  })

  it('only navigates after both sign-out steps have finished', async () => {
    let release: () => void = () => {}
    const slow = new Promise<void>((resolve) => { release = resolve })
    const { navigate, client, server } = setup({ server: () => slow })

    const pending = signOutAndLeave(client, navigate, '/login', server)
    await Promise.resolve()
    expect(navigate).not.toHaveBeenCalled()

    release()
    await pending
    expect(navigate).toHaveBeenCalledWith('/login')
  })

  it('still goes to the login page when the server request fails', async () => {
    const { navigate, client, server } = setup({ server: async () => { throw new Error('network down') } })

    await expect(signOutAndLeave(client, navigate, '/login', server)).resolves.toBeUndefined()
    expect(navigate).toHaveBeenCalledWith('/login')
  })

  it('still goes to the login page when the browser sign-out fails', async () => {
    const { navigate, client, server } = setup({ client: async () => { throw new Error('storage blocked') } })

    await expect(signOutAndLeave(client, navigate, '/login', server)).resolves.toBeUndefined()
    expect(navigate).toHaveBeenCalledWith('/login')
  })

  it('can send the user somewhere else', async () => {
    const { navigate, client, server } = setup()
    await signOutAndLeave(client, navigate, '/', server)
    expect(navigate).toHaveBeenCalledWith('/')
  })
})
