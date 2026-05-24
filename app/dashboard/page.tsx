'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({ totalDocs: 0, totalUsers: 0, ceMois: 0 })
  const [derniersDocs, setDerniersDocs] = useState<any[]>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      // Total documents
      const { count: totalDocs } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })

      // Total utilisateurs
      const { count: totalUsers } = await supabase
        .from('profils')
        .select('*', { count: 'exact', head: true })

      // Ce mois
      const debut = new Date()
      debut.setDate(1)
      debut.setHours(0, 0, 0, 0)
      const { count: ceMois } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', debut.toISOString())

      // Derniers documents
      const { data: docs } = await supabase
        .from('documents')
        .select('id, intitule, type_document, created_at, niveau_confidentialite')
        .order('created_at', { ascending: false })
        .limit(5)

      setStats({
        totalDocs: totalDocs || 0,
        totalUsers: totalUsers || 0,
        ceMois: ceMois || 0,
      })
      setDerniersDocs(docs || [])
    }
    init()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Arial' }}>

      {/* SIDEBAR */}
      <aside style={{
        width: '250px', background: '#1a3c5e', color: 'white',
        padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>🏛️ DGPPE</h2>
        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>{user?.email}</p>
        <hr style={{ borderColor: 'rgba(255,255,255,0.2)' }} />
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <a href="/dashboard" style={navStyle}>📊 Tableau de bord</a>
          <a href="/dashboard/documents/add" style={navStyle}>➕ Ajouter un document</a>
          <a href="/dashboard/documents/view" style={navStyle}>📁 Documents</a>
          <a href="/dashboard/search" style={navStyle}>🔍 Rechercher</a>
          <a href="/dashboard/users" style={navStyle}>👥 Utilisateurs</a>
          <a href="/dashboard/logs" style={navStyle}>📋 Logs</a>
        </nav>
        <button onClick={handleLogout} style={{
          marginTop: 'auto', background: 'rgba(255,255,255,0.1)', border: 'none',
          color: 'white', padding: '0.7rem', borderRadius: '8px', cursor: 'pointer'
        }}>
          🚪 Déconnexion
        </button>
      </aside>

      {/* CONTENU PRINCIPAL */}
      <main style={{ flex: 1, padding: '2rem', background: '#f5f7fa' }}>
        <h1 style={{ marginTop: 0 }}>Tableau de bord</h1>
        <p style={{ color: '#666' }}>Bienvenue, {user?.email}</p>

        {/* CARTES STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          <StatCard title="Total Documents" value={stats.totalDocs} icon="📁" />
          <StatCard title="Utilisateurs" value={stats.totalUsers} icon="👥" />
          <StatCard title="Ce mois" value={stats.ceMois} icon="📅" />
        </div>

        {/* DERNIERS DOCS */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ marginTop: 0 }}>📄 Derniers documents</h2>
          {derniersDocs.length === 0 ? (
            <p style={{ color: '#999' }}>Aucun document pour l'instant</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f0f4f8', textAlign: 'left' }}>
                  <th style={thStyle}>Intitulé</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Confidentialité</th>
                  <th style={thStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {derniersDocs.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={tdStyle}>{doc.intitule}</td>
                    <td style={tdStyle}>{doc.type_document}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem',
                        background: doc.niveau_confidentialite === 'Secret' ? '#ffe0e0' :
                                    doc.niveau_confidentialite === 'Confidentiel' ? '#fff3cd' : '#e0f0e0',
                        color: doc.niveau_confidentialite === 'Secret' ? '#c00' :
                               doc.niveau_confidentialite === 'Confidentiel' ? '#856404' : '#2d6a2d'
                      }}>
                        {doc.niveau_confidentialite}
                      </span>
                    </td>
                    <td style={tdStyle}>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}

const navStyle: any = {
  color: 'white', textDecoration: 'none', padding: '0.6rem 1rem',
  borderRadius: '8px', background: 'rgba(255,255,255,0.1)', fontSize: '0.9rem'
}
const thStyle: any = { padding: '0.7rem 1rem', fontWeight: 'bold', color: '#444' }
const tdStyle: any = { padding: '0.7rem 1rem', color: '#333' }

function StatCard({ title, value, icon }: { title: string, value: number, icon: string }) {
  return (
    <div style={{
      background: 'white', borderRadius: '12px', padding: '1.5rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    }}>
      <div style={{ fontSize: '2rem' }}>{icon}</div>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a3c5e' }}>{value}</div>
      <div style={{ color: '#666', fontSize: '0.9rem' }}>{title}</div>
    </div>
  )
}
