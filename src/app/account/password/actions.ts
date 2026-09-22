'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string
  const back = (msg: string) =>
    redirect(`/account/password?error=${encodeURIComponent(msg)}`)

  if (password.length < 8) back('Password must be at least 8 characters')
  if (password !== confirm) back('Passwords do not match')

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) back(error.message)

  redirect('/account/password?success=1')
}