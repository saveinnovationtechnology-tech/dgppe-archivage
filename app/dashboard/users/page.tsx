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

  // ✅ Vérifier session + rôle
  useEffect(() => {
    const initPage = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('🔍 Session obtenue:', session?.user?.id)

        if (!session) {
          console.log('❌ Pas de session → redirection login')
          router.push('/login')
          return
        }

        const userId = session.user.id
        const userAuthEmail = session.user.email || 'utilisateur@dgppe.sn'
        setUserEmail(userAuthEmail)

        const { data: profileData, error: profileError } = await supabase
          .from('profils')
          .select('role, actif')
          .eq('id', userId)
          .single()

        if (profileError || !profileData) {
          console.log('❌ Profil non trouvé', profileError)
          router.push('/dashboard')
          return
        }

        if (!profileData.actif) {
          console.log('❌ Profil inactif')
          router.push('/login')
          return
        }

        if (!['administrateur', 'admin', 'gestionnaire'].includes(profileData.role)) {
          console.log('❌ Rôle non autorisé:', profileData.role)
          router.push('/dashboard')
          return
        }

        console.log('✅ Accès autorisé, rôle:', profileData.role)
        setUserRole(profileData.role)
        setIsAuthed(true)
        await loadUsers()
        await loadDirections()
      } catch (err) {
        console.error('Erreur init:', err)
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

    if (error) {
      console.error('Erreur loadUsers:', error)
      setError('Erreur lors du chargement des utilisateurs')
      return
    }
    setUsers(data || [])
  }

  const loadDirections = async () => {
    const { data, error } = await supabase
      .from('directions')
      .select('*')
      .order('nom')

    if (error) {
      console.error('Erreur loadDirections:', error)
      return
    }
    setDirections(data || [])
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
        setSuccess('Utilisateur modifié avec succès')
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
        }
        setSuccess('Utilisateur créé avec succès')
      }

      resetForm()
      await loadUsers()
    } catch (err: any) {
      console.error(err)
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
  }

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Supprimer l'utilisateur ${email} ?`)) return

    const { error } = await supabase
      .from('profils')
      .delete()
      .eq('id', id)

    if (error) {
      setError('Erreur lors de la suppression')
      return
    }
    setSuccess('Utilisateur supprimé')
    await loadUsers()
  }

  const resetForm = () => {
    setFormData({
      email: '',
      nom: '',
      prenom: '',
      direction: '',
      role: 'agent_consultation',
      actif: true,
    })
    setPassword('')
    setEditingId(null)
    setShowForm(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filteredUsers = users.filter((user) => {
    const matchSearch =
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.prenom?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchRole = filterRole === 'all' || user.role === filterRole
    return matchSearch && matchRole
  })

  // STYLES
  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: 'Arial, sans-serif',
  }
  const headerStyle: React.CSSProperties = {
    backgroundColor: '#1565c0',
    color: 'white',
    padding: '15px 30px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }
  const navStyle: React.CSSProperties = {
    display: 'flex',
    gap: '20px',
  }
  const linkStyle: React.CSSProperties = {
    color: 'white',
    textDecoration: 'none',
    fontWeight: '500',
  }
  const contentStyle: React.CSSProperties = {
    padding: '30px',
    maxWidth: '1400px',
    margin: '0 auto',
  }
  const buttonPrimaryStyle: React.CSSProperties = {
    padding: '10px 20px',
    backgroundColor: '#1565c0',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600',
  }
  const inputStyle: React.CSSProperties = {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    width: '100%',
  }
  const tableContainerStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  }
  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
  }
  const thStyle: React.CSSProperties = {
    padding: '12px',
    backgroundColor: '#f5f5f5',
    textAlign: 'left',
    fontWeight: '600',
    borderBottom: '2px solid #ddd',
  }
  const tdStyle: React.CSSProperties = {
    padding: '12px',
    borderBottom: '1px solid #eee',
  }

  if (loading) {
    return (
      <div style={{ ...containerStyle, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p>Chargement...</p>
      </div>
    )
  }

  if (!isAuthed) return null

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>DGPPE - Gestion des Utilisateurs</h1>
        <nav style={navStyle}>
          <Link href="/dashboard" style={linkStyle}>Dashboard</Link>
          <Link href="/dashboard/documents/view" style={linkStyle}>Documents</Link>
          <Link href="/dashboard/logs" style={linkStyle}>Logs</Link>
          <span style={{ opacity: 0.8 }}>{userEmail}</span>
          <button onClick={handleLogout} style={{ ...linkStyle, background: 'none', border: 'none', cursor: 'pointer' }}>
            Déconnexion
          </button>
        </nav>
      </header>

      <div style={contentStyle}>
        {error && <div style={{ padding: '10px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '15px' }}>{error}</div>}
        {success && <div style={{ padding: '10px', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '4px', marginBottom: '15px' }}>{success}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>👥 Utilisateurs ({filteredUsers.length})</h2>
          <button onClick={() => setShowForm(!showForm)} style={buttonPrimaryStyle}>
            {showForm ? '✖ Annuler' : '+ Nouvel utilisateur'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3>{editingId ? 'Modifier' : 'Créer'} un utilisateur</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required style={inputStyle} />
              {!editingId && (
                <input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
              )}
              <input type="text" placeholder="Nom" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} required style={inputStyle} />
              <input type="text" placeholder="Prénom" value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} required style={inputStyle} />
              <select value={formData.direction} onChange={(e) => setFormData({ ...formData, direction: e.target.value })} style={inputStyle}>
                <option value="">-- Direction --</option>
                {directions.map((d) => (
                  <option key={d.id} value={d.code}>{d.nom}</option>
                ))}
              </select>
              <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} style={inputStyle}>
                <option value="agent_consultation">Agent consultation</option>
                <option value="gestionnaire">Gestionnaire</option>
                <option value="administrateur">Administrateur</option>
              </select>
            </div>
            <label style={{ display: 'block', marginBottom: '15px' }}>
              <input type="checkbox" checked={formData.actif} onChange={(e) => setFormData({ ...formData, actif: e.target.checked })} /> Actif
            </label>
            <button type="submit" style={buttonPrimaryStyle}>{editingId ? 'Modifier' : 'Créer'}</button>
          </form>
        )}

        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <input type="text" placeholder="🔍 Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} style={{ ...inputStyle, width: '200px' }}>
            <option value="all">Tous les rôles</option>
            <option value="agent_consultation">Agent consultation</option>
            <option value="gestionnaire">Gestionnaire</option>
            <option value="administrateur">Admin</option>
          </select>
        </div>

        <div style={tableContainerStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Nom</th>
                <th style={thStyle}>Prénom</th>
                <th style={thStyle}>Direction</th>
                <th style={thStyle}>Rôle</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td style={tdStyle}>{user.email}</td>
                    <td style={tdStyle}>{user.nom}</td>
                    <td style={tdStyle}>{user.prenom}</td>
                    <td style={tdStyle}>{user.direction || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: user.role === 'administrateur' ? '#e3f2fd' : '#f3e5f5',
                        color: user.role === 'administrateur' ? '#1565c0' : '#6a1b9a',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => handleEdit(user)} style={{ ...buttonPrimaryStyle, padding: '6px 12px', marginRight: '5px' }}>✏️</button>
                      <button onClick={() => handleDelete(user.id, user.email)} style={{ ...buttonPrimaryStyle, padding: '6px 12px', backgroundColor: '#d32f2f' }}>🗑️</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#999' }}>
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
