'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
  const [userRole, setUserRole] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    email: '',
    nom: '',
    prenom: '',
    direction: '',
    role: 'agent_consultation',
    actif: true,
  })

  useEffect(() => {
    const initPage = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/login'); return }

        const userId = session.user.id
        setUserEmail(session.user.email || '')

        const { data: profileData, error: profileError } = await supabase
          .from('profils')
          .select('role, actif')
          .eq('id', userId)
          .single()

        if (profileError || !profileData) { router.push('/dashboard'); return }
        if (!profileData.actif) { router.push('/login'); return }
        if (!['administrateur', 'admin', 'gestionnaire'].includes(profileData.role)) {
          router.push('/dashboard'); return
        }

        setUserRole(profileData.role)
        setIsAuthed(true)
        await loadUsers()
        await loadDirections()
      } catch (err) {
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
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    await supabase.from('logs_activite').insert({
      utilisateur_id: currentUser?.id,
      action,
      details,
      document_id: null,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    try {
      if (editingId) {
        const { error } = await supabase
          .from('profils')
          .update({
            email: formData.email,
            nom: formData.nom,
            prenom: formData.prenom,
            direction: formData.direction,
            role: formData.role,
            actif: formData.actif,
          })
          .eq('id', editingId)

        if (error) throw error

        await logAction(
          'modification',
          `Modification de l'utilisateur : ${formData.prenom} ${formData.nom} (${formData.email}) — rôle: ${formData.role}`
        )
        setSuccess('✅ Utilisateur modifié avec succès')
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: password,
        })
        if (authError) throw authError

        if (authData.user) {
          const { error: profilError } = await supabase
            .from('profils')
            .insert({
              id: authData.user.id,
              email: formData.email,
              nom: formData.nom,
              prenom: formData.prenom,
              direction: formData.direction,
              role: formData.role,
              actif: formData.actif,
            })
          if (profilError) throw profilError

          await logAction(
            'creation',
            `Création de l'utilisateur : ${formData.prenom} ${formData.nom} (${formData.email}) — rôle: ${formData.role}`
          )
        }
        setSuccess('✅ Utilisateur créé avec succès')
      }

      resetForm()
      await loadUsers()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement')
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
    setShowForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Supprimer l'utilisateur ${email} ?`)) return
    const { error } = await supabase.from('profils').delete().eq('id', id)
    if (error) { setError('Erreur lors de la suppression'); return }

    await logAction('suppression', `Suppression de l'utilisateur : ${email}`)
    setSuccess('✅ Utilisateur supprimé')
    await loadUsers()
  }

  const resetForm = () => {
    setFormData({ email: '', nom: '', prenom: '', direction: '', role: 'agent_consultation', actif: true })
    setPassword('')
    setEditingId(null)
    setShowForm(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.prenom?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchRole = filterRole === 'all' || u.role === filterRole
    return matchSearch && matchRole
  })

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'Arial' }}>
      <p>Chargement...</p>
    </div>
  )

  if (!isAuthed) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Arial' }}>

      {/* SIDEBAR */}
      <aside style={{
        width: '250px', background: '#1a3c5e', color: 'white',
        padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
        position: 'fixed', top: 0, left: 0, height: '100vh', overflowY: 'auto'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>🏛️ DGPPE</h2>
        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>{userEmail}</p>
        <hr style={{ borderColor: 'rgba(255,255,255,0.2)' }} />
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Link href="/dashboard" style={navStyle}>📊 Tableau de bord</Link>
          <Link href="/dashboard/documents" style={navStyle}>📄 Documents</Link>
          <Link href="/dashboard/users" style={{ ...navStyle, background: 'rgba(255,255,255,0.25)' }}>👥 Utilisateurs</Link>
          <Link href="/dashboard/logs" style={navStyle}>📋 Logs</Link>
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <button onClick={handleLogout} style={{
            background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none',
            padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer',
            width: '100%', fontSize: '0.9rem'
          }}>
            🚪 Déconnexion
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ marginLeft: '250px', flex: 1, padding: '2rem', background: '#f0f4f8', minHeight: '100vh' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ margin: 0, color: '#1a3c5e', fontSize: '1.8rem' }}>👥 Gestion des Utilisateurs</h1>
            <p style={{ margin: '0.3rem 0 0', color: '#666' }}>{users.length} utilisateur(s) enregistré(s)</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(!showForm) }}
            style={{
              background: '#1a3c5e', color: 'white', border: 'none',
              padding: '0.7rem 1.5rem', borderRadius: '8px', cursor: 'pointer',
              fontSize: '0.95rem', fontWeight: 'bold'
            }}
          >
            {showForm ? '✕ Annuler' : '+ Nouvel utilisateur'}
          </button>
        </div>

        {/* ALERTES */}
        {error && (
          <div style={{
            background: '#ffe0e0', border: '1px solid #f5c6cb', color: '#c00',
            padding: '0.8rem 1rem', borderRadius: '8px', marginBottom: '1rem'
          }}>
            ❌ {error}
          </div>
        )}
        {success && (
          <div style={{
            background: '#e0f7e9', border: '1px solid #a5d6a7', color: '#2d6a2d',
            padding: '0.8rem 1rem', borderRadius: '8px', marginBottom: '1rem'
          }}>
            {success}
          </div>
        )}

        {/* FORMULAIRE */}
        {showForm && (
          <div style={{
            background: 'white', borderRadius: '12px', padding: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '2rem'
          }}>
            <h2 style={{ margin: '0 0 1.2rem', color: '#1a3c5e', fontSize: '1.2rem' }}>
              {editingId ? '✏️ Modifier l\'utilisateur' : '➕ Nouvel utilisateur'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <input
                  type="email"
                  placeholder="Email *"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  style={inputStyle}
                />
                {!editingId && (
                  <input
                    type="password"
                    placeholder="Mot de passe *"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={inputStyle}
                  />
                )}
                <input
                  type="text"
                  placeholder="Nom *"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="Prénom *"
                  value={formData.prenom}
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                  required
                  style={inputStyle}
                />
                <select
                  value={formData.direction}
                  onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">-- Direction --</option>
                  {directions.map((d) => (
                    <option key={d.id} value={d.code}>{d.nom}</option>
                  ))}
                </select>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={inputStyle}
                >
                  <option value="agent_consultation">Agent consultation</option>
                  <option value="gestionnaire">Gestionnaire</option>
                  <option value="administrateur">Administrateur</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#444' }}>
                <input
                  type="checkbox"
                  checked={formData.actif}
                  onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                />
                Compte actif
              </label>
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <button type="submit" style={{
                  background: '#1a3c5e', color: 'white', border: 'none',
                  padding: '0.7rem 1.5rem', borderRadius: '8px', cursor: 'pointer',
                  fontWeight: 'bold'
                }}>
                  {editingId ? '💾 Enregistrer' : '✅ Créer'}
                </button>
                <button type="button" onClick={resetForm} style={{
                  background: '#eee', color: '#444', border: 'none',
                  padding: '0.7rem 1.5rem', borderRadius: '8px', cursor: 'pointer'
                }}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* FILTRES */}
        <div style={{
          background: 'white', borderRadius: '12px', padding: '1rem 1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1.5rem',
          display: 'flex', gap: '1rem'
        }}>
          <input
            type="text"
            placeholder="🔍 Rechercher par nom, prénom ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            style={{ ...inputStyle, width: '200px' }}
          >
            <option value="all">Tous les rôles</option>
            <option value="agent_consultation">Agent consultation</option>
            <option value="gestionnaire">Gestionnaire</option>
            <option value="administrateur">Administrateur</option>
          </select>
        </div>

        {/* TABLEAU */}
        <div style={{
          background: 'white', borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#f0f4f8' }}>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Nom</th>
                <th style={thStyle}>Prénom</th>
                <th style={thStyle}>Direction</th>
                <th style={thStyle}>Rôle</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={tdStyle}>{u.email}</td>
                    <td style={tdStyle}>{u.nom}</td>
                    <td style={tdStyle}>{u.prenom}</td>
                    <td style={tdStyle}>{u.direction || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem',
                        background: u.role === 'administrateur' ? '#e3f2fd' :
                                    u.role === 'gestionnaire' ? '#f3e5f5' : '#e8f5e9',
                        color: u.role === 'administrateur' ? '#1565c0' :
                               u.role === 'gestionnaire' ? '#6a1b9a' : '#2e7d32',
                        fontWeight: '600'
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem',
                        background: u.actif ? '#e8f5e9' : '#fce4ec',
                        color: u.actif ? '#2e7d32' : '#c62828',
                        fontWeight: '600'
                      }}>
                        {u.actif ? '✅ Actif' : '❌ Inactif'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => handleEdit(u)}
                        style={{
                          background: '#1a3c5e', color: 'white', border: 'none',
                          padding: '0.3rem 0.7rem', borderRadius: '6px',
                          cursor: 'pointer', fontSize: '0.8rem', marginRight: '0.4rem'
                        }}
                      >
                        ✏️ Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.email)}
                        style={{
                          background: '#c62828', color: 'white', border: 'none',
                          padding: '0.3rem 0.7rem', borderRadius: '6px',
                          cursor: 'pointer', fontSize: '0.8rem'
                        }}
                      >
                        🗑️ Supprimer
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

const navStyle: any = {
  color: 'white', textDecoration: 'none', padding: '0.6rem 1rem',
  borderRadius: '8px', background: 'rgba(255,255,255,0.1)', fontSize: '0.9rem'
}
const inputStyle: any = {
  padding: '0.6rem 0.8rem', borderRadius: '8px',
  border: '1px solid #ddd', fontSize: '0.9rem', width: '100%'
}
const thStyle: any = {
  padding: '0.8rem 1rem', fontWeight: 'bold',
  color: '#444', textAlign: 'left'
}
const tdStyle: any = { padding: '0.8rem 1rem', color: '#333' }
