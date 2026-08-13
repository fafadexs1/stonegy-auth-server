'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminPage() {
  const [adminPass, setAdminPass] = useState('');
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [changelog, setChangelog] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('/download/latest');
  const [forceUpdate, setForceUpdate] = useState(false);

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [releases, setReleases] = useState([]);

  async function loadReleases() {
    try {
      const res = await fetch('/api/version/history');
      const data = await res.json();
      if (data.success && data.releases) {
        setReleases(data.releases);
      }
    } catch (e) {}
  }

  useEffect(() => {
    loadReleases();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setStatusMsg({ text: '', type: '' });

    const payload = {
      adminPass,
      version: version.trim().replace(/^v/, ''),
      title: title.trim(),
      changelog: changelog.trim(),
      downloadUrl: downloadUrl.trim(),
      forceUpdate,
    };

    try {
      const res = await fetch('/api/version/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setStatusMsg({
          text: `✅ Versão ${payload.version} publicada com sucesso! As extensões já receberão a notificação.`,
          type: 'success',
        });
        setVersion('');
        setTitle('');
        setChangelog('');
        loadReleases();
      } else {
        setStatusMsg({ text: `❌ ${data.message || 'Erro ao publicar versão.'}`, type: 'error' });
      }
    } catch (err) {
      setStatusMsg({ text: '❌ Erro de conexão com o servidor.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: '#0b0b12', color: '#f0f0f8', padding: '30px 6%', minHeight: '100vh', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #242438', paddingBottom: '16px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>⚙️ Painel Admin - Lançamento de Versões (Next.js)</h1>
        <Link href="/" style={{ background: '#1a1a2e', border: '1px solid #242438', color: '#fff', padding: '8px 14px', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
          ⬅️ Voltar ao Site
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Form */}
        <div style={{ background: '#141422', border: '1px solid #242438', borderRadius: '14px', padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '18px', color: 'var(--accent)' }}>
            🚀 Publicar Nova Versão para a Extensão
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#8c8ca8', marginBottom: '6px', textTransform: 'uppercase' }}>
                Senha do Administrador
              </label>
              <input
                type="password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                placeholder="Senha de Admin (Padrão: 123456)"
                required
                style={{ width: '100%', background: '#0c0c16', border: '1px solid #242438', borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', color: '#fff', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#8c8ca8', marginBottom: '6px', textTransform: 'uppercase' }}>
                Número da Versão (ex: 3.5.0)
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="3.5.0"
                required
                style={{ width: '100%', background: '#0c0c16', border: '1px solid #242438', borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', color: '#fff', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#8c8ca8', marginBottom: '6px', textTransform: 'uppercase' }}>
                Título do Release
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Melhorias de Desempenho e Alertas"
                required
                style={{ width: '100%', background: '#0c0c16', border: '1px solid #242438', borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', color: '#fff', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#8c8ca8', marginBottom: '6px', textTransform: 'uppercase' }}>
                Changelog (O que há de novo?)
              </label>
              <textarea
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder="• Corrigido bug no cálculo de dano&#10;• Novo som de monstro raro"
                required
                style={{ width: '100%', height: '110px', background: '#0c0c16', border: '1px solid #242438', borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', color: '#fff', outline: 'none', resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#8c8ca8', marginBottom: '6px', textTransform: 'uppercase' }}>
                Link para Download do ZIP
              </label>
              <input
                type="text"
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
                required
                style={{ width: '100%', background: '#0c0c16', border: '1px solid #242438', borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', color: '#fff', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <input
                type="checkbox"
                id="chkForce"
                checked={forceUpdate}
                onChange={(e) => setForceUpdate(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="chkForce" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
                Forçar atualização (Trava a extensão até o usuário baixar a nova versão)
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', background: 'var(--accent)', color: '#09090f',
                border: 'none', padding: '12px', borderRadius: '8px',
                fontWeight: 800, fontSize: '1rem', cursor: 'pointer'
              }}
            >
              {loading ? 'Gravando no PostgreSQL...' : '📢 Publicar para Todas as Extensões'}
            </button>

            {statusMsg.text && (
              <div style={{
                marginTop: '14px', padding: '10px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 600,
                background: statusMsg.type === 'success' ? 'rgba(0,230,118,0.15)' : 'rgba(255,82,82,0.15)',
                color: statusMsg.type === 'success' ? 'var(--accent)' : '#ff5252',
                border: statusMsg.type === 'success' ? '1px solid rgba(0,230,118,0.3)' : '1px solid rgba(255,82,82,0.3)'
              }}>
                {statusMsg.text}
              </div>
            )}
          </form>
        </div>

        {/* History */}
        <div style={{ background: '#141422', border: '1px solid #242438', borderRadius: '14px', padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '18px', color: 'var(--accent)' }}>
            📜 Versões Ativas no Banco
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {releases.length === 0 ? (
              <div style={{ color: '#888' }}>Nenhuma versão gravada.</div>
            ) : (
              releases.map((r) => (
                <div key={r.id || r.version} style={{ background: '#0e0e18', border: '1px solid #242438', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '4px' }}>
                    <span style={{ color: 'var(--accent)' }}>v{r.version} - {r.title}</span>
                    <span style={{ color: '#8c8ca8', fontSize: '11px' }}>{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', whiteSpace: 'pre-line' }}>{r.changelog}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
