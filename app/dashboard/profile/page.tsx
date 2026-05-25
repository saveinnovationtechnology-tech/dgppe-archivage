'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, User, Mail, Phone, Save,
  Lock, Eye, EyeOff, CheckCircle, AlertCircle,
  Shield, Calendar
} from 'lucide-react'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [profil, setProfil] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [telephone, setTelephone] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: profilData } = await supabase
        .from('profils')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfil(profilData)
      setNom(profilData?.nom || '')
      setPrenom(profilData?.prenom || '')
      setTelephone(profilData?.telephone || '')
      setLoading(false)
    }
    init()
  }, [])

  const handleSaveProfil = async () => {
    if (!user) return
    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('profils')
      .update({ nom, prenom, telephone })
      .eq('id', user.id)

    if (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde.' })
    } else {
      setMessage({ type: 'success', text: 'Profil mis à jour avec succès !' })
    }
    setSaving(false)
    setTimeout(() => setMessage(null), 3000)
  }

  const handleChangePassword = async () => {
    setMessage(null)

    if (!newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'Veuillez remplir tous les champs.' })
      return
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 8 caractères.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas.' })
      return
    }

    setChangingPassword(true)

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Erreur lors du changement.' })
    } else {
      await supabase
        .from('profils')
        .update({
          dernier_changement_mdp: new Date().toISOString(),
          premiere_connexion: false
        })
        .eq('id', user.id)

      await supabase
        .from('notifications')
        .update({ lue: true })
        .eq('user_id', user.id)
        .in('titre', [
          'Bienvenue ! Changez votre mot de passe',
          'Mot de passe expiré',
          'Mot de passe bientôt expiré'
        ])

      setMessage({ type: 'success', text: 'Mot de passe modifié avec succès !' })
      setNewPassword('')
      setConfirmPassword('')
      setProfil((prev: any) => ({
        ...prev,
        premiere_connexion: false,
        dernier_changement_mdp: new Date().toISOString()
      }))
    }
    setChangingPassword(false)
    setTimeout(() => setMessage(null), 4000)
  }

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return null
    let score = 0
    if (pwd.length >= 8) score++
    if (pwd.length >= 12) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++
    if (score <= 2) return { label: 'Faible', color: 'bg-red-500', width: 'w-1/3' }
    if (score <= 3) return { label: 'Moyen', color: 'bg-amber-500', width: 'w-2/3' }
    return { label: 'Fort', color: 'bg-emerald-500', width: 'w-full' }
  }

  const passwordStrength = getPasswordStrength(newPassword)
  const userInitial = (prenom || user?.email)?.charAt(0).toUpperCase() || 'U'

  const daysSincePasswordChange = profil?.dernier_changement_mdp
    ? Math.floor(
        (new Date().getTime() - new Date(profil.dernier_changement_mdp).getTime())
        / (1000 * 60 * 60 * 24)
      )
    : null

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center gap-4 shadow-sm">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Mon Profil</h1>
          <p className="text-slate-500 text-sm">Gérez vos informations personnelles</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-8 space-y-6">

        {/* Message */}
        {message && (
          <div className={`flex items-center gap-3 p-4 rounded-xl text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.type === 'success'
              ? <CheckCircle className="w-5 h-5 flex-shrink-0" />
              : <AlertCircle className="w-5 h-5 flex-shrink-0" />
            }
            {message.text}
          </div>
        )}

        {/* Avatar + infos rapides */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
              {userInitial}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {prenom && nom ? `${prenom} ${nom}` : user?.email}
              </h2>
              <p className="text-slate-500 text-sm flex items-center gap-1.5 mt-1">
                <Mail className="w-3.5 h-3.5" />
                {user?.email}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  <Shield className="w-3 h-3" />
                  {profil?.role || 'Utilisateur'}
                </span>
                {daysSincePasswordChange !== null && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    daysSincePasswordChange >= 90
                      ? 'bg-red-100 text-red-700'
                      : daysSincePasswordChange >= 80
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    <Calendar className="w-3 h-3" />
                    MDP changé il y a {daysSincePasswordChange}j
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Informations personnelles */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <User className="w-5 h-5 text-slate-600" />
            <h3 className="font-semibold text-slate-800">Informations personnelles</h3>
          </div>
          <div className="p-6 space-y-4">

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Prénom</label>
                <input
                  type="text"
                  value={prenom}
                  onChange={e => setPrenom(e.target.value)}
                  placeholder="Votre prénom"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom</label>
                <input
                  type="text"
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  placeholder="Votre nom"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Email non modifiable */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Adresse email
                <span className="ml-2 text-xs text-slate-400 font-normal">(non modifiable)</span>
              </label>
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
                <Mail className="w-4 h-4 text-slate-400" />
                {user?.email}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Téléphone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  value={telephone}
                  onChange={e => setTelephone(e.target.value)}
                  placeholder="+241 XX XX XX XX"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleSaveProfil}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>

        {/* Modifier mot de passe */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-600" />
            <h3 className="font-semibold text-slate-800">Modifier le mot de passe</h3>
          </div>
          <div className="p-6 space-y-4">

            {/* Alertes contextuelles */}
            {profil?.premiere_connexion && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>C'est votre première connexion. Veuillez modifier votre mot de passe pour sécuriser votre compte.</p>
              </div>
            )}

            {daysSincePasswordChange !== null && daysSincePasswordChange >= 90 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>Votre mot de passe a expiré ({daysSincePasswordChange} jours). Veuillez le renouveler immédiatement.</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Indicateur force */}
              {passwordStrength && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500">Force du mot de passe</span>
                    <span className={`font-medium ${
                      passwordStrength.label === 'Fort' ? 'text-emerald-600' :
                      passwordStrength.label === 'Moyen' ? 'text-amber-600' : 'text-red-600'
                    }`}>{passwordStrength.label}</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color} ${passwordStrength.width}`} />
                  </div>
                  <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                    <li className={newPassword.length >= 8 ? 'text-emerald-600' : ''}>
                      {newPassword.length >= 8 ? '✓' : '○'} Minimum 8 caractères
                    </li>
                    <li className={/[A-Z]/.test(newPassword) ? 'text-emerald-600' : ''}>
                      {/[A-Z]/.test(newPassword) ? '✓' : '○'} Une majuscule
                    </li>
                    <li className={/[0-9]/.test(newPassword) ? 'text-emerald-600' : ''}>
                      {/[0-9]/.test(newPassword) ? '✓' : '○'} Un chiffre
                    </li>
                    <li className={/[^A-Za-z0-9]/.test(newPassword) ? 'text-emerald-600' : ''}>
                      {/[^A-Za-z0-9]/.test(newPassword) ? '✓' : '○'} Un caractère spécial
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                    confirmPassword && newPassword !== confirmPassword
                      ? 'border-red-300 bg-red-50'
                      : confirmPassword && newPassword === confirmPassword
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
              )}
              {confirmPassword && newPassword === confirmPassword && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Les mots de passe correspondent
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={handleChangePassword}
                disabled={changingPassword || !newPassword || !confirmPassword}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-900 disabled:opacity-60 transition-colors"
              >
                <Lock className="w-4 h-4" />
                {changingPassword ? 'Modification en cours...' : 'Modifier le mot de passe'}
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
