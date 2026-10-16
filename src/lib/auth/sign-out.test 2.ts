import { describe, expect, it, vi } from 'vitest'
import { signOutAndLeave } from './sign-out'

describe('signOutAndLeave', () => {
  it('signs out and then goes to the login page', async () => {
    const calls: string[] = []
    const client = { auth: { signOut: vi.fn(async () => { calls.push('signOut') }) } }
    const navigate = vi.fn((url: string) => { calls.push('navigate:' + url) })

    await signOutAndLeave(client, navigate)

    expect(client.auth.signOut).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/login')
    expect(calls).toEqual(['signOut', 'navigate:/login'])
  })

  it('still goes to the login page when the sign-out request fails', async () => {
    const client = { auth: { signOut: vi.fn(async () => { throw new Error('network down') }) } }
    const navigate = vi.fn()

    await expect(signOutAndLeave(client, navigate)).rejects.toThrow('network down')
    expect(navigate).toHaveBeenCalledWith('/login')
  })

  it('can send the user somewhere else', async () => {
    const client = { auth: { signOut: vi.fn(async () => undefined) } }
    const navigate = vi.fn()

    await signOutAndLeave(client, navigate, '/')
    expect(navigate).toHaveBeenCalledWith('/')
  })
})
