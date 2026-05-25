import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  try {
    const { email, password, nom, prenom, direction, role, actif } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 })
    }

    // Créer l'utilisateur Auth avec confirmation automatique
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) throw authError
    

    // Créer le profil dans la table profils
    const { error: profilError } = await supabaseAdmin
      .from('profils')
      .insert({
        id: authData.user.id,
        email,
        nom,
        prenom,
        direction,
        role,
        actif,
      })

    if (profilError) {
      // Supprimer l'utilisateur auth si le profil échoue
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw profilError
    }
    

    return NextResponse.json({ success: true, userId: authData.user.id })
} catch (error: unknown) {
    console.error('Erreur brute:', JSON.stringify(error))
    console.error('Type:', typeof error)
    console.error('Erreur complète:', error)
    return NextResponse.json({ error: JSON.stringify(error) }, { status: 400 })
  }


}
