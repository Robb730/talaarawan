import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { sendEmail } from '../lib/email'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  /** Returns true when a confirmation email must be clicked before signing in. */
  signUp: (email: string, password: string, fullName: string) => Promise<boolean>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  /** Redeems the recovery tokens appended by the password-reset email link. */
  completeRecovery: (accessToken: string, refreshToken: string) => Promise<void>
  /** Redeems the tokens appended by the email-confirmation link. */
  completeConfirmation: (accessToken: string, refreshToken: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // Supabase emits TOKEN_REFRESHED (and SIGNED_IN) with a fresh user object when a
  // hidden tab becomes visible again. Keeping the previous object for the same
  // account avoids a cascading data refetch and the full-screen loader flash.
  const appliedUserRef = useRef<User | null | undefined>(undefined)

  const applyUser = useCallback((next: User | null) => {
    const previous = appliedUserRef.current
    if (previous !== undefined && previous?.id === next?.id && previous?.email === next?.email) {
      return
    }
    appliedUserRef.current = next
    setUser(next)
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      applyUser(data.session?.user ?? null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      applyUser(session?.user ?? null)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [applyUser])

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    applyUser(data.session?.user ?? null)
  }, [applyUser])

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    })
    if (error) throw error
    applyUser(data.session?.user ?? null)
    return !data.session
  }, [applyUser])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    applyUser(null)
  }, [applyUser])

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendEmail({
      action: 'password_reset',
      email: email.trim(),
      redirectTo: `${window.location.origin}/auth`,
    })
  }, [])

  const completeRecovery = useCallback(async (accessToken: string, refreshToken: string) => {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) throw error
  }, [])

  const completeConfirmation = useCallback(async (accessToken: string, refreshToken: string) => {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      completeRecovery,
      completeConfirmation,
      updatePassword,
    }),
    [
      user,
      loading,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      completeRecovery,
      completeConfirmation,
      updatePassword,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
