'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/supabase/logs'
import styles from './login.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
      return
    }

    await logAction('connexion', `Connexion de ${email}`)

    router.push('/dashboard')
  }

  return (
    <main className={styles.main}>
      <div className={styles.background}>
        <div className={styles.blob1} />
        <div className={styles.blob2} />
      </div>

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>🏛️</div>
          <h1 className={styles.title}>DGPPE</h1>
          <p className={styles.subtitle}>
            Système de Gestion des Archives<br />
            Accès réservé aux agents autorisés
          </p>
          <div className={styles.divider} />
        </div>

        <form className={styles.form} onSubmit={handleLogin}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>ADRESSE EMAIL</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>✉️</span>
              <input
                className={styles.input}
                type="email"
                placeholder="agent@dgppe.gov"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>MOT DE PASSE</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>🔒</span>
              <input
                className={styles.input}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && <p className={styles.error}>⚠️ {error}</p>}

          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? '⏳ Connexion...' : '🔐 Se connecter'}
          </button>
        </form>

        <div className={styles.footer}>
          <p>© 2025 DGPPE — Accès sécurisé</p>
        </div>
      </div>
    </main>
  )
}
