import { useContext } from 'react';
import { AppContext } from '../App';
import { 
  Users, 
  Briefcase, 
  TrendingUp,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const STATUS_MAP = {
  active: 'active',
  planning: 'planning',
  discovery: 'discovery',
  archived: 'archived',
};

function getStatusBadge(client) {
  if (!client.projects || client.projects.length === 0) return 'discovery';
  return 'active';
}

export default function Dashboard() {
  const { db } = useContext(AppContext);
  const currency = db.settings?.currency || '₹';

  const clients = db?.clients || [];
  const totalClients = clients.length;
  const activeProjects = clients.reduce((acc, c) => acc + (c.projects || []).length, 0);

  const getAllExpenses = () => {
    let exp = 0, hw = 0, mat = 0;
    clients.forEach(client => {
      (client.projects || []).forEach(section => {
        section.expenses?.forEach(e => exp += Number(e.amount || 0));
        section.hardware?.forEach(e => hw  += Number(e.total || 0));
        section.materials?.forEach(e => mat += Number(e.total || 0));
      });
    });
    return { labor: exp, hardware: hw, materials: mat, total: exp + hw + mat };
  };

  const expenses = getAllExpenses();
  const totalExp = expenses.total;
  const pct = (v) => totalExp > 0 ? Math.round((v / totalExp) * 100) : 0;

  // Donut SVG values (r=44, circumference ≈ 276)
  const C = 2 * Math.PI * 44;
  const matOff  = C - (pct(expenses.materials) / 100) * C;
  const hwOff   = C;
  const labOff  = C;

  const recentClients = [...clients].reverse().slice(0, 4);

  const kpis = [
    {
      label: 'Total Clients',
      value: totalClients,
      icon: <Users size={20} />,
      color: 'rgba(0,32,70,0.08)',
      iconColor: '#1B365D',
      trend: `${totalClients > 0 ? '+' : ''}${totalClients} this cycle`,
      trendUp: true,
    },
    {
      label: 'Active Projects',
      value: activeProjects,
      icon: <Briefcase size={20} />,
      color: 'rgba(203,231,245,0.6)',
      iconColor: '#48626E',
      trend: `${activeProjects} section${activeProjects !== 1 ? 's' : ''} tracked`,
      trendUp: null,
    },
    {
      label: 'Monthly Expenses',
      value: `${currency}${totalExp.toLocaleString('en-IN')}`,
      icon: <TrendingUp size={20} />,
      iconColor: '#ffffff',
      isPrimary: true,
      info: 'On track with budget',
    },
  ];

  const hslAvatar = (i) => ({
    background: `hsl(${[210, 180, 30, 270][i % 4]}, 55%, 90%)`,
    color:       `hsl(${[210, 180, 30, 270][i % 4]}, 55%, 35%)`,
  });

  return (
    <div className="dashboard-page fade-in">
      {/* KPI Strip */}
      <section className="stats-grid">
        {kpis.map((k, i) => (
          <motion.div
            key={i}
            className={`stat-card${k.isPrimary ? ' primary-card' : ''}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <div className="stat-glow" />
            <div className="stat-top">
              <p className="stat-label">{k.label}</p>
              {k.trend && (
                <span className="stat-trend" style={k.trendUp ? { color: '#2e7d32', background: 'rgba(46,125,50,0.08)' } : {}}>
                  {k.trend}
                </span>
              )}
              {k.info && (
                <span className="stat-trend" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--on-primary-container)', background: 'rgba(255,255,255,0.15)' }}>
                  <Info size={12} /> {k.info}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
              <div className="stat-icon" style={{ background: k.color || 'rgba(255,255,255,0.2)', color: k.iconColor || 'white' }}>
                {k.icon}
              </div>
              <h3 className="stat-value">{k.value}</h3>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Main Grid: Expense Chart + Activity */}
      <div className="dashboard-main-grid">
        {/* Expense Breakdown */}
        <section className="analytics-card">
          <div className="card-header">
            <div>
              <h3>Expense Breakdown</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Resource allocation for current cycle
              </p>
            </div>
            <div className="chart-toggles">
              <button className="active">Monthly</button>
              <button>Quarterly</button>
            </div>
          </div>

          <div className="expense-chart-row">
            {/* Mini Donut */}
            <div className="donut-mini">
              <svg viewBox="0 0 100 100">
                {/* Background ring */}
                <circle cx="50" cy="50" r="44" fill="none" stroke="var(--surface-container-high)" strokeWidth="12" />
                {/* Materials slice */}
                <circle cx="50" cy="50" r="44" fill="none"
                  stroke="var(--primary-container)"
                  strokeWidth="12"
                  strokeDasharray={`${(pct(expenses.materials) / 100) * C} ${C}`}
                  strokeLinecap="round"
                />
                {/* Hardware slice */}
                <circle cx="50" cy="50" r="44" fill="none"
                  stroke="var(--on-primary-container)"
                  strokeWidth="12"
                  strokeDasharray={`${(pct(expenses.hardware) / 100) * C} ${C}`}
                  strokeDashoffset={-1 * (pct(expenses.materials) / 100) * C}
                  strokeLinecap="round"
                />
              </svg>
              <div className="donut-center">
                <span className="amount">
                  {currency}{totalExp >= 1000 ? `${(totalExp / 1000).toFixed(1)}k` : totalExp}
                </span>
                <span className="label">Total</span>
              </div>
            </div>

            {/* Progress bars */}
            <div className="expense-bars" style={{ flex: 1 }}>
              {[
                { label: 'Materials', value: expenses.materials, cls: 'c1' },
                { label: 'Labour',    value: expenses.labor,     cls: 'c2' },
                { label: 'Hardware',  value: expenses.hardware,  cls: 'c3' },
              ].map((row, i) => (
                <motion.div 
                  key={i} 
                  className="exp-bar-row"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                >
                  <div className="exp-bar-header">
                    <span className="exp-bar-label">{row.label}</span>
                    <span className="exp-bar-value">
                      {currency}{row.value.toLocaleString('en-IN')} ({pct(row.value)}%)
                    </span>
                  </div>
                  <div className="exp-bar-track">
                    <motion.div 
                      className={`exp-bar-fill ${row.cls}`} 
                      initial={{ width: 0 }}
                      animate={{ width: `${pct(row.value)}%` }}
                      transition={{ duration: 1, ease: "easeOut", delay: 0.5 + i * 0.1 }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Recent Activity Timeline */}
        <section className="activity-panel">
          <h3>Recent Activity</h3>
          {db.clients.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
              No activity yet. Add your first client.
            </p>
          ) : (
            <div className="timeline">
              {recentClients.map((c, i) => (
                <motion.div 
                  key={c.id} 
                  className="timeline-item"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <div className={`timeline-dot ${['gold', 'blue', 'gold', 'gray'][i % 4]}`} />
                  <div className="timeline-body">
                    <span className="timeline-time">Project</span>
                    <span className="timeline-title">{c.projectName || c.name}</span>
                    <span className="timeline-sub">{c.name} · {c.projects?.length || 0} sections</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          <button className="view-all-link">
            VIEW ALL ACTIVITY <ChevronRight size={14} />
          </button>
        </section>
      </div>

      {/* Recent Clients */}
      <section className="recent-clients-section">
        <div className="section-row-header">
          <h3>Recent Clients</h3>
          <Link to="/clients" className="manage-link">Manage All Clients</Link>
        </div>

        <div className="clients-table-wrap">
          {db.clients.length === 0 ? (
            <div className="empty-activity">No clients yet. Add your first project.</div>
          ) : (
            <table className="clients-table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Sections</th>
                </tr>
              </thead>
              <tbody>
                {recentClients.map((c, i) => {
                  const badge = getStatusBadge(c);
                  return (
                    <motion.tr 
                      key={c.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 + i * 0.05 }}
                    >
                      <td>
                        <div className="client-name-cell">
                          <div className="client-avatar-initials" style={hslAvatar(i)}>
                            {c.name?.[0] || '?'}
                          </div>
                          <div className="client-name-info">
                            <div className="name">{c.name}</div>
                            <div className="email">{c.phone || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="project-cell">
                          <div className="proj-name">{c.projectName}</div>
                          <div className="proj-phase">{c.address || 'No address'}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge-pill ${badge}`}>
                          {badge.charAt(0).toUpperCase() + badge.slice(1)}
                        </span>
                      </td>
                      <td className="budget-cell">{c.projects?.length || 0} sections</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
