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

    // Créer l'utilisateur Auth + métadonnées → le trigger crée le profil automatiquement
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nom,
        prenom,
        direction,
        role,
        actif,
      }
    })

    if (authError) throw authError

    console.log('User créé avec metadata:', authData.user.user_metadata)

    return NextResponse.json({ success: true, userId: authData.user.id })

  } catch (error: unknown) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: JSON.stringify(error) }, { status: 400 })
  }
}
