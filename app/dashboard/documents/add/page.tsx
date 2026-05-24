'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { logAction } from '@/lib/supabase/logs'

export default function AddDocumentPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [directions, setDirections] = useState<any[]>([])
  const [fichier, setFichier] = useState<File | null>(null)

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
    const loadDirections = async () => {
      const { data } = await supabase.from('directions').select('*')
      setDirections(data || [])
    }
    loadDirections()
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

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (!form.intitule || !form.type_document || !form.direction_origine || !form.auteur_service) {
      setMessage('❌ Veuillez remplir tous les champs obligatoires.')
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
          setMessage('❌ Seuls les fichiers PDF sont acceptés.')
          setLoading(false)
          return
        }

        if (fichier.size > 50 * 1024 * 1024) {
          setMessage('❌ Le fichier ne doit pas dépasser 50MB.')
          setLoading(false)
          return
        }

        fichier_base64 = await fileToBase64(fichier)
        fichier_nom = fichier.name
        fichier_taille = fichier.size
      }

      const { data: newDoc, error } = await supabase.from('documents').insert([{
        intitule: form.intitule,
        type_document: form.type_document,
        direction_origine: form.direction_origine,
        code_document: form.code_document || null,
        date_document: form.date_document || null,
        reference_administrative: form.reference_administrative || null,
        auteur_service: form.auteur_service,
        niveau_confidentialite: form.niveau_confidentialite,
        observations: form.observations || null,
        fichier_base64,
        fichier_nom,
        fichier_taille,
        created_by: user?.id || null,
      }]).select().single()

      if (error) throw error

      // ✅ LOG création document
      await logAction(
        'creation_document',
        `Création du document : ${form.intitule} (${form.type_document}) — ${form.direction_origine}`,
        newDoc?.id || null
      )

      setMessage('✅ Document enregistré avec succès !')
      setTimeout(() => router.push('/dashboard'), 2000)

    } catch (err: any) {
      console.error(err)
      setMessage(`❌ Erreur : ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: 'Segoe UI, sans-serif' }}>

      <header style={{
        background: 'linear-gradient(135deg, #1a3c5e, #2563a8)',
        color: 'white', padding: '1rem 2rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.5rem' }}>📁</span>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>DGPPE</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Gestion Documentaire</div>
          </div>
        </div>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          <a href="/dashboard" style={navStyle}>🏠 Tableau de bord</a>
          <a href="/documents/view" style={navStyle}>📄 Documents</a>
        </nav>
      </header>

      <main style={{ maxWidth: '900px', margin: '2rem auto', padding: '0 1rem' }}>

        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ color: '#1a3c5e', fontSize: '1.5rem', margin: 0 }}>➕ Ajouter un document</h1>
          <p style={{ color: '#666', marginTop: '0.3rem' }}>Remplissez les informations du document à enregistrer</p>
        </div>

        {message && (
          <div style={{
            padding: '1rem', borderRadius: '8px', marginBottom: '1rem',
            background: message.startsWith('✅') ? '#d4edda' : '#f8d7da',
            color: message.startsWith('✅') ? '#155724' : '#721c24',
            border: `1px solid ${message.startsWith('✅') ? '#c3e6cb' : '#f5c6cb'}`
          }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{
          background: 'white', borderRadius: '12px', padding: '2rem',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem'
        }}>

          <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Intitulé du document *</label>
            <input
              name="intitule"
              value={form.intitule}
              onChange={handleChange}
              placeholder="Ex: Rapport annuel 2024"
              style={inputStyle}
              required
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Type de document *</label>
            <select name="type_document" value={form.type_document} onChange={handleChange} style={inputStyle} required>
              <option value="">-- Sélectionner --</option>
              <option value="Rapport">Rapport</option>
              <option value="Note">Note</option>
              <option value="Circulaire">Circulaire</option>
              <option value="Arrêté">Arrêté</option>
              <option value="Décision">Décision</option>
              <option value="Procès-verbal">Procès-verbal</option>
              <option value="Contrat">Contrat</option>
              <option value="Correspondance">Correspondance</option>
              <option value="Autre">Autre</option>
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Direction d'origine *</label>
            <select name="direction_origine" value={form.direction_origine} onChange={handleChange} style={inputStyle} required>
              <option value="">-- Sélectionner --</option>
              {directions.map((d) => (
                <option key={d.id} value={d.nom}>{d.nom}</option>
              ))}
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Code document</label>
            <input
              name="code_document"
              value={form.code_document}
              onChange={handleChange}
              placeholder="Ex: DOC-2024-001"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Date du document</label>
            <input
              name="date_document"
              type="date"
              value={form.date_document}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Référence administrative</label>
            <input
              name="reference_administrative"
              value={form.reference_administrative}
              onChange={handleChange}
              placeholder="Ex: REF-2024-XXX"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Auteur / Service *</label>
            <input
              name="auteur_service"
              value={form.auteur_service}
              onChange={handleChange}
              placeholder="Ex: Direction des Études"
              style={inputStyle}
              required
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Niveau de confidentialité</label>
            <select name="niveau_confidentialite" value={form.niveau_confidentialite} onChange={handleChange} style={inputStyle}>
              <option value="Normal">🟢 Normal</option>
              <option value="Confidentiel">🟡 Confidentiel</option>
              <option value="Secret">🔴 Secret</option>
            </select>
          </div>

          <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Observations</label>
            <textarea
              name="observations"
              value={form.observations}
              onChange={handleChange}
              placeholder="Remarques ou informations complémentaires..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Pièce jointe (PDF uniquement, max 50MB)</label>
            <input
              type="file"
              onChange={(e) => setFichier(e.target.files?.[0] || null)}
              style={inputStyle}
              accept="application/pdf"
            />
            {fichier && (
              <span style={{ fontSize: '0.8rem', color: '#666' }}>
                📎 {fichier.name} ({(fichier.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            )}
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? '#aaa' : '#1a3c5e',
                color: 'white', border: 'none',
                padding: '0.8rem 2rem', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '1rem'
              }}
            >
              {loading ? '⏳ Enregistrement...' : '💾 Enregistrer le document'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              style={{
                background: '#eee', border: 'none', padding: '0.8rem 2rem',
                borderRadius: '8px', cursor: 'pointer', fontSize: '1rem'
              }}
            >
              Annuler
            </button>
          </div>

        </form>
      </main>
    </div>
  )
}

const navStyle: any = {
  color: 'white', textDecoration: 'none', padding: '0.6rem 1rem',
  borderRadius: '8px', background: 'rgba(255,255,255,0.1)', fontSize: '0.9rem'
}
const fieldStyle: any = { display: 'flex', flexDirection: 'column', gap: '0.3rem' }
const labelStyle: any = { fontWeight: 'bold', fontSize: '0.85rem', color: '#444' }
const inputStyle: any = {
  padding: '0.6rem', borderRadius: '6px', border: '1px solid #ddd',
  fontSize: '0.9rem', width: '100%', boxSizing: 'border-box'
}
