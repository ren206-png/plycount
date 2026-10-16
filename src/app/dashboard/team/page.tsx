'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/AuthProvider'
import type { UserProfile } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input, Label, Select } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import {
  ROLE_BLURB,
  STATUS_LABEL,
  assignableRoles,
  memberPermissions,
  roleLabel,
  type InvitableRole,
  type MemberStatus,
} from '@/lib/team'
import { toast } from 'sonner'

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
  invited: 'bg-blue-100 text-blue-700',
  deactivated: 'bg-gray-100 text-gray-500',
}

export default function TeamPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { profile, organization } = useAuth()

  const myRole = profile?.role
  const roles = myRole ? assignableRoles(myRole) : []

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<InvitableRole>('sales_rep')

  const { data: members, isLoading } = useQuery({
    queryKey: ['team'],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('user_profiles').select('*').order('created_at')
      if (error) throw error
      return data as UserProfile[]
    },
  })

  // A platform admin can read every company's people; only this company's are the team.
  const team = (members ?? []).filter((m) => m.organization_id === organization?.id && m.role !== 'client_viewer')

  const invite = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName, role }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Could not send the invitation.')
      return body as { email: string }
    },
    onSuccess: (b) => {
      toast.success(`Invitation sent to ${b.email}`)
      setEmail('')
      setFullName('')
      queryClient.invalidateQueries({ queryKey: ['team'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // These go straight to the database, which applies the same rules and is the
  // real gatekeeper; the buttons below just hide what it would refuse.
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<UserProfile, 'role' | 'status'>> }) => {
      const { error } = await supabase.from('user_profiles').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Saved')
      queryClient.invalidateQueries({ queryKey: ['team'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">Team</h1>
      <p className="mb-6 text-sm text-gray-500">The people who can sign in to {organization?.name ?? 'your company'}, and what they can do.</p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {(['administrator', 'sales_rep'] as const).map((r) => (
          <div key={r} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="font-semibold text-gray-900">{roleLabel(r)}</p>
            <p className="mt-1 text-sm text-gray-600">{ROLE_BLURB[r]}</p>
          </div>
        ))}
      </div>

      {roles.length > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            invite.mutate()
          }}
          className="mb-8 grid grid-cols-2 items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-6"
        >
          <div className="col-span-2 sm:col-span-2">
            <Label>Full name</Label>
            <Input required maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="col-span-2 sm:col-span-2">
            <Label>Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="col-span-1 sm:col-span-1">
            <Label>Role</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value as InvitableRole)}>
              {roles.map((r) => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={invite.isPending || !email || !fullName.trim()}>
            {invite.isPending ? 'Sending…' : 'Send invitation'}
          </Button>
          <p className="col-span-2 text-xs text-gray-500 sm:col-span-6">
            They get an email with a link to choose a password. If they do not get it, they can use &ldquo;Forgot
            password&rdquo; on the sign-in page with the same address. {role === 'administrator' && 'A manager has full access to costs and invoices: only add people you trust.'}
          </p>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last sign-in</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && <tr><td className="px-4 py-6 text-gray-500" colSpan={5}>Loading…</td></tr>}
            {team.map((m) => {
              const perms =
                myRole && profile
                  ? memberPermissions({ role: myRole, authUserId: profile.auth_user_id }, { role: m.role, authUserId: m.auth_user_id })
                  : { canChangeRole: false, canChangeAccess: false }
              const isMe = m.auth_user_id === profile?.auth_user_id
              return (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{m.full_name}{isMe && <span className="ml-2 text-xs text-gray-400">(you)</span>}</span>
                    <span className="block text-xs text-gray-500">{m.email}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {perms.canChangeRole && (m.role === 'administrator' || m.role === 'sales_rep') ? (
                      <Select
                        value={m.role}
                        aria-label={`Role for ${m.full_name}`}
                        disabled={update.isPending}
                        onChange={(e) => update.mutate({ id: m.id, patch: { role: e.target.value as UserProfile['role'] } })}
                      >
                        <option value="administrator">{roleLabel('administrator')}</option>
                        <option value="sales_rep">{roleLabel('sales_rep')}</option>
                      </Select>
                    ) : (
                      roleLabel(m.role)
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_STYLE[m.status])}>
                      {STATUS_LABEL[m.status as MemberStatus] ?? m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{m.last_login_at ? new Date(m.last_login_at).toLocaleDateString() : 'Never'}</td>
                  <td className="px-4 py-3 text-right">
                    {perms.canChangeAccess && m.status === 'active' && (
                      <button
                        type="button"
                        className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                        disabled={update.isPending}
                        onClick={() => {
                          if (window.confirm(`Suspend ${m.full_name}? They will be signed out of access immediately.`)) {
                            update.mutate({ id: m.id, patch: { status: 'suspended' } })
                          }
                        }}
                      >
                        Suspend
                      </button>
                    )}
                    {perms.canChangeAccess && m.status === 'suspended' && (
                      <button
                        type="button"
                        className="text-sm font-medium text-brand-600 hover:underline disabled:opacity-50"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: m.id, patch: { status: 'active' } })}
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
