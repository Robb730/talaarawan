import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { FullScreenLoader } from './AppShell'

export function RequireUser({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}

export function RequireProfile({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { loading } = useData()
  if (authLoading || loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}
