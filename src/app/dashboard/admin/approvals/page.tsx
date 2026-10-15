'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/providers/AuthProvider'
import { Button } from '@/components/ui/Button'

interface PendingAccount {
  id: string
  email: string
  full_name: string
  organization_id: string
  created_at: string
  company: string
}

export default function AccountApprovalsPage() {
  const { isPlatformAdmin, isLoading } = useAuth()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data: accounts, isLoading: loadingList } = useQuery({
    queryKey: ['pending-accounts'],
    enabled: isPlatformAdmin,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, organization_id, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      if (error) throw error
      const ids = Array.from(new Set((profiles ?? []).map((p) => p.organization_id)))
      const names = new Map<string, string>()
      if (ids.length > 0) {
        const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', ids)
        for (const o of orgs ?? []) names.set(o.id, o.name)
      }
      return (profiles ?? []).map((p) => ({ ...p, company: names.get(p.organization_id) ?? '—' })) as PendingAccount[]
    },
  })

  async function decide(account: PendingAccount, action: 'approve' | 'reject') {
    setBusyId(account.id)
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: account.id, action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'Could not update that account.')
        return
      }
      toast.success(action === 'approve' ? `Approved ${account.email}` : `Rejected ${account.email}`)
      await queryClient.invalidateQueries({ queryKey: ['pending-accounts'] })
    } finally {
      setBusyId(null)
    }
  }

  if (isLoading) return null
  if (!isPlatformAdmin) {
    return <p className="text-sm text-gray-600">Only the platform administrator can approve accounts.</p>
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Account approvals</h1>
      <p className="mt-1 text-sm text-gray-600">
        New signups wait here. Nobody gets any access until you approve them.
      </p>

      <div className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        {loadingList && <p className="p-4 text-sm text-gray-500">Loading…</p>}
        {!loadingList && (accounts ?? []).length === 0 && (
          <p className="p-4 text-sm text-gray-500">No accounts are waiting for approval.</p>
        )}
        {(accounts ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900">{a.full_name}</p>
              <p className="truncate text-sm text-gray-600">{a.email}</p>
              <p className="truncate text-xs text-gray-500">
                {a.company} · signed up {new Date(a.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button disabled={busyId === a.id} onClick={() => decide(a, 'approve')}>
                Approve
              </Button>
              <Button variant="secondary" disabled={busyId === a.id} onClick={() => decide(a, 'reject')}>
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
