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
    const { data, error } = await supabase
      .from('profils')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { setError('Erreur lors du chargement des utilisateurs'); return }
    setUsers(data || [])
  }

  const loadDirections = async () => {
    const { data } = await supabase.from('directions').select('*').order('nom')
    setDirections(data || [])
  }

  const logAction = async (action: string, details: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('logs_activite').insert({
      utilisateur_id: user?.id,
      action,
      details,
      document_id: null
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    try {
      if (editingId) {
        // Modification d'un utilisateur existant
        const { error } = await supabase.from('profils').update({
          email: formData.email,
          nom: formData.nom,
          prenom: formData.prenom,
          direction: formData.direction,
          role: formData.role,
          actif: formData.actif,
        }).eq('id', editingId)

        if (error) throw error

        await logAction('modification_utilisateur', `Modification : ${formData.prenom} ${formData.nom} (${formData.email})`)
        setSuccess('Utilisateur modifié avec succès ✓')
      } else {
        // Création d'un nouvel utilisateur via API Route
        if (!password || password.length < 6) {
          setError('Le mot de passe doit contenir au moins 6 caractères')
          return
        }

        const response = await fetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, password }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Erreur lors de la création')
        }

        await logAction('creation_utilisateur', `Création : ${formData.prenom} ${formData.nom} (${formData.email})`)
        setSuccess('Utilisateur créé avec succès ✓ Il peut se connecter immédiatement.')
      }

      await loadUsers()
      setShowForm(false)
      resetForm()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      setError(message)
    }
  }

  const handleEdit = (user: Profil) => {
    setEditingId(user.id)
    setFormData({
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      direction: user.direction || '',
      role: user.role,
      actif: user.actif,
    })
    setPassword('')
    setShowForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Supprimer l'utilisateur ${email} ? Cette action est irréversible.`)) return

    try {
      const { error } = await supabase.from('profils').delete().eq('id', id)
      if (error) throw error

      await logAction('suppression_utilisateur', `Suppression : ${email}`)
      setSuccess('Utilisateur supprimé avec succès')
      await loadUsers()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la suppression'
      setError(message)
    }
  }

  const resetForm = () => {
    setFormData({ email: '', nom: '', prenom: '', direction: '', role: 'agent_consultation', actif: true })
    setPassword('')
    setEditingId(null)
  }

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      administrateur: 'Administrateur',
      admin: 'Administrateur',
      gestionnaire: 'Gestionnaire',
      agent_saisie: 'Agent de saisie',
      agent_consultation: 'Agent de consultation',
    }
    return labels[role] || role
  }

  const getRoleBadge = (role: string) => {
    const badges: Record<string, string> = {
      administrateur: 'bg-purple-100 text-purple-700 border border-purple-200',
      admin: 'bg-purple-100 text-purple-700 border border-purple-200',
      gestionnaire: 'bg-blue-100 text-blue-700 border border-blue-200',
      agent_saisie: 'bg-amber-100 text-amber-700 border border-amber-200',
      agent_consultation: 'bg-slate-100 text-slate-700 border border-slate-200',
    }
    return badges[role] || 'bg-slate-100 text-slate-700 border border-slate-200'
  }

  const filteredUsers = users.filter(u => {
    const matchSearch = searchTerm === '' ||
      u.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.direction?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchRole = filterRole === 'all' || u.role === filterRole
    return matchSearch && matchRole
  })

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
    { href: '/dashboard/documents/add', icon: FilePlus, label: 'Ajouter un document' },
    { href: '/dashboard/documents/view', icon: FolderOpen, label: 'Voir les documents' },
    { href: '/dashboard/search', icon: Search, label: 'Recherche avancée' },
    { href: '/dashboard/users', icon: Users, label: 'Utilisateurs', active: true },
    { href: '/dashboard/logs', icon: ClipboardList, label: 'Journaux' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!isAuthed) return null

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-slate-900 text-white flex flex-col transition-all duration-300 shrink-0`}>
        <div className="p-4 border-b border-slate-700 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold leading-tight">DGPPE</p>
              <p className="text-xs text-slate-400">Archivage Numérique</p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <a key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                item.active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}>
              <item.icon className="w-4 h-4 shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </a>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700">
          {sidebarOpen && (
            <div className="px-3 py-2 mb-2">
              <p className="text-xs text-slate-400 truncate">{userEmail}</p>
            </div>
          )}
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm w-full">
            <LogOut className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Dashboard</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-slate-800 font-medium">Utilisateurs</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors relative">
              <Bell className="w-5 h-5 text-slate-600" />
            </button>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {userEmail?.[0]?.toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Gestion des utilisateurs</h1>
              <p className="text-slate-500 text-sm mt-1">{users.length} utilisateur(s) au total</p>
            </div>
            <button
              onClick={() => { resetForm(); setShowForm(true); setError(null); setSuccess(null) }}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm">
              <Plus className="w-4 h-4" />
              Nouvel utilisateur
            </button>
          </div>

          {/* Alerts */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              <p className="text-emerald-700 text-sm">{success}</p>
              <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Form */}
          {showForm && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">
                  {editingId ? 'Modifier l\'utilisateur' : 'Créer un utilisateur'}
                </h2>
                <button onClick={() => { setShowForm(false); resetForm() }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Prénom */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <User className="w-3.5 h-3.5 inline mr-1" /> Prénom *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.prenom}
                      onChange={e => setFormData({ ...formData, prenom: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Jean"
                    />
                  </div>

                  {/* Nom */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <User className="w-3.5 h-3.5 inline mr-1" /> Nom *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nom}
                      onChange={e => setFormData({ ...formData, nom: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="DUPONT"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <Mail className="w-3.5 h-3.5 inline mr-1" /> Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="jean.dupont@dgppe.gov"
                    />
                  </div>

                  {/* Mot de passe (création uniquement) */}
                  {!editingId && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        <Lock className="w-3.5 h-3.5 inline mr-1" /> Mot de passe * (min. 6 caractères)
                      </label>
                      <input
                        type="password"
                        required={!editingId}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="••••••••"
                        minLength={6}
                      />
                    </div>
                  )}

                  {/* Direction */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <Briefcase className="w-3.5 h-3.5 inline mr-1" /> Direction
                    </label>
                    <select
                      value={formData.direction}
                      onChange={e => setFormData({ ...formData, direction: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                      <option value="">-- Sélectionner une direction --</option>
                      {directions.map(d => (
                        <option key={d.id} value={d.code}>{d.nom}</option>
                      ))}
                    </select>
                  </div>

                  {/* Rôle */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <Shield className="w-3.5 h-3.5 inline mr-1" /> Rôle *
                    </label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                      <option value="agent_consultation">Agent de consultation</option>
                      <option value="agent_saisie">Agent de saisie</option>
                      <option value="gestionnaire">Gestionnaire</option>
                      <option value="administrateur">Administrateur</option>
                    </select>
                  </div>

                  {/* Statut */}
                  <div className="flex items-center gap-3 pt-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.actif}
                        onChange={e => setFormData({ ...formData, actif: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                    <span className="text-sm font-medium text-slate-700">
                      Compte {formData.actif ? 'actif' : 'inactif'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6 pt-5 border-t border-slate-100">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors">
                    <CheckCircle className="w-4 h-4" />
                    {editingId ? 'Enregistrer les modifications' : 'Créer l\'utilisateur'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); resetForm() }}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm transition-colors">
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-4 p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, email, direction..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value)}
                className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="all">Tous les rôles</option>
                <option value="administrateur">Administrateur</option>
                <option value="gestionnaire">Gestionnaire</option>
                <option value="agent_saisie">Agent de saisie</option>
                <option value="agent_consultation">Agent de consultation</option>
              </select>
              <button
                onClick={loadUsers}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
                <RefreshCw className="w-4 h-4" />
                Actualiser
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-16">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Aucun utilisateur trouvé</p>
                <p className="text-slate-400 text-sm mt-1">Essayez de modifier vos filtres</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
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
        </main>
      </div>
    </div>
  )
}
