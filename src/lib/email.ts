import { supabase } from './supabase'

export type EmailAction = 'password_reset' | 'test'

export interface SendEmailInput {
  action: EmailAction
  email: string
  fullName?: string
  /** Where a password-reset link should return the user. */
  redirectTo?: string
}

export async function sendEmail(input: SendEmailInput): Promise<{ messageId?: string }> {
  const { data, error } = await supabase.functions.invoke('send-email', { body: input })
  if (error) {
    let message = error.message
    if (error.context instanceof Response) {
      try {
        const body = (await error.context.json()) as { error?: string }
        if (body.error) message = body.error
      } catch {
        // Keep the original error message when the body is not JSON.
      }
    }
    throw new Error(message)
  }
  return (data ?? {}) as { messageId?: string }
}
