'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { logAction } from '@/lib/supabase/logs'
import { getNonLues, marquerToutesLues, marquerCommeLue } from '@/lib/supabase/notifications'
import {
  Building2, LayoutDashboard, FilePlus, FolderOpen,
  Search, Users, ClipboardList, LogOut, ChevronRight,
  FileText, Upload, X, CheckCircle, AlertCircle,
  Shield, Calendar, Hash, BookOpen, Briefcase,
  Menu, Bell, User
} from 'lucide-react'

export default function AddDocumentPage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [directions, setDirections] = useState<any[]>([])
  const [fichier, setFichier] = useState<File | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)

  const [form, setForm] = useState({
    intitule: '',
    type_document: '',
    direction_origine: '',
    code_document: '',
    date_document: '',
    reference_administrative: '',
    auteur_service: '',
    niveau_confidentialite: 'Normal',
    observations: '',
  })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data } = await supabase.from('directions').select('*')
      setDirections(data || [])

      const notifs = await getNonLues(user.id)
      setNotifications(notifs)
    }
    init()
  }, [])

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') setFichier(file)
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (!form.intitule || !form.type_document || !form.direction_origine || !form.auteur_service) {
      setMessage('Veuillez remplir tous les champs obligatoires.')
      setMessageType('error')
      setLoading(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()

      let fichier_base64 = null
      let fichier_nom = null
      let fichier_taille = null

      if (fichier) {
        if (fichier.type !== 'application/pdf') {
          setMessage('Seuls les fichiers PDF sont acceptés.')
          setMessageType('error')
          setLoading(false)
          return
        }
        if (fichier.size > 50 * 1024 * 1024) {
          setMessage('Le fichier ne doit pas dépasser 50MB.')
          setMessageType('error')
          setLoading(false)
          return
        }
        fichier_base64 = await fileToBase64(fichier)
        fichier_nom = fichier.name
        fichier_taille = fichier.size
      }

      const { data: newDoc, error } = await supabase.from('documents').insert([{
        ...form,
        code_document: form.code_document || null,
        date_document: form.date_document || null,
        reference_administrative: form.reference_administrative || null,
        observations: form.observations || null,
        fichier_base64,
        fichier_nom,
        fichier_taille,
        created_by: user?.id || null,
      }]).select().single()

      if (error) throw error

      await logAction(
        'creation_document',
        `Création du document : ${form.intitule} (${form.type_document}) — ${form.direction_origine}`,
        newDoc?.id || null
      )

      setMessage('Document enregistré avec succès !')
      setMessageType('success')
      setTimeout(() => router.push('/dashboard'), 2000)

    } catch (err: any) {
      setMessage(`Erreur : ${err.message}`)
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleMarquerToutesLues = async () => {
    if (!user) return
    setNotifLoading(true)
    await marquerToutesLues(user.id)
    setNotifications([])
    setNotifLoading(false)
  }

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
    { href: '/dashboard/documents/add', icon: FilePlus, label: 'Ajouter un document', active: true },
    { href: '/dashboard/documents/view', icon: FolderOpen, label: 'Documents' },
    { href: '/dashboard/search', icon: Search, label: 'Rechercher' },
    { href: '/dashboard/users', icon: Users, label: 'Utilisateurs' },
    { href: '/dashboard/logs', icon: ClipboardList, label: 'Journaux d\'activité' },
  ]

  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U'

  const confOptions = [
    { value: 'Normal', label: 'Normal', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { value: 'Confidentiel', label: 'Confidentiel', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { value: 'Secret', label: 'Secret', color: 'text-red-600 bg-red-50 border-red-200' },
  ]

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">

      {/* SIDEBAR */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col shadow-2xl z-10`}>
        <div className="flex items-center gap-3 p-6 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <h1 className="text-white font-bold text-sm">DGPPE</h1>
              <p className="text-slate-400 text-xs">Archivage numérique</p>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="ml-auto text-slate-400 hover:text-white transition-colors">
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <a key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${item.active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              {sidebarOpen && item.active && <ChevronRight className="w-4 h-4 ml-auto" />}
            </a>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          {sidebarOpen && (
            <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-xl bg-white/5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {userInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{user?.email}</p>
                <p className="text-slate-400 text-xs">Administrateur</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200">
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* CONTENU */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Ajouter un document</h2>
            <p className="text-slate-500 text-sm">Renseignez les informations du nouveau document</p>
          </div>

          <div className="flex items-center gap-3">

            {/* NOTIFICATIONS */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-20 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                      <h4 className="font-semibold text-slate-800 text-sm">Notifications</h4>
                      {notifications.length > 0 && (
                        <button
                          onClick={handleMarquerToutesLues}
                          disabled={notifLoading}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                        >
                          Tout marquer comme lu
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                          <Bell className="w-8 h-8 mb-2 opacity-40" />
                          <p className="text-sm">Aucune notification</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={async () => {
                              await marquerCommeLue(notif.id)
                              setNotifications(prev => prev.filter(n => n.id !== notif.id))
                            }}
                            className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${
                              notif.type === 'warning' ? 'border-l-4 border-l-amber-400' :
                              notif.type === 'error' ? 'border-l-4 border-l-red-400' :
                              'border-l-4 border-l-blue-400'
                            }`}
                          >
                            <p className="text-sm font-semibold text-slate-800">{notif.titre}</p>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.message}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {new Date(notif.created_at).toLocaleDateString('fr-FR', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    {notifications.length > 0 && (
                      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                        <p className="text-xs text-slate-400 text-center">
                          {notifications.length} notification{notifications.length > 1 ? 's' : ''} non lue{notifications.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* PROFIL */}
            <button
              onClick={() => router.push('/dashboard/profile')}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold hover:shadow-lg hover:scale-105 transition-all"
              title="Mon profil"
            >
              {userInitial}
            </button>

          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">

          {/* Bannière */}
          <div className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 mb-8 overflow-hidden shadow-xl">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
            </div>
            <div className="relative z-10">
              <p className="text-blue-200 text-sm font-medium mb-1">Gestion documentaire</p>
              <h3 className="text-white text-2xl font-bold mb-2">Nouveau document</h3>
              <p className="text-blue-200 text-sm">Complétez le formulaire ci-dessous pour enregistrer un document dans la base.</p>
            </div>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20">
              <FilePlus className="w-24 h-24 text-white" />
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className={`flex items-center gap-3 p-4 rounded-xl mb-6 border ${messageType === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              {messageType === 'success'
                ? <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                : <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              }
              <span className="text-sm font-medium">{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Section Identification */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-800">Identification du document</h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Intitulé du document <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="intitule"
                    value={form.intitule}
                    onChange={handleChange}
                    placeholder="Ex : Rapport annuel d'activités 2024"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-800 placeholder-slate-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Type de document <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="type_document"
                    value={form.type_document}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-800"
                    required
                  >
                    <option value="">-- Sélectionner un type --</option>
                    {['Rapport', 'Note', 'Circulaire', 'Arrêté', 'Décision', 'Procès-verbal', 'Contrat', 'Correspondance', 'Autre'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Direction d'origine <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="direction_origine"
                    value={form.direction_origine}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-800"
                    required
                  >
                    <option value="">-- Sélectionner une direction --</option>
                    {directions.map((d) => (
                      <option key={d.id} value={d.nom}>{d.nom}</option>
                    ))}
                  </select>
                </div>

              </div>
            </div>

            {/* Section Références */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Hash className="w-4 h-4 text-purple-600" />
                </div>
                <h3 className="font-semibold text-slate-800">Références & Dates</h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Code document</label>
                  <input
                    name="code_document"
                    value={form.code_document}
                    onChange={handleChange}
                    placeholder="Ex : DOC-2024-001"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-800 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date du document</label>
                  <input
                    name="date_document"
                    type="date"
                    value={form.date_document}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Référence administrative</label>
                  <input
                    name="reference_administrative"
                    value={form.reference_administrative}
                    onChange={handleChange}
                    placeholder="Ex : REF-2024-XXX"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-800 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Auteur / Service <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="auteur_service"
                    value={form.auteur_service}
                    onChange={handleChange}
                    placeholder="Ex : Direction des Études"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-800 placeholder-slate-400"
                    required
                  />
                </div>

              </div>
            </div>

            {/* Section Confidentialité */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="font-semibold text-slate-800">Confidentialité & Observations</h3>
              </div>
              <div className="p-6 space-y-5">

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Niveau de confidentialité</label>
                  <div className="flex gap-3 flex-wrap">
                    {confOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm({ ...form, niveau_confidentialite: opt.value })}
                        className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${form.niveau_confidentialite === opt.value ? opt.color + ' border-current shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      >
                        <Shield className="w-3.5 h-3.5 inline mr-1.5" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Observations</label>
                  <textarea
                    name="observations"
                    value={form.observations}
                    onChange={handleChange}
                    placeholder="Remarques ou informations complémentaires..."
                    rows={4}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-800 placeholder-slate-400 resize-none"
                  />
                </div>

              </div>
            </div>

            {/* Section Fichier */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-800">Pièce jointe</h3>
              </div>
              <div className="p-6">
                {!fichier ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
                  >
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-7 h-7 text-slate-400" />
                    </div>
                    <p className="text-slate-700 font-semibold mb-1">Glissez votre PDF ici</p>
                    <p className="text-slate-400 text-sm mb-4">ou cliquez pour parcourir vos fichiers</p>
                    <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
                      <FolderOpen className="w-4 h-4" />
                      Choisir un fichier
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => setFichier(e.target.files?.[0] || null)}
                      />
                    </label>
                    <p className="text-slate-400 text-xs mt-3">PDF uniquement · Max 50MB</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{fichier.name}</p>
                      <p className="text-xs text-slate-500">{(fichier.size / 1024 / 1024).toFixed(2)} MB · PDF</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFichier(null)}
                      className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Boutons */}
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Enregistrer le document
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
            </div>

          </form>
        </main>
      </div>
    </div>
  )
}
