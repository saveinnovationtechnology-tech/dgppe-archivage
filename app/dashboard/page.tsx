'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, FilePlus, FolderOpen, Search,
  Users, ClipboardList, LogOut, FileText, Bell,
  TrendingUp, Calendar, Shield, ChevronRight,
  Building2, Menu, X, User, CheckCheck, AlertTriangle, Info
} from 'lucide-react'
import {
  getNonLues, getToutesNotifications,
  marquerCommeLue, marquerToutesLues,
  verifierNotificationsAuto
} from '@/lib/supabase/notifications'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [profil, setProfil] = useState<any>(null)
  const [stats, setStats] = useState({ totalDocs: 0, totalUsers: 0, ceMois: 0 })
  const [derniersDocs, setDerniersDocs] = useState<any[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [notifications, setNotifications] = useState<any[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      // Charger profil
      const { data: profilData } = await supabase
        .from('profils')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfil(profilData)

      // Vérifier notifications auto
      await verifierNotificationsAuto(user.id, profilData)

      // Charger notifications
      const notifs = await getToutesNotifications(user.id)
      setNotifications(notifs)

      // Stats
      const { count: totalDocs } = await supabase
        .from('documents').select('*', { count: 'exact', head: true })
      const { count: totalUsers } = await supabase
        .from('profils').select('*', { count: 'exact', head: true })
      const debut = new Date()
      debut.setDate(1); debut.setHours(0, 0, 0, 0)
      const { count: ceMois } = await supabase
        .from('documents').select('*', { count: 'exact', head: true })
        .gte('created_at', debut.toISOString())
      const { data: docs } = await supabase
        .from('documents')
        .select('id, intitule, type_document, created_at, niveau_confidentialite')
        .order('created_at', { ascending: false })
        .limit(5)

      setStats({ totalDocs: totalDocs || 0, totalUsers: totalUsers || 0, ceMois: ceMois || 0 })
      setDerniersDocs(docs || [])
    }
    init()
  }, [])

  // Fermer dropdown notif en cliquant ailleurs
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleMarquerLue = async (notifId: string) => {
    await marquerCommeLue(notifId)
    setNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, lue: true } : n)
    )
  }

  const handleToutesLues = async () => {
    if (!user) return
    await marquerToutesLues(user.id)
    setNotifications(prev => prev.map(n => ({ ...n, lue: true })))
  }

  const nonLues = notifications.filter(n => !n.lue).length

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord', active: true },
    { href: '/dashboard/documents/add', icon: FilePlus, label: 'Ajouter un document' },
    { href: '/dashboard/documents/view', icon: FolderOpen, label: 'Documents' },
    { href: '/dashboard/search', icon: Search, label: 'Rechercher' },
    { href: '/dashboard/users', icon: Users, label: 'Utilisateurs' },
    { href: '/dashboard/logs', icon: ClipboardList, label: 'Journaux d\'activité' },
  ]

  const getConfBadge = (niveau: string) => {
    const map: any = {
      'Secret': 'bg-red-100 text-red-700 border border-red-200',
      'Confidentiel': 'bg-amber-100 text-amber-700 border border-amber-200',
      'Interne': 'bg-blue-100 text-blue-700 border border-blue-200',
      'Public': 'bg-green-100 text-green-700 border border-green-200',
    }
    return map[niveau] || 'bg-gray-100 text-gray-600'
  }

  const getNotifIcon = (type: string) => {
    if (type === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
    if (type === 'success') return <CheckCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
    return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
  }

  const userInitial = (profil?.prenom || user?.email)?.charAt(0).toUpperCase() || 'U'
  const displayName = profil?.prenom && profil?.nom
    ? `${profil.prenom} ${profil.nom}`
    : user?.email

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">

      {/* SIDEBAR */}
      <aside className={`
        ${sidebarOpen ? 'w-64' : 'w-20'} 
        transition-all duration-300 ease-in-out
        bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900
        flex flex-col shadow-2xl relative z-10
      `}>
        <div className="flex items-center gap-3 p-6 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">DGPPE</h1>
              <p className="text-slate-400 text-xs">Archivage numérique</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto text-slate-400 hover:text-white transition-colors"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                ${item.active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }
              `}
            >
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
                <p className="text-white text-xs font-medium truncate">{displayName}</p>
                <p className="text-slate-400 text-xs">{profil?.role || 'Utilisateur'}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* CONTENU PRINCIPAL */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Tableau de bord</h2>
            <p className="text-slate-500 text-sm">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">

            {/* NOTIFICATION DROPDOWN */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {nonLues > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                    {nonLues > 9 ? '9+' : nonLues}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-800">Notifications</h3>
                    {nonLues > 0 && (
                      <button
                        onClick={handleToutesLues}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Tout marquer lu
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center py-8 text-slate-400">
                        <Bell className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-sm">Aucune notification</p>
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${!notif.lue ? 'bg-blue-50/50' : ''}`}
                          onClick={() => !notif.lue && handleMarquerLue(notif.id)}
                        >
                          <div className="flex items-start gap-3">
                            {getNotifIcon(notif.type)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-sm font-medium text-slate-800 ${!notif.lue ? 'font-semibold' : ''}`}>
                                  {notif.titre}
                                </p>
                                {!notif.lue && (
                                  <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.message}</p>
                              <p className="text-xs text-slate-400 mt-1">
                                {new Date(notif.created_at).toLocaleDateString('fr-FR', {
                                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                          {notif.titre.toLowerCase().includes('mot de passe') && !notif.lue && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push('/dashboard/profile')
                              }}
                              className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                              → Modifier mon mot de passe
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="px-4 py-2 border-t border-slate-100 text-center">
                    <span className="text-xs text-slate-400">{notifications.length} notification(s)</span>
                  </div>
                </div>
              )}
            </div>

            {/* PROFIL CLIQUABLE */}
            <button
              onClick={() => router.push('/dashboard/profile')}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold hover:opacity-90 hover:scale-105 transition-all duration-200 shadow-md"
              title="Mon profil"
            >
              {userInitial}
            </button>

          </div>
        </header>

        {/* MAIN - identique à avant */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 mb-8 overflow-hidden shadow-xl">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-white rounded-full translate-y-1/2"></div>
            </div>
            <div className="relative z-10">
              <p className="text-blue-200 text-sm font-medium mb-1">Bienvenue 👋</p>
              <h3 className="text-white text-2xl font-bold mb-2">{displayName}</h3>
              <p className="text-blue-200 text-sm max-w-md">
                Gérez vos documents administratifs en toute sécurité. Plateforme d'archivage numérique DGPPE.
              </p>
            </div>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20">
              <FileText className="w-24 h-24 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard title="Total Documents" value={stats.totalDocs} icon={<FolderOpen className="w-6 h-6" />} gradient="from-blue-500 to-blue-600" bg="bg-blue-50" iconColor="text-blue-600" trend="+12% ce mois" />
            <StatCard title="Utilisateurs" value={stats.totalUsers} icon={<Users className="w-6 h-6" />} gradient="from-purple-500 to-purple-600" bg="bg-purple-50" iconColor="text-purple-600" trend="Actifs" />
            <StatCard title="Ajouts ce mois" value={stats.ceMois} icon={<TrendingUp className="w-6 h-6" />} gradient="from-emerald-500 to-emerald-600" bg="bg-emerald-50" iconColor="text-emerald-600" trend="Nouveaux docs" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { href: '/dashboard/documents/add', icon: FilePlus, label: 'Nouveau document', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
              { href: '/dashboard/documents/view', icon: FolderOpen, label: 'Voir les documents', color: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
              { href: '/dashboard/search', icon: Search, label: 'Recherche avancée', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
              { href: '/dashboard/users', icon: Users, label: 'Gérer les utilisateurs', color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
            ].map((action) => (
              <a key={action.href} href={action.href} className={`flex flex-col items-center gap-2 p-4 rounded-xl ${action.color} transition-all duration-200 cursor-pointer group`}>
                <action.icon className="w-7 h-7" />
                <span className="text-xs font-medium text-center leading-tight">{action.label}</span>
              </a>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-600" />
                <h3 className="font-semibold text-slate-800">Derniers documents ajoutés</h3>
              </div>
              <a href="/dashboard/documents/view" className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                Voir tout <ChevronRight className="w-4 h-4" />
              </a>
            </div>
            {derniersDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <FolderOpen className="w-12 h-12 mb-3 opacity-50" />
                <p className="font-medium">Aucun document pour l'instant</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Intitulé</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Type</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Confidentialité</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {derniersDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-800 truncate max-w-xs">{doc.intitule}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4"><span className="text-sm text-slate-600">{doc.type_document}</span></td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConfBadge(doc.niveau_confidentialite)}`}>
                            <Shield className="w-3 h-3 mr-1" />{doc.niveau_confidentialite}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-slate-500">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(doc.created_at).toLocaleDateString('fr-FR')}
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

function StatCard({ title, value, icon, gradient, bg, iconColor, trend }: {
  title: string, value: number, icon: React.ReactNode,
  gradient: string, bg: string, iconColor: string, trend: string
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${bg} ${iconColor} flex items-center justify-center`}>{icon}</div>
        <span className="text-xs text-slate-400 font-medium">{trend}</span>
      </div>
      <div className={`text-3xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent mb-1`}>
        {value.toLocaleString()}
      </div>
      <p className="text-slate-500 text-sm font-medium">{title}</p>
    </div>
  )
}
