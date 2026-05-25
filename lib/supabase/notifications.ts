import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export async function getNonLues(userId: string) {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('lue', false)
    .order('created_at', { ascending: false })
  return data || []
}

export async function getToutesNotifications(userId: string) {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)
  return data || []
}

export async function marquerCommeLue(notifId: string) {
  await supabase
    .from('notifications')
    .update({ lue: true })
    .eq('id', notifId)
}

export async function marquerToutesLues(userId: string) {
  await supabase
    .from('notifications')
    .update({ lue: true })
    .eq('user_id', userId)
}

export async function creerNotification(
  userId: string,
  titre: string,
  message: string,
  type: 'info' | 'warning' | 'success' = 'info'
) {
  await supabase.from('notifications').insert({
    user_id: userId,
    titre,
    message,
    type
  })
}

// Vérifie et crée les notifications automatiques
export async function verifierNotificationsAuto(userId: string, profil: any) {
  // 1. Première connexion
  if (profil?.premiere_connexion) {
    // Vérifie si notif déjà créée
    const { data: existe } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('titre', 'Bienvenue ! Changez votre mot de passe')
      .limit(1)

    if (!existe || existe.length === 0) {
      await creerNotification(
        userId,
        'Bienvenue ! Changez votre mot de passe',
        'Pour votre sécurité, veuillez modifier votre mot de passe dès votre première connexion.',
        'warning'
      )
    }
  }

  // 2. Expiration mot de passe (90 jours)
  if (profil?.dernier_changement_mdp) {
    const dernierChangement = new Date(profil.dernier_changement_mdp)
    const maintenant = new Date()
    const diffJours = Math.floor(
      (maintenant.getTime() - dernierChangement.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (diffJours >= 90) {
      const { data: existe } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('titre', 'Mot de passe expiré')
        .eq('lue', false)
        .limit(1)

      if (!existe || existe.length === 0) {
        await creerNotification(
          userId,
          'Mot de passe expiré',
          `Votre mot de passe n'a pas été modifié depuis ${diffJours} jours. Veuillez le renouveler.`,
          'warning'
        )
      }
    } else if (diffJours >= 80) {
      // Avertissement 10 jours avant
      const { data: existe } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('titre', 'Mot de passe bientôt expiré')
        .eq('lue', false)
        .limit(1)

      if (!existe || existe.length === 0) {
        await creerNotification(
          userId,
          'Mot de passe bientôt expiré',
          `Votre mot de passe expire dans ${90 - diffJours} jours. Pensez à le renouveler.`,
          'warning'
        )
      }
    }
  }
}
