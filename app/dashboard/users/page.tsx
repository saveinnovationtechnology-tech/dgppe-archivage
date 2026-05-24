'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Building2, LayoutDashboard, FilePlus, FolderOpen,
  Search, Users, ClipboardList, LogOut, ChevronRight,
  Menu, Bell, Plus, X, Edit2, Trash2, UserCheck,
  UserX, Shield, CheckCircle, AlertCircle, RefreshCw,
  Mail, User, Lock, Briefcase
} from 'lucide-react'

const supabase = createClient()

interface Profil {
  id: string
  email: string
  nom: string
  prenom: string
  direction: string
  role: string
  actif: boolean
  created_at: string
}

interface Direction {
  id: string
  code: string
  nom: string
  description: string
}

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<Profil[]>([])
  const [directions, setDirections] = useState<Direction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [password, setPassword] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [isAuthed, setIsAuthed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [formData, setFormData] = useState({
    email: '', nom: '', prenom: '', direction: '',
    role: 'agent_consultation', actif: true,
  })

  useEffect(() => {
    const initPage = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/login'); return }
        setUserEmail(session.user.email || '')

        const { data: profileData } = await supabase
          .from('profils').select('role, actif').eq('id', session.user.id).single()

        if (!profileData?.actif) { router.push('/login'); return }
        if (!['administrateur', 'admin', 'gestionnaire'].includes(profileData.role)) {
          router.push('/dashboard'); return
        }

        setIsAuthed(true)
        await loadUsers()
        await loadDirections()
      } catch {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    initPage()
  }, [router])

  const loadUsers = async () => {
    const { data, error } = await supabase.from('profils').select('*').order('created_at', { ascending: false })
    if (error) { setError('Erreur lors du chargement'); return }
    setUsers(data || [])
  }

  const loadDirections = async () => {
    const { data } = await supabase.from('directions').select('*').order('nom')
    setDirections(data || [])
  }

  const logAction = async (action: string, details: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('logs_activite').insert({ utilisateur_id: user?.id, action, details, document_id: null })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setSuccess(null)
    try {
      if (editingId) {
        const { error } = await supabase.from('profils').update({
          email: formData.email, nom: formData.nom, prenom: formData.prenom,
          direction: formData.direction, role: formData.role, actif: formData.actif,
        }).eq('id', editingId)
        if (error) throw error
        await logAction('modification', `Modification : ${formData.prenom} ${formData.nom} (${formData.email})`)
        setSuccess('Utilisateur modifié avec succès')
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({ email: formData.email, password })
        if (authError) throw authError
        if (authData.user) {
          const { error: profilError } = await supabase.from('profils').insert({
            id: authData.user.id, ...formData
          })
          if (profilError) throw profilError
          await logAction('creation', `Création : ${formData.prenom} ${formData.nom} (${formData.email})`)
        }
        setSuccess('Utilisateur créé avec succès')
      }
      resetForm()
      await loadUsers()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement')
    }
  }

  const handleEdit = (user: Profil) => {
    setEditingId(user.id)
    setFormData({ email: user.email, nom: user.nom, prenom: user.prenom, direction: user.direction || '', role: user.role, actif: user.actif })
    setShowForm(true); setError(null); setSuccess(null)
  }

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Supprimer l'utilisateur ${email} ?`)) return
    const { error } = await supabase.from('profils').delete().eq('id', id)
    if (error) { setError('Erreur lors de la suppression'); return }
    await logAction('suppression', `Suppression : ${email}`)
    setSuccess('Utilisateur supprimé')
    await loadUsers()
  }

  const resetForm = () => {
    setFormData({ email: '', nom: '', prenom: '', direction: '', role: 'agent_consultation', actif: true })
    setPassword(''); setEditingId(null); setShowForm(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filteredUsers = users.filter(u => {
    const matchSearch = u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.prenom?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchRole = filterRole === 'all' || u.role === filterRole
    return matchSearch && matchRole
  })

  const getRoleBadge = (role: string) => {
    if (role === 'administrateur') return 'bg-blue-100 text-blue-700 border border-blue-200'
    if (role === 'gestionnaire') return 'bg-purple-100 text-purple-700 border border-purple-200'
    return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  }

  const getRoleLabel = (role: string) => {
    if (role === 'administrateur') return 'Administrateur'
    if (role === 'gestionnaire') return 'Gestionnaire'
    return 'Agent consultation'
  }

  const navItems = [
    { icon: LayoutDashboard, label: 'Tableau de bord', href: '/dashboard' },
    { icon: FilePlus, label: 'Ajouter document', href: '/dashboard/documents/add' },
    { icon: FolderOpen, label: 'Documents', href: '/dashboard/documents/view' },
    { icon: Search, label: 'Recherche', href: '/dashboard/search' },
    { icon: Users, label: 'Utilisateurs', href: '/dashboard/users', active: true },
    { icon: ClipboardList, label: 'Journaux', href: '/dashboard/logs' },
  ]

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-100">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm">Chargement...</p>
      </div>
    </div>
  )

  if (!isAuthed) return null

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-gradient-to-b from-slate-800 to-slate-900 flex flex-col overflow-hidden shrink-0`}>
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">GED Ministère</p>
              <p className="text-slate-400 text-xs">Gestion documentaire</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <a key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${item.active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </a>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700">
          <div className="px-3 py-2 mb-2">
            <p className="text-slate-400 text-xs truncate">{userEmail}</p>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-all">
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>GED</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-800 font-semibold">Utilisateurs</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Bell className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{userEmail?.[0]?.toUpperCase() || 'U'}</span>
              </div>
              <span className="text-sm font-medium text-slate-700 hidden md:block">{userEmail}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">

          {/* Banner */}
          <div className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 px-8 py-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-white">Gestion des utilisateurs</h1>
                </div>
                <p className="text-slate-300 text-sm">{users.length} utilisateur{users.length > 1 ? 's' : ''} enregistré{users.length > 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={() => { resetForm(); setShowForm(!showForm) }}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-800 rounded-xl text-sm font-semibold hover:bg-slate-100 transition-all shadow-lg">
                {showForm ? <><X className="w-4 h-4" /> Annuler</> : <><Plus className="w-4 h-4" /> Nouvel utilisateur</>}
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">

            {/* Alerts */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{success}</p>
                <button onClick={() => setSuccess(null)} className="ml-auto"><X className="w-4 h-4" /></button>
              </div>
            )}

            {/* Formulaire */}
            {showForm && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    {editingId ? <Edit2 className="w-4 h-4 text-blue-600" /> : <Plus className="w-4 h-4 text-blue-600" />}
                  </div>
                  <h2 className="font-semibold text-slate-800">
                    {editingId ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
                  </h2>
                </div>
                <form onSubmit={handleSubmit} className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Email *</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="email" value={formData.email} required
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="exemple@ministere.gov" />
                      </div>
                    </div>
                    {!editingId && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Mot de passe *</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input type="password" value={password} required
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="••••••••" />
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Nom *</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" value={formData.nom} required
                          onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Nom de famille" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Prénom *</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" value={formData.prenom} required
                          onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Prénom" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Direction</label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select value={formData.direction}
                          onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                          <option value="">-- Sélectionner une direction --</option>
                          {directions.map(d => <option key={d.id} value={d.code}>{d.nom}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Rôle *</label>
                      <div className="relative">
                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                          <option value="agent_consultation">Agent consultation</option>
                          <option value="gestionnaire">Gestionnaire</option>
                          <option value="administrateur">Administrateur</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-5 p-3 bg-slate-50 rounded-xl">
                    <input type="checkbox" id="actif" checked={formData.actif}
                      onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                      className="w-4 h-4 rounded accent-blue-600" />
                    <label htmlFor="actif" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      {formData.actif
                        ? <><UserCheck className="w-4 h-4 text-emerald-600" /> Compte actif</>
                        : <><UserX className="w-4 h-4 text-red-500" /> Compte inactif</>}
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <button type="submit"
                      className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-colors">
                      {editingId ? <><Edit2 className="w-4 h-4" /> Enregistrer</> : <><Plus className="w-4 h-4" /> Créer l'utilisateur</>}
                    </button>
                    <button type="button" onClick={resetForm}
                      className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-medium transition-colors">
                      <X className="w-4 h-4" /> Annuler
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Filtres */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Rechercher par nom, prénom ou email..."
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
                    className="pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none min-w-[180px]">
                    <option value="all">Tous les rôles</option>
                    <option value="agent_consultation">Agent consultation</option>
                    <option value="gestionnaire">Gestionnaire</option>
                    <option value="administrateur">Administrateur</option>
                  </select>
                </div>
                <button onClick={loadUsers}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-medium transition-colors">
                  <RefreshCw className="w-4 h-4" />
                  Actualiser
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Users className="w-4 h-4 text-slate-600" />
                  </div>
                  <h2 className="font-semibold text-slate-800">
                    {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''}
                    {(searchTerm || filterRole !== 'all') && <span className="text-slate-400 font-normal"> (filtré{filteredUsers.length > 1 ? 's' : ''})</span>}
                  </h2>
                </div>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <Users className="w-7 h-7 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium">Aucun utilisateur trouvé</p>
                  <p className="text-slate-400 text-sm">Modifiez vos critères de recherche</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {['Utilisateur', 'Direction', 'Rôle', 'Statut', 'Créé le', 'Actions'].map(h => (
                          <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                                <span className="text-white text-sm font-bold">
                                  {u.prenom?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-slate-800 text-sm">{u.prenom} {u.nom}</p>
                                <p className="text-slate-400 text-xs">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{u.direction || '—'}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${getRoleBadge(u.role)}`}>
                              <Shield className="w-3 h-3" />
                              {getRoleLabel(u.role)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {u.actif ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium">
                                <UserCheck className="w-3 h-3" /> Actif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-medium">
                                <UserX className="w-3 h-3" /> Inactif
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {new Date(u.created_at).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleEdit(u)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-colors">
                                <Edit2 className="w-3 h-3" /> Modifier
                              </button>
                              <button onClick={() => handleDelete(u.id, u.email)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium transition-colors">
                                <Trash2 className="w-3 h-3" /> Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
