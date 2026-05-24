import { createClient } from '@/lib/supabase/client'

export async function logAction(
  action: string,
  details?: string,
  document_id?: string | null
) {
  try {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('logs_activite').insert({
      utilisateur_id: user.id,
      action,
      details: details || null,
      document_id: document_id || null,
    })
  } catch (error) {
    console.error('Erreur log:', error)
  }
}
