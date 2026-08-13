'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [releases, setReleases] = useState([]);
  const [dbOnline, setDbOnline] = useState(false);
  const [latestVer, setLatestVer] = useState('3.4.0');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [relRes, healthRes] = await Promise.all([
          fetch('/api/version/history').then(r => r.json()).catch(() => ({})),
          fetch('/api/health').then(r => r.json()).catch(() => ({}))
        ]);

        if (relRes.success && relRes.releases && relRes.releases.length > 0) {
          setReleases(relRes.releases);
          setLatestVer(relRes.releases[0].version);
        }
        if (healthRes.success && healthRes.status === 'online') {
          setDbOnline(true);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Navigation */}
      <nav style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 8%', borderBottom: '1px solid var(--card-border)',
        background: 'rgba(14,14,22,0.8)', backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 800, fontSize: '1.25rem' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'linear-gradient(135deg, var(--accent), var(--secondary))',
            borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', boxShadow: '0 0 16px var(--accent-glow)'
          }}>⚔️</div>
          <span>Stonegy Pro Tracker</span>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <a href="#updates" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>Atualizações</a>
          <a href="https://stonegy-online.com" target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>🎮 Jogar Stonegy</a>
          <Link href="/admin" style={{
            background: '#1a1a2b', border: '1px solid var(--card-border)',
            color: '#fff', padding: '7px 14px', borderRadius: '8px',
            fontSize: '0.85rem', fontWeight: 700
          }}>⚙️ Painel Admin</Link>
        </div>
      </nav>

      {/* Hero */}
      <header style={{ textAlign: 'center', padding: '70px 6% 50px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: dbOnline ? 'rgba(0,230,118,0.1)' : 'rgba(255,82,82,0.1)',
          border: dbOnline ? '1px solid rgba(0,230,118,0.3)' : '1px solid rgba(255,82,82,0.3)',
          color: dbOnline ? 'var(--accent)' : '#ff5252',
          padding: '5px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '20px'
        }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: dbOnline ? 'var(--accent)' : '#ff5252',
            boxShadow: dbOnline ? '0 0 8px var(--accent)' : '0 0 8px #ff5252'
          }}></span>
          <span>{dbOnline ? 'PostgreSQL Online (Porta 4264)' : 'Servidor Inicializando...'}</span>
        </div>
        <h1 style={{ fontSize: '2.8rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '16px', letterSpacing: '-0.5px' }}>
          Hub Oficial de Atualizações • <span style={{ color: 'var(--accent)' }}>tibiaonline.klyraai.com.br</span>
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '32px' }}>
          Monitore DPS em tempo real, calcule o balanço da hunt, receba alertas sonoros de monstros Fiendish/Influenciados e sincronize suas conquistas com a nuvem.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <a href="/download/latest" style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            background: 'var(--accent)', color: '#09090f', padding: '14px 28px',
            borderRadius: '10px', fontWeight: 800, fontSize: '1rem',
            boxShadow: '0 8px 24px var(--accent-glow)'
          }}>
            <span>⬇️</span> Baixar Extensão Protegida (v{latestVer})
          </a>
          <a href="#updates" style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            background: '#181827', border: '1px solid var(--card-border)',
            color: '#fff', padding: '14px 24px', borderRadius: '10px',
            fontWeight: 700, fontSize: '0.95rem'
          }}>📜 Ver Histórico de Atualizações</a>
        </div>
      </header>

      {/* Updates Container */}
      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 6%', width: '100%' }} id="updates">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          🚀 Histórico de Atualizações & Releases
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '50px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Carregando atualizações do banco de dados...</div>
          ) : releases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Nenhuma atualização registrada no momento.</div>
          ) : (
            releases.map((rel) => (
              <div key={rel.id || rel.version} style={{
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: '14px', padding: '24px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: '1.15rem', fontWeight: 800,
                      color: 'var(--accent)', background: 'rgba(0,230,118,0.1)', padding: '3px 10px', borderRadius: '6px'
                    }}>v{rel.version}</span>
                    {rel.force_update && (
                      <span style={{ background: '#ff5252', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>OBRIGATÓRIA</span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Publicado em: {new Date(rel.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '10px' }}>{rel.title}</div>
                <div style={{
                  fontSize: '0.92rem', color: '#b5b5cb', lineHeight: 1.6, whiteSpace: 'pre-line',
                  background: '#0c0c14', padding: '14px 18px', borderRadius: '8px', border: '1px solid #1a1a28'
                }}>{rel.changelog}</div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{ marginTop: 'auto', borderTop: '1px solid var(--card-border)', padding: '24px 8%', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <p>Portal Oficial & API: <code>tibiaonline.klyraai.com.br</code> • Powered by Next.js</p>
      </footer>
    </div>
  );
}
