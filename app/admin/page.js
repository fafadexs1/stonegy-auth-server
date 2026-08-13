'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  // Auth State
  const [adminToken, setAdminToken] = useState(null);
  const [adminUser, setAdminUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Login / Register Form State
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authInviteCode, setAuthInviteCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState('overview'); // overview, users, releases, hunts, settings

  // Data States
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [releases, setReleases] = useState([]);
  const [hunts, setHunts] = useState([]);
  const [huntSort, setHuntSort] = useState('recorded_at');
  const [settings, setSettings] = useState({});

  // Toast / Alert Notification
  const [toast, setToast] = useState({ show: false, text: '', type: 'success' });

  function showToast(text, type = 'success') {
    setToast({ show: true, text, type });
    setTimeout(() => setToast({ show: false, text: '', type: 'success' }), 4000);
  }

  // 1. Check existing token on mount
  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem('st_admin_token');
      if (!token) {
        setAuthChecking(false);
        return;
      }

      try {
        const res = await fetch('/api/admin/auth/verify', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success && data.admin) {
          setAdminToken(token);
          setAdminUser(data.admin);
        } else {
          localStorage.removeItem('st_admin_token');
        }
      } catch (e) {
        localStorage.removeItem('st_admin_token');
      } finally {
        setAuthChecking(false);
      }
    }
    checkAuth();
  }, []);

  // 2. Fetch Tab Data when Authenticated
  useEffect(() => {
    if (!adminToken) return;

    if (activeTab === 'overview') fetchStats();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'releases') fetchReleases();
    if (activeTab === 'hunts') fetchHunts();
    if (activeTab === 'settings') fetchSettings();
  }, [adminToken, activeTab]);

  async function apiAdmin(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
      ...(options.headers || {})
    };
    const res = await fetch(endpoint, { ...options, headers });
    return await res.json();
  }

  async function fetchStats() {
    try {
      const data = await apiAdmin('/api/admin/stats');
      if (data.success) setStats(data.stats);
    } catch (e) {}
  }

  async function fetchUsers(search = userSearch) {
    try {
      const data = await apiAdmin(`/api/admin/users?q=${encodeURIComponent(search)}`);
      if (data.success) setUsers(data.users);
    } catch (e) {}
  }

  async function fetchReleases() {
    try {
      const data = await apiAdmin('/api/admin/releases');
      if (data.success) setReleases(data.releases);
    } catch (e) {}
  }

  async function fetchHunts(sort = huntSort) {
    try {
      const data = await apiAdmin(`/api/admin/hunts?sort=${sort}`);
      if (data.success) setHunts(data.hunts);
    } catch (e) {}
  }

  async function fetchSettings() {
    try {
      const data = await apiAdmin('/api/admin/settings');
      if (data.success) setSettings(data.settings);
    } catch (e) {}
  }

  // 3. Handle Admin Login / Register
  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const endpoint = isRegisterMode ? '/api/admin/auth/register' : '/api/admin/auth/login';
      const payload = isRegisterMode 
        ? { username: authUsername, password: authPassword, inviteCode: authInviteCode }
        : { username: authUsername, password: authPassword };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success && data.token) {
        localStorage.setItem('st_admin_token', data.token);
        setAdminToken(data.token);
        setAdminUser(data.admin);
        showToast(isRegisterMode ? 'Conta de Administrador criada com sucesso!' : 'Login realizado com sucesso!');
      } else {
        setAuthError(data.message || 'Falha na autenticação.');
      }
    } catch (err) {
      setAuthError('Erro ao conectar com o servidor.');
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('st_admin_token');
    setAdminToken(null);
    setAdminUser(null);
    showToast('Você saiu da sessão de administrador.', 'info');
  }

  // Loading Screen
  if (authChecking) {
    return (
      <div style={{ background: '#09090f', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🔐</div>
          <div style={{ fontSize: '1rem', color: '#888' }}>Verificando credenciais de administrador...</div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: LOGIN / REGISTER MODAL (IF NOT AUTHENTICATED)
  // =========================================================================
  if (!adminToken) {
    return (
      <div style={{
        background: '#07070d', color: '#f0f0f8', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}>
        <div style={{
          width: '100%', maxWidth: '420px', background: '#12121e',
          border: '1px solid #232338', borderRadius: '16px', padding: '32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8), 0 0 1px rgba(0,230,118,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: '40px', height: '40px', background: 'linear-gradient(135deg, #00e676, #00b0ff)',
              borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem', boxShadow: '0 0 16px rgba(0,230,118,0.3)'
            }}>🛡️</div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Stonegy Admin Portal</h1>
              <div style={{ fontSize: '0.8rem', color: '#8888a2' }}>Acesso Seguro & Gestão em Nuvem</div>
            </div>
          </div>

          <div style={{
            background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)',
            borderRadius: '8px', padding: '8px 12px', fontSize: '0.82rem', color: '#00e676',
            margin: '18px 0', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <span>🔒</span>
            <span>Autenticação criptografada com PostgreSQL</span>
          </div>

          {authError && (
            <div style={{
              background: 'rgba(255,82,82,0.12)', border: '1px solid rgba(255,82,82,0.3)',
              color: '#ff5252', padding: '10px 12px', borderRadius: '8px',
              fontSize: '0.85rem', marginBottom: '16px', fontWeight: 600
            }}>
              ❌ {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#a0a0ba', marginBottom: '6px', textTransform: 'uppercase' }}>
                Usuário Admin
              </label>
              <input
                type="text"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                placeholder="Ex: fabricio"
                required
                style={{
                  width: '100%', background: '#0b0b14', border: '1px solid #232338',
                  borderRadius: '8px', padding: '11px 13px', color: '#fff', fontSize: '0.95rem', outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#a0a0ba', marginBottom: '6px', textTransform: 'uppercase' }}>
                Senha
              </label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••"
                required
                style={{
                  width: '100%', background: '#0b0b14', border: '1px solid #232338',
                  borderRadius: '8px', padding: '11px 13px', color: '#fff', fontSize: '0.95rem', outline: 'none'
                }}
              />
            </div>

            {isRegisterMode && (
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#00b0ff', marginBottom: '6px', textTransform: 'uppercase' }}>
                  🔑 Código Mestre de Convite
                </label>
                <input
                  type="text"
                  value={authInviteCode}
                  onChange={(e) => setAuthInviteCode(e.target.value)}
                  placeholder="Código de ativação (Ex: 123456)"
                  required
                  style={{
                    width: '100%', background: '#0b0b14', border: '1px solid #00b0ff',
                    borderRadius: '8px', padding: '11px 13px', color: '#fff', fontSize: '0.95rem', outline: 'none'
                  }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              style={{
                width: '100%', background: 'linear-gradient(135deg, #00e676, #00c853)',
                color: '#09090f', border: 'none', padding: '13px', borderRadius: '8px',
                fontWeight: 800, fontSize: '1rem', cursor: 'pointer', marginTop: '6px',
                boxShadow: '0 4px 20px rgba(0,230,118,0.3)'
              }}
            >
              {authLoading ? 'Verificando...' : isRegisterMode ? 'Criar Conta de Administrador' : 'Entrar no Painel Seguro'}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.85rem' }}>
            <span
              onClick={() => { setIsRegisterMode(!isRegisterMode); setAuthError(''); }}
              style={{ color: '#00b0ff', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isRegisterMode ? 'Já tem uma conta de Admin? Fazer Login' : 'Registrar novo Administrador com Código Mestre'}
            </span>
          </div>

          <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid #1a1a2b', paddingTop: '16px' }}>
            <Link href="/" style={{ color: '#8888a2', fontSize: '0.85rem', textDecoration: 'none' }}>
              ⬅️ Voltar para o Site Principal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: MAIN ENTERPRISE ADMIN DASHBOARD
  // =========================================================================
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#09090f', color: '#f0f0f8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      
      {/* Toast Notification */}
      {toast.show && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
          background: toast.type === 'success' ? '#00e676' : '#ff5252',
          color: '#09090f', padding: '12px 20px', borderRadius: '10px',
          fontWeight: 800, fontSize: '0.9rem', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          animation: 'slideUp 0.3s ease'
        }}>
          {toast.text}
        </div>
      )}

      {/* Sidebar */}
      <aside style={{
        width: '260px', background: '#10101a', borderRight: '1px solid #202030',
        display: 'flex', flexDirection: 'column', padding: '24px 16px', position: 'sticky', top: 0, height: '100vh'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px', paddingLeft: '8px' }}>
          <div style={{
            width: '34px', height: '34px', background: 'linear-gradient(135deg, #00e676, #00b0ff)',
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem', boxShadow: '0 0 12px rgba(0,230,118,0.3)'
          }}>🛡️</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Stonegy Admin</div>
            <div style={{ fontSize: '0.72rem', color: '#00e676', fontWeight: 700 }}>🟢 PostgreSQL Conectado</div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          {[
            { id: 'overview', label: '📊 Visão Geral & KPIs' },
            { id: 'users', label: '👥 Gerenciar Usuários & VIP' },
            { id: 'releases', label: '🚀 Publicar Atualizações' },
            { id: 'hunts', label: '⚔️ Caçadas & Leaderboard' },
            { id: 'settings', label: '⚙️ Configurações Globais' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 14px', borderRadius: '10px', border: 'none',
                background: activeTab === item.id ? 'rgba(0,230,118,0.12)' : 'transparent',
                color: activeTab === item.id ? '#00e676' : '#9a9ab2',
                fontWeight: activeTab === item.id ? 800 : 600,
                fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left',
                borderLeft: activeTab === item.id ? '3px solid #00e676' : '3px solid transparent',
                transition: 'all 0.15s'
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* User Footer */}
        <div style={{ borderTop: '1px solid #202030', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 6px' }}>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>👑 {adminUser?.username}</div>
              <div style={{ fontSize: '0.72rem', color: '#00b0ff', fontWeight: 700 }}>SUPERADMIN</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              style={{ background: '#1c1c2c', border: '1px solid #2e2e44', color: '#ff5252', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
            >
              🚪 Sair
            </button>
          </div>
          <Link href="/" target="_blank" style={{ color: '#8888a0', fontSize: '0.8rem', textAlign: 'center', textDecoration: 'none' }}>
            🌐 Abrir Site Público ↗
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', maxHeight: '100vh' }}>
        
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>
              {activeTab === 'overview' && '📊 Painel de Controle e Métricas'}
              {activeTab === 'users' && '👥 Gerenciamento de Usuários e Assinaturas VIP'}
              {activeTab === 'releases' && '🚀 Gestor de Versões & Auto-Updater'}
              {activeTab === 'hunts' && '⚔️ Registro de Hunts & Auditoria'}
              {activeTab === 'settings' && '⚙️ Configurações do Sistema e Servidores'}
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#8888a2' }}>
              Base de dados PostgreSQL em <code>easypanel.vps1.klyraai.com.br:4264</code>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                if (activeTab === 'overview') fetchStats();
                if (activeTab === 'users') fetchUsers();
                if (activeTab === 'releases') fetchReleases();
                if (activeTab === 'hunts') fetchHunts();
                if (activeTab === 'settings') fetchSettings();
                showToast('Dados atualizados!');
              }}
              style={{
                background: '#161626', border: '1px solid #28283e', color: '#fff',
                padding: '9px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer'
              }}
            >
              🔄 Atualizar Dados
            </button>
          </div>
        </div>

        {/* TAB 1: OVERVIEW & KPIS */}
        {activeTab === 'overview' && (
          <div>
            {/* KPI Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
              <div style={{ background: '#12121e', border: '1px solid #232338', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '0.8rem', color: '#8888a2', fontWeight: 700, textTransform: 'uppercase' }}>👥 Total de Usuários</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginTop: '6px' }}>{stats?.totalUsers ?? '...'}</div>
                <div style={{ fontSize: '0.78rem', color: '#00e676', marginTop: '4px' }}>🟢 {stats?.activeVipUsers ?? 0} com VIP Ativo</div>
              </div>

              <div style={{ background: '#12121e', border: '1px solid #232338', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '0.8rem', color: '#8888a2', fontWeight: 700, textTransform: 'uppercase' }}>⚡ Total de Caçadas (Hunts)</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#00b0ff', marginTop: '6px' }}>{stats?.totalHunts ?? '...'}</div>
                <div style={{ fontSize: '0.78rem', color: '#8888a2', marginTop: '4px' }}>Gravadas no PostgreSQL</div>
              </div>

              <div style={{ background: '#12121e', border: '1px solid #232338', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '0.8rem', color: '#8888a2', fontWeight: 700, textTransform: 'uppercase' }}>💥 Dano Total Rastreado</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ff5252', marginTop: '6px' }}>
                  {stats ? Number(stats.totalDamageDealt).toLocaleString('pt-BR') : '...'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#ffd600', marginTop: '4px' }}>🔥 Max Hit Global: {stats?.globalMaxHit ?? 0}</div>
              </div>

              <div style={{ background: '#12121e', border: '1px solid #232338', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '0.8rem', color: '#8888a2', fontWeight: 700, textTransform: 'uppercase' }}>🧬 XP Total Acumulado</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#d500f9', marginTop: '6px' }}>
                  {stats ? Number(stats.totalXpTracked).toLocaleString('pt-BR') : '...'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#8888a2', marginTop: '4px' }}>🐀 {stats ? Number(stats.totalKills).toLocaleString('pt-BR') : 0} Monstros Derrotados</div>
              </div>
            </div>

            {/* Quick Overview Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ background: '#12121e', border: '1px solid #232338', borderRadius: '14px', padding: '24px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px', color: '#00e676' }}>🚀 Últimos Lançamentos da Extensão</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {stats?.latestReleases?.map((rel) => (
                    <div key={rel.version} style={{ background: '#0b0b14', border: '1px solid #232338', padding: '12px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 800, color: '#00e676', marginRight: '8px' }}>v{rel.version}</span>
                        <span style={{ fontWeight: 600 }}>{rel.title}</span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: '#8888a2' }}>{new Date(rel.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: '#12121e', border: '1px solid #232338', borderRadius: '14px', padding: '24px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px', color: '#00b0ff' }}>🌐 Status das Conexões dos Serviços</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #202032' }}>
                    <span style={{ color: '#8888a2' }}>PostgreSQL VPS</span>
                    <span style={{ color: '#00e676', fontWeight: 700 }}>🟢 Online (Porta 4264)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #202032' }}>
                    <span style={{ color: '#8888a2' }}>Auth Server Domain</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>authtibia.klyraai.com.br</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #202032' }}>
                    <span style={{ color: '#8888a2' }}>Website Hub Domain</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>tibiaonline.dialogy.klyraai.com.br</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8888a2' }}>Target Game Domain</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>stonegy-online.com</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USER MANAGEMENT */}
        {activeTab === 'users' && (
          <UserManagementTab users={users} onRefresh={() => fetchUsers()} apiAdmin={apiAdmin} showToast={showToast} />
        )}

        {/* TAB 3: RELEASES & AUTO-UPDATER */}
        {activeTab === 'releases' && (
          <ReleasesTab releases={releases} onRefresh={() => fetchReleases()} apiAdmin={apiAdmin} showToast={showToast} />
        )}

        {/* TAB 4: HUNTS & AUDIT */}
        {activeTab === 'hunts' && (
          <HuntsTab hunts={hunts} onRefresh={() => fetchHunts()} apiAdmin={apiAdmin} showToast={showToast} />
        )}

        {/* TAB 5: GLOBAL SETTINGS */}
        {activeTab === 'settings' && (
          <SettingsTab settings={settings} onRefresh={() => fetchSettings()} apiAdmin={apiAdmin} showToast={showToast} />
        )}

      </main>
    </div>
  );
}

// =========================================================================
// SUB-COMPONENT: USER MANAGEMENT TAB
// =========================================================================
function UserManagementTab({ users, onRefresh, apiAdmin, showToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPlan, setNewPlan] = useState('VIP PRO');
  const [newRole, setNewRole] = useState('USER');
  const [newDays, setNewDays] = useState(30);

  async function handleCreateUser(e) {
    e.preventDefault();
    try {
      const res = await apiAdmin('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          plan: newPlan,
          role: newRole,
          vipDays: newDays
        })
      });
      if (res.success) {
        showToast('Usuário criado com sucesso!');
        setShowCreateModal(false);
        setNewUsername('');
        setNewPassword('');
        onRefresh();
      } else {
        showToast(res.message || 'Erro ao criar usuário', 'error');
      }
    } catch (e) {
      showToast('Erro de rede', 'error');
    }
  }

  async function handleUserAction(id, action, value) {
    try {
      const res = await apiAdmin('/api/admin/users', {
        method: 'PUT',
        body: JSON.stringify({ id, action, value })
      });
      if (res.success) {
        showToast(res.message);
        onRefresh();
      } else {
        showToast(res.message, 'error');
      }
    } catch (e) {
      showToast('Erro ao atualizar usuário', 'error');
    }
  }

  async function handleDeleteUser(id, username) {
    if (!confirm(`Tem certeza que deseja EXCLUIR o usuário "${username}"? Todas as hunts e sessões dele serão apagadas.`)) return;
    try {
      const res = await apiAdmin(`/api/admin/users?id=${id}`, { method: 'DELETE' });
      if (res.success) {
        showToast('Usuário excluído!');
        onRefresh();
      } else {
        showToast(res.message, 'error');
      }
    } catch (e) {
      showToast('Erro ao excluir usuário', 'error');
    }
  }

  const filtered = users.filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      {/* Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', gap: '14px' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="🔍 Buscar usuário por nome..."
          style={{
            flex: 1, maxWidth: '400px', background: '#12121e', border: '1px solid #232338',
            borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '0.9rem', outline: 'none'
          }}
        />
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            background: 'var(--accent)', color: '#09090f', border: 'none',
            padding: '10px 18px', borderRadius: '8px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer'
          }}
        >
          ➕ Criar Novo Usuário
        </button>
      </div>

      {/* Users Table */}
      <div style={{ background: '#12121e', border: '1px solid #232338', borderRadius: '14px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: '#181827', borderBottom: '1px solid #232338', color: '#8888a2', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 800 }}>
              <th style={{ padding: '12px 16px' }}>ID</th>
              <th style={{ padding: '12px 16px' }}>Usuário</th>
              <th style={{ padding: '12px 16px' }}>Cargo / Role</th>
              <th style={{ padding: '12px 16px' }}>Plano</th>
              <th style={{ padding: '12px 16px' }}>Expiração VIP</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Último Acesso</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações Rápidas</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: '#888' }}>Nenhum usuário encontrado.</td></tr>
            ) : (
              filtered.map(u => {
                const isVipActive = u.is_active && new Date(u.expires_at) > new Date();
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #1a1a2b' }}>
                    <td style={{ padding: '12px 16px', color: '#888' }}>#{u.id}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#fff' }}>
                      {u.username} {u.is_admin && <span style={{ color: '#00e676', fontSize: '10px' }}>👑 [ADMIN]</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: u.role === 'ADMIN' ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.05)',
                        color: u.role === 'ADMIN' ? '#00e676' : '#aaa',
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700
                      }}>
                        {u.role || 'USER'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#00b0ff', fontWeight: 600 }}>{u.plan}</td>
                    <td style={{ padding: '12px 16px', color: isVipActive ? '#00e676' : '#ff5252', fontWeight: 600 }}>
                      {new Date(u.expires_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: u.is_active ? 'rgba(0,230,118,0.15)' : 'rgba(255,82,82,0.15)',
                        color: u.is_active ? '#00e676' : '#ff5252',
                        padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700
                      }}>
                        {u.is_active ? 'Ativo' : 'Bloqueado'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#888', fontSize: '0.8rem' }}>
                      {u.last_login ? new Date(u.last_login).toLocaleString('pt-BR') : 'Nunca'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleUserAction(u.id, 'add_days', 30)}
                          title="Adicionar +30 Dias VIP"
                          style={{ background: '#1c1c2c', border: '1px solid #2e2e44', color: '#00e676', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          +30d VIP
                        </button>
                        <button
                          onClick={() => handleUserAction(u.id, 'toggle_active')}
                          title={u.is_active ? 'Bloquear Usuário' : 'Ativar Usuário'}
                          style={{ background: '#1c1c2c', border: '1px solid #2e2e44', color: u.is_active ? '#ffd600' : '#00e676', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          {u.is_active ? 'Bloquear' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => {
                            const newPass = prompt(`Digite a nova senha para ${u.username}:`);
                            if (newPass) handleUserAction(u.id, 'reset_password', newPass);
                          }}
                          title="Resetar Senha"
                          style={{ background: '#1c1c2c', border: '1px solid #2e2e44', color: '#00b0ff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          🔑 Senha
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.username)}
                          title="Excluir Usuário"
                          style={{ background: '#1c1c2c', border: '1px solid #ff5252', color: '#ff5252', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Criar Usuário */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#141422', border: '1px solid #282840', borderRadius: '14px', width: '380px', padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>Criar Novo Usuário</h3>
            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', fontWeight: 700, marginBottom: '4px' }}>NOME DE USUÁRIO</label>
                <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} required style={{ width: '100%', background: '#0b0b14', border: '1px solid #242438', padding: '10px', borderRadius: '6px', color: '#fff' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', fontWeight: 700, marginBottom: '4px' }}>SENHA</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={{ width: '100%', background: '#0b0b14', border: '1px solid #242438', padding: '10px', borderRadius: '6px', color: '#fff' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', fontWeight: 700, marginBottom: '4px' }}>CARGO</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ width: '100%', background: '#0b0b14', border: '1px solid #242438', padding: '10px', borderRadius: '6px', color: '#fff' }}>
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', fontWeight: 700, marginBottom: '4px' }}>DIAS VIP</label>
                  <input type="number" value={newDays} onChange={e => setNewDays(e.target.value)} style={{ width: '100%', background: '#0b0b14', border: '1px solid #242438', padding: '10px', borderRadius: '6px', color: '#fff' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ flex: 1, background: '#222238', border: 'none', padding: '10px', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Cancelar</button>
                <button type="submit" style={{ flex: 1, background: '#00e676', border: 'none', padding: '10px', borderRadius: '6px', color: '#000', cursor: 'pointer', fontWeight: 800 }}>Salvar no Banco</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// SUB-COMPONENT: RELEASES & AUTO-UPDATER TAB
// =========================================================================
function ReleasesTab({ releases, onRefresh, apiAdmin, showToast }) {
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [changelog, setChangelog] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('/download/latest');
  const [forceUpdate, setForceUpdate] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handlePublish(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiAdmin('/api/admin/releases', {
        method: 'POST',
        body: JSON.stringify({ version, title, changelog, downloadUrl, forceUpdate })
      });
      if (res.success) {
        showToast(res.message);
        setVersion('');
        setTitle('');
        setChangelog('');
        onRefresh();
      } else {
        showToast(res.message, 'error');
      }
    } catch (e) {
      showToast('Erro ao publicar versão', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteRelease(id, ver) {
    if (!confirm(`Remover versão ${ver}?`)) return;
    try {
      const res = await apiAdmin(`/api/admin/releases?id=${id}`, { method: 'DELETE' });
      if (res.success) {
        showToast('Versão removida!');
        onRefresh();
      }
    } catch (e) {}
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
      {/* Form */}
      <div style={{ background: '#12121e', border: '1px solid #232338', borderRadius: '14px', padding: '24px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '18px', color: 'var(--accent)' }}>
          📢 Publicar Nova Versão para Todas as Extensões
        </h3>

        <form onSubmit={handlePublish}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#888', marginBottom: '4px' }}>VERSÃO</label>
              <input type="text" value={version} onChange={e => setVersion(e.target.value)} placeholder="3.5.0" required style={{ width: '100%', background: '#0b0b14', border: '1px solid #242438', padding: '10px', borderRadius: '6px', color: '#fff' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#888', marginBottom: '4px' }}>TÍTULO</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Notificações de Boss e Otimização" required style={{ width: '100%', background: '#0b0b14', border: '1px solid #242438', padding: '10px', borderRadius: '6px', color: '#fff' }} />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#888', marginBottom: '4px' }}>CHANGELOG (NOTAS DE ATUALIZAÇÃO)</label>
            <textarea value={changelog} onChange={e => setChangelog(e.target.value)} placeholder="• Novas métricas de dano&#10;• Correção de som" required style={{ width: '100%', height: '110px', background: '#0b0b14', border: '1px solid #242438', padding: '10px', borderRadius: '6px', color: '#fff', resize: 'vertical' }} />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#888', marginBottom: '4px' }}>LINK DE DOWNLOAD DO ZIP</label>
            <input type="text" value={downloadUrl} onChange={e => setDownloadUrl(e.target.value)} required style={{ width: '100%', background: '#0b0b14', border: '1px solid #242438', padding: '10px', borderRadius: '6px', color: '#fff' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <input type="checkbox" id="chkForceAdmin" checked={forceUpdate} onChange={e => setForceUpdate(e.target.checked)} style={{ cursor: 'pointer' }} />
            <label htmlFor="chkForceAdmin" style={{ fontSize: '0.85rem', cursor: 'pointer', color: forceUpdate ? '#ff5252' : '#fff', fontWeight: forceUpdate ? 800 : 600 }}>
              {forceUpdate ? '⚠️ ATUALIZAÇÃO OBRIGATÓRIA (Extensões antigas serão travadas)' : 'Atualização Opcional (Notifica sem travar)'}
            </label>
          </div>

          <button type="submit" disabled={loading} style={{ width: '100%', background: 'var(--accent)', color: '#09090f', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>
            {loading ? 'Gravando...' : '🚀 Lançar Versão para Jogadores'}
          </button>
        </form>
      </div>

      {/* Release List */}
      <div style={{ background: '#12121e', border: '1px solid #232338', borderRadius: '14px', padding: '24px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '18px', color: '#00b0ff' }}>
          📜 Versões no Banco de Dados
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto' }}>
          {releases.length === 0 ? (
            <div style={{ color: '#888' }}>Nenhuma versão cadastrada.</div>
          ) : (
            releases.map(r => (
              <div key={r.id} style={{ background: '#0b0b14', border: '1px solid #232338', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 800 }}>v{r.version}</span>
                    <span style={{ fontWeight: 700 }}>{r.title}</span>
                    {r.force_update && <span style={{ background: '#ff5252', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '3px' }}>OBRIGATÓRIA</span>}
                  </div>
                  <button onClick={() => handleDeleteRelease(r.id, r.version)} style={{ background: 'transparent', border: 'none', color: '#ff5252', cursor: 'pointer', fontSize: '0.85rem' }}>🗑️</button>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#aaa', whiteSpace: 'pre-line', background: '#07070c', padding: '8px 10px', borderRadius: '6px' }}>{r.changelog}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// SUB-COMPONENT: HUNTS AUDIT TAB
// =========================================================================
function HuntsTab({ hunts, onRefresh, apiAdmin, showToast }) {
  async function handleDeleteHunt(id) {
    if (!confirm('Remover este registro de hunt?')) return;
    try {
      const res = await apiAdmin(`/api/admin/hunts?id=${id}`, { method: 'DELETE' });
      if (res.success) {
        showToast('Hunt removida!');
        onRefresh();
      }
    } catch (e) {}
  }

  async function handleClearAll() {
    if (!confirm('ATENÇÃO: Deseja apagar TODAS as hunts de teste gravadas no banco?')) return;
    try {
      const res = await apiAdmin('/api/admin/hunts?action=clear_all', { method: 'DELETE' });
      if (res.success) {
        showToast('Todas as hunts foram apagadas!');
        onRefresh();
      }
    } catch (e) {}
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '0.9rem', color: '#8888a2' }}>Exibindo os últimos 100 registros de caçadas gravadas no PostgreSQL</div>
        <button onClick={handleClearAll} style={{ background: '#261218', border: '1px solid #ff5252', color: '#ff5252', padding: '6px 12px', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
          🗑️ Limpar Todas as Hunts
        </button>
      </div>

      <div style={{ background: '#12121e', border: '1px solid #232338', borderRadius: '14px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#181827', borderBottom: '1px solid #232338', color: '#8888a2', textTransform: 'uppercase', fontSize: '0.72rem', fontWeight: 800 }}>
              <th style={{ padding: '12px 14px' }}>Usuário</th>
              <th style={{ padding: '12px 14px' }}>Personagem</th>
              <th style={{ padding: '12px 14px' }}>Level</th>
              <th style={{ padding: '12px 14px' }}>Dano Total</th>
              <th style={{ padding: '12px 14px' }}>DPS Médio</th>
              <th style={{ padding: '12px 14px' }}>XP / Hora</th>
              <th style={{ padding: '12px 14px' }}>Lucro</th>
              <th style={{ padding: '12px 14px' }}>Data</th>
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {hunts.length === 0 ? (
              <tr><td colSpan="9" style={{ padding: '24px', textAlign: 'center', color: '#888' }}>Nenhuma hunt registrada no banco.</td></tr>
            ) : (
              hunts.map(h => (
                <tr key={h.id} style={{ borderBottom: '1px solid #1a1a2b' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#fff' }}>{h.username}</td>
                  <td style={{ padding: '12px 14px', color: '#00b0ff' }}>{h.character_name}</td>
                  <td style={{ padding: '12px 14px' }}>Lv {h.character_level}</td>
                  <td style={{ padding: '12px 14px', color: '#ff5252', fontWeight: 700 }}>{Number(h.total_damage).toLocaleString('pt-BR')}</td>
                  <td style={{ padding: '12px 14px', color: '#00e676', fontWeight: 700 }}>{Number(h.dps_avg).toLocaleString('pt-BR')}</td>
                  <td style={{ padding: '12px 14px', color: '#d500f9', fontWeight: 700 }}>+{Number(h.xp_hour).toLocaleString('pt-BR')}/h</td>
                  <td style={{ padding: '12px 14px', color: h.balance_profit >= 0 ? '#00e676' : '#ff5252' }}>{Number(h.balance_profit).toLocaleString('pt-BR')} gp</td>
                  <td style={{ padding: '12px 14px', color: '#888', fontSize: '0.8rem' }}>{new Date(h.recorded_at).toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <button onClick={() => handleDeleteHunt(h.id)} style={{ background: 'transparent', border: 'none', color: '#ff5252', cursor: 'pointer' }}>🗑️</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========================================================================
// SUB-COMPONENT: GLOBAL SETTINGS TAB
// =========================================================================
function SettingsTab({ settings, onRefresh, apiAdmin, showToast }) {
  const [formData, setFormData] = useState({
    discord_webhook: settings.discord_webhook || '',
    admin_invite_code: settings.admin_invite_code || 'ADMIN-2026-KEY',
    maintenance_mode: settings.maintenance_mode || 'false',
    allow_public_register: settings.allow_public_register || 'true',
  });

  useEffect(() => {
    setFormData({
      discord_webhook: settings.discord_webhook || '',
      admin_invite_code: settings.admin_invite_code || 'ADMIN-2026-KEY',
      maintenance_mode: settings.maintenance_mode || 'false',
      allow_public_register: settings.allow_public_register || 'true',
    });
  }, [settings]);

  async function handleSaveSettings(e) {
    e.preventDefault();
    try {
      const res = await apiAdmin('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ settings: formData })
      });
      if (res.success) {
        showToast(res.message);
        onRefresh();
      } else {
        showToast(res.message, 'error');
      }
    } catch (e) {
      showToast('Erro ao salvar configurações', 'error');
    }
  }

  return (
    <div style={{ maxWidth: '700px', background: '#12121e', border: '1px solid #232338', borderRadius: '14px', padding: '28px' }}>
      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '20px', color: 'var(--accent)' }}>
        ⚙️ Configurações Globais do Servidor
      </h3>

      <form onSubmit={handleSaveSettings}>
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#888', marginBottom: '6px', textTransform: 'uppercase' }}>
            📢 Discord Webhook de Alertas do Servidor
          </label>
          <input
            type="text"
            value={formData.discord_webhook}
            onChange={e => setFormData({ ...formData, discord_webhook: e.target.value })}
            placeholder="https://discord.com/api/webhooks/..."
            style={{ width: '100%', background: '#0b0b14', border: '1px solid #242438', padding: '11px', borderRadius: '6px', color: '#fff' }}
          />
          <span style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px', display: 'block' }}>
            Notificações quando novos usuários se registram ou quando novas versões são lançadas.
          </span>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#888', marginBottom: '6px', textTransform: 'uppercase' }}>
            🔑 Código Mestre para Novos Administradores (Invite Key)
          </label>
          <input
            type="text"
            value={formData.admin_invite_code}
            onChange={e => setFormData({ ...formData, admin_invite_code: e.target.value })}
            required
            style={{ width: '100%', background: '#0b0b14', border: '1px solid #00b0ff', padding: '11px', borderRadius: '6px', color: '#fff' }}
          />
          <span style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px', display: 'block' }}>
            Apenas quem tiver esse código poderá criar uma conta de administrador.
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', background: '#0b0b14', padding: '16px', borderRadius: '8px', border: '1px solid #202032' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Permitir Registro Público na Extensão</div>
              <div style={{ fontSize: '0.75rem', color: '#888' }}>Jogadores novos podem criar conta VIP diretamente</div>
            </div>
            <input
              type="checkbox"
              checked={formData.allow_public_register === 'true'}
              onChange={e => setFormData({ ...formData, allow_public_register: e.target.checked ? 'true' : 'false' })}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #1a1a2b' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: formData.maintenance_mode === 'true' ? '#ff5252' : '#fff' }}>Modo de Manutenção</div>
              <div style={{ fontSize: '0.75rem', color: '#888' }}>Pausa autenticações temporariamente para reparos</div>
            </div>
            <input
              type="checkbox"
              checked={formData.maintenance_mode === 'true'}
              onChange={e => setFormData({ ...formData, maintenance_mode: e.target.checked ? 'true' : 'false' })}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </div>
        </div>

        <button type="submit" style={{ width: '100%', background: 'var(--accent)', color: '#09090f', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>
          💾 Salvar Configurações no PostgreSQL
        </button>
      </form>
    </div>
  );
}
