import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Button, Input, Dropdown } from '../ui/index.js';
import { RotateCw, Search, Filter } from 'lucide-react';

interface AdminMetrics {
  totalUsers: number;
  verifiedUsers: number;
  phoneUsers: number;
  emailUsers: number;
  activeSockets: number;
  activeOnlineUsers: number;
  activeTables: number;
  totalMatches: number;
  totalChips: number;
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  role: 'USER' | 'ADMIN';
  isVerified: boolean;
  chips: number;
  createdAt: string;
}

interface AdminTable {
  roomId: string;
  playerCount: number;
  status: string;
}

interface AnalyticsEventItem {
  id: string;
  eventType: string;
  metadata: string | null;
  createdAt: string;
}

interface AdminDashboardProps {
  onExit: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onExit }) => {
  const { token, user } = useAuth();

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tables, setTables] = useState<AdminTable[]>([]);
  const [recentEvents, setRecentEvents] = useState<AnalyticsEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const fetchAdminData = useCallback(async () => {
    if (!token) return;

    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [metricsRes, usersRes, tablesRes] = await Promise.all([
        fetch('/api/admin/metrics', { headers }),
        fetch('/api/admin/users?limit=25', { headers }),
        fetch('/api/admin/tables', { headers })
      ]);

      if (!metricsRes.ok || !usersRes.ok || !tablesRes.ok) {
        if (metricsRes.status === 403 || usersRes.status === 403) {
          setError('Access Denied: Administrator role required to view this portal.');
        } else {
          setError('Failed to fetch platform metrics from the server.');
        }
        setIsLoading(false);
        return;
      }

      const metricsData = await metricsRes.json();
      const usersData = await usersRes.json();
      const tablesData = await tablesRes.json();

      setMetrics(metricsData.metrics);
      if (metricsData.recentEvents) {
        setRecentEvents(metricsData.recentEvents);
      }
      setUsers(usersData.users || []);
      setTables(tablesData.tables || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message || 'Network error fetching admin data');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchAdminData, 8000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAdminData]);

  return (
    <div className="admin-container">
      {/* Top Header */}
      <header className="admin-header">
        <div className="admin-header-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>👑</span>
            <div>
              <h1 className="admin-title">Platform Command & Analytics</h1>
              <p className="admin-subtitle">
                Real-time operational intelligence, user registry & live table monitor
              </p>
            </div>
          </div>
        </div>

        <div className="admin-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label className="auto-refresh-toggle" style={{ margin: 0 }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto-refresh (8s)</span>
          </label>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchAdminData}
            leftIcon={<RotateCw size={14} />}
            title="Refresh metrics immediately"
          >
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onExit}
          >
            ← Back to Table
          </Button>
        </div>
      </header>

      {error ? (
        <div className="admin-error-card">
          <span style={{ fontSize: '2rem' }}>🚫</span>
          <div>
            <h3>Administrative Access Restricted</h3>
            <p>{error}</p>
            <p style={{ marginTop: '6px', fontSize: '0.85rem', color: '#94a3b8' }}>
              Logged in as: <strong>{user?.username}</strong> ({user?.role || 'USER'})
            </p>
            <Button
              variant="gold"
              size="md"
              style={{ marginTop: '12px', maxWidth: '200px' }}
              onClick={onExit}
            >
              Return to Game
            </Button>
          </div>
        </div>
      ) : isLoading && !metrics ? (
        <div className="admin-loading-indicator">
          <div className="loading-spinner" />
          <p>Compiling platform metrics...</p>
        </div>
      ) : (
        <div className="admin-content-grid">
          {/* KPI Cards Row */}
          <div className="admin-kpi-row">
            <div className="kpi-card">
              <span className="kpi-label">Total Registered Users</span>
              <span className="kpi-value">{metrics?.totalUsers ?? 0}</span>
              <span className="kpi-subtext">
                ✓ {metrics?.verifiedUsers ?? 0} verified accounts
              </span>
            </div>

            <div className="kpi-card highlight">
              <span className="kpi-label">Active Online Players</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="live-status-dot" />
                <span className="kpi-value">{metrics?.activeOnlineUsers ?? 0}</span>
              </div>
              <span className="kpi-subtext">
                {metrics?.activeSockets ?? 0} open WebSocket sockets
              </span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">Live Active Tables</span>
              <span className="kpi-value">{metrics?.activeTables ?? 0}</span>
              <span className="kpi-subtext">Ongoing multi-player matches</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">Total Matches Completed</span>
              <span className="kpi-value">{metrics?.totalMatches ?? 0}</span>
              <span className="kpi-subtext">Points Rummy 13-Card format</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">Chips in Circulation</span>
              <span className="kpi-value">
                {(metrics?.totalChips ?? 0).toLocaleString()}
              </span>
              <span className="kpi-subtext">Total wallet liquidity</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">Channel Distribution</span>
              <span className="kpi-value" style={{ fontSize: '1.25rem' }}>
                📧 {metrics?.emailUsers ?? 0} | 📱 {metrics?.phoneUsers ?? 0}
              </span>
              <span className="kpi-subtext">Email vs Phone registrations</span>
            </div>
          </div>

          {/* Middle Row: Active Tables & Analytics Events */}
          <div className="admin-split-grid">
            {/* Active Tables List */}
            <div className="admin-panel-card">
              <div className="panel-header">
                <h3>Live Active Tables</h3>
                <span className="badge-count">{tables.length}</span>
              </div>

              {tables.length === 0 ? (
                <div className="empty-panel-notice">
                  <span>🂠</span>
                  <p>No active matches running currently. Create or join a room from the lobby.</p>
                </div>
              ) : (
                <div className="table-cards-list">
                  {tables.map((t) => (
                    <div key={t.roomId} className="table-status-item">
                      <div>
                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                          Room: {t.roomId.slice(0, 16)}...
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Status: {t.status}
                        </div>
                      </div>
                      <div className="player-count-chip">
                        👥 {t.playerCount} Players
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Telemetry Stream */}
            <div className="admin-panel-card">
              <div className="panel-header">
                <h3>Platform Telemetry & Audit Stream</h3>
                <span className="badge-count">{recentEvents.length}</span>
              </div>

              {recentEvents.length === 0 ? (
                <div className="empty-panel-notice">
                  <span>📊</span>
                  <p>Telemetry events will appear here as players register, login, and play.</p>
                </div>
              ) : (
                <div className="telemetry-list">
                  {recentEvents.map((evt) => (
                    <div key={evt.id} className="telemetry-item">
                      <div className="telemetry-type">{evt.eventType}</div>
                      <div className="telemetry-meta">
                        {evt.metadata ? evt.metadata.slice(0, 45) : '—'}
                      </div>
                      <div className="telemetry-time">
                        {new Date(evt.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row: User Registry Audit Table */}
          {(() => {
            const filteredUsers = users.filter((u) => {
              const matchesSearch =
                u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (u.phone && u.phone.includes(searchQuery));
              const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
              return matchesSearch && matchesRole;
            });

            return (
              <div className="admin-panel-card full-width">
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3>Registered User Registry</h3>
                    <span className="badge-count">{filteredUsers.length}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ width: '220px' }}>
                      <Input
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        leftIcon={<Search size={15} />}
                        style={{ padding: '8px 12px 8px 36px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div style={{ width: '130px' }}>
                      <Dropdown
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        options={[
                          { value: 'ALL', label: 'All Roles' },
                          { value: 'USER', label: 'Users' },
                          { value: 'ADMIN', label: 'Admins' }
                        ]}
                        style={{ padding: '8px 24px 8px 10px', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                </div>

                <div className="table-responsive-wrapper">
                  <table className="admin-data-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Identifier (Email / Phone)</th>
                        <th>Role</th>
                        <th>Verified</th>
                        <th>Wallet Balance</th>
                        <th>Registered At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 600, color: '#f8fafc' }}>
                            {u.username}
                          </td>
                          <td style={{ color: '#94a3b8' }}>
                            {u.phone ? `📱 ${u.phone}` : `📧 ${u.email}`}
                          </td>
                          <td>
                            <span className={`role-badge ${u.role.toLowerCase()}`}>
                              {u.role}
                            </span>
                          </td>
                          <td>
                            {u.isVerified ? (
                              <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Verified</span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Pending</span>
                            )}
                          </td>
                          <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#d4af37' }}>
                            {u.chips.toLocaleString()}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            {new Date(u.createdAt).toLocaleDateString()} {new Date(u.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
