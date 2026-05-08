import { useContext, useState, useMemo } from 'react';
import { AppContext } from '../App';
import { Link } from 'react-router-dom';
import {
  FileText,
  Download,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Receipt,
  Hammer,
  Layers,
  ChevronDown,
  ChevronRight,
  Filter,
  Calendar,
  BarChart3,
  PieChart as PieIcon,
  ArrowUpRight,
  Users,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from '../utils/supabase';

// --- SVG Donut Chart Component ---
function DonutChart({ segments, size = 180, strokeWidth = 28 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} opacity={0.4} />
        <text x={center} y={center - 6} textAnchor="middle" fill="var(--text-muted)" fontSize="13" fontWeight="700">No Data</text>
        <text x={center} y={center + 14} textAnchor="middle" fill="var(--text-muted)" fontSize="11">Add entries first</text>
      </svg>
    );
  }

  let cumulativePercent = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const percent = seg.value / total;
        const dashArray = `${circumference * percent} ${circumference * (1 - percent)}`;
        const dashOffset = -circumference * cumulativePercent;
        cumulativePercent += percent;
        return (
          <circle
            key={i}
            cx={center} cy={center} r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            style={{ transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        );
      })}
      <text x={center} y={center - 8} textAnchor="middle" fill="var(--text-main)" fontSize="20" fontWeight="800" fontFamily="Outfit, sans-serif">
        {((segments[0]?.value / total) * 100 || 0).toFixed(0)}%
      </text>
      <text x={center} y={center + 12} textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontWeight="700" style={{ textTransform: 'uppercase' }}>
        Largest Share
      </text>
    </svg>
  );
}

// --- Horizontal Bar Component ---
function HorizontalBar({ label, value, maxValue, color, currency }) {
  const percent = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="h-bar-item">
      <div className="h-bar-header">
        <span className="h-bar-label">{label}</span>
        <span className="h-bar-value" style={{ color }}>{currency}{value.toLocaleString()}</span>
      </div>
      <div className="h-bar-track">
        <motion.div
          className="h-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

export default function Reports() {
  const { db, setDb, session } = useContext(AppContext);
  const [view, setView] = useState('overview'); // overview, client-detail
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [expandedClients, setExpandedClients] = useState({});

  const currency = db?.settings?.currency || '₹';

  // --- ANALYTICS ENGINE ---
  const analytics = useMemo(() => {
    const clients = db?.clients || [];
    let totalExpenses = 0, totalHardware = 0, totalMaterials = 0, totalSections = 0;
    const clientData = [];

    clients.forEach(client => {
      let cExpenses = 0, cHardware = 0, cMaterials = 0;
      const sections = [];

      (client.projects || []).forEach(section => {
        const sExp = (section.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
        const sHw = (section.hardware || []).reduce((s, e) => s + Number(e.total || 0), 0);
        const sMat = (section.materials || []).reduce((s, e) => s + Number(e.total || 0), 0);

        cExpenses += sExp;
        cHardware += sHw;
        cMaterials += sMat;
        totalSections++;

        sections.push({
          id: section.id,
          name: section.name,
          expenses: sExp,
          hardware: sHw,
          materials: sMat,
          total: sExp + sHw + sMat,
          entryCount: (section.expenses || []).length + (section.hardware || []).length + (section.materials || []).length
        });
      });

      totalExpenses += cExpenses;
      totalHardware += cHardware;
      totalMaterials += cMaterials;

      clientData.push({
        id: client.id,
        name: client.name,
        projectName: client.projectName,
        phone: client.phone,
        expenses: cExpenses,
        hardware: cHardware,
        materials: cMaterials,
        total: cExpenses + cHardware + cMaterials,
        sections,
        sectionCount: (client.projects || []).length,
        createdAt: client.createdAt
      });
    });

    const grandTotal = totalExpenses + totalHardware + totalMaterials;

    // Sort clients by total spend descending
    clientData.sort((a, b) => b.total - a.total);

    return {
      totalExpenses,
      totalHardware,
      totalMaterials,
      grandTotal,
      totalClients: (db?.clients || []).length,
      totalSections,
      clientData,
      categories: [
        { label: 'Labor & Expenses', value: totalExpenses, color: '#f59e0b', icon: <Receipt size={18} /> },
        { label: 'Hardware', value: totalHardware, color: '#3b82f6', icon: <Hammer size={18} /> },
        { label: 'Materials', value: totalMaterials, color: '#10b981', icon: <Layers size={18} /> },
      ]
    };
  }, [db]);

  const toggleClient = (id) => {
    setExpandedClients(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // --- EXPORT: Full Summary PDF ---
  const exportSummaryPDF = async () => {
    try {
      const doc = new jsPDF();
      const primaryColor = [0, 32, 70];
      
      // --- HEADER SECTION ---
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setFontSize(28);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text("FINE SPACE", 14, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text("INTERIOR DESIGN & MANAGEMENT SOLUTIONS", 14, 32);
      
      doc.setFontSize(18);
      doc.text("FINANCIAL REPORT", 196, 25, { align: 'right' });
      
      // --- SUMMARY KPI BOXES ---
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("EXECUTIVE SUMMARY", 14, 55);
      
      doc.setDrawColor(229, 231, 235);
      doc.line(14, 58, 196, 58);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Clients: ${analytics.totalClients}`, 14, 66);
      doc.text(`Total Projects: ${analytics.totalSections}`, 14, 72);
      
      doc.setFont('helvetica', 'bold');
      doc.text("CATEGORY TOTALS:", 140, 66);
      doc.setFont('helvetica', 'normal');
      doc.text(`Expenses: ${currency}${analytics.totalExpenses.toLocaleString()}`, 140, 72);
      doc.text(`Hardware: ${currency}${analytics.totalHardware.toLocaleString()}`, 140, 78);
      doc.text(`Materials: ${currency}${analytics.totalMaterials.toLocaleString()}`, 140, 84);
      
      doc.setFontSize(14);
      doc.setTextColor(...primaryColor);
      doc.setFont('helvetica', 'bold');
      doc.text(`GRAND TOTAL: ${currency}${analytics.grandTotal.toLocaleString()}`, 14, 84);

      // --- CLIENT TABLE ---
      const tableBody = analytics.clientData.map((c, i) => [
        i + 1,
        c.name,
        c.projectName,
        c.sectionCount,
        `${currency}${c.expenses.toLocaleString()}`,
        `${currency}${c.hardware.toLocaleString()}`,
        `${currency}${c.materials.toLocaleString()}`,
        `${currency}${c.total.toLocaleString()}`
      ]);

      autoTable(doc, {
        startY: 95,
        head: [['#', 'Client', 'Project', 'Sections', 'Exp.', 'Hard.', 'Mat.', 'Total']],
        body: tableBody,
        theme: 'grid',
        headStyles: { 
          fillColor: primaryColor, 
          textColor: [255, 255, 255],
          fontSize: 9, 
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right', fontStyle: 'bold' }
        },
        styles: { 
          cellPadding: 3, 
          fontSize: 8,
          lineColor: [229, 231, 235]
        },
        alternateRowStyles: { fillColor: [252, 253, 255] }
      });

      // --- FOOTER ---
      const pageCount = doc.internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text(`Report Generated on: ${new Date().toLocaleDateString()}`, 14, 285);
        doc.text(`Page ${i} of ${pageCount}`, 196, 285, { align: 'right' });
        
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(0.5);
        doc.line(14, 280, 196, 280);
      }

      const fileName = `FS_Financial_Report_${new Date().toISOString().split('T')[0]}.pdf`.replace(/[^a-z0-9.]/gi, '_');
      doc.save(fileName);

      // Save to Cloud History
      try {
        const blob = doc.output('blob');
        const path = `${session.user.id}/reports/${Date.now()}_${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('finespace_docs')
          .upload(path, blob);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('finespace_docs')
            .getPublicUrl(path);

          setDb(prev => ({
            ...prev,
            documents: [
              {
                id: Date.now().toString(),
                name: fileName,
                url: publicUrl,
                createdAt: new Date().toISOString(),
                type: 'report'
              },
              ... (prev.documents || [])
            ]
          }));
        }
      } catch (uploadErr) {
        console.error("Cloud report save failed:", uploadErr);
      }
    } catch (err) {
      console.error("Financial Report PDF Export failed:", err);
      alert("Failed to generate Financial Report. Check console for details.");
    }
  };

  // --- EXPORT: Full Summary Excel ---
  const exportSummaryExcel = () => {
    const summaryData = analytics.clientData.map(c => ({
      'Client Name': c.name,
      'Project': c.projectName,
      'Sections': c.sectionCount,
      'Labor & Expenses': c.expenses,
      'Hardware': c.hardware,
      'Materials': c.materials,
      'Grand Total': c.total,
      'Created': new Date(c.createdAt).toLocaleDateString()
    }));

    // Add totals row
    summaryData.push({
      'Client Name': '',
      'Project': '',
      'Sections': 'TOTAL',
      'Labor & Expenses': analytics.totalExpenses,
      'Hardware': analytics.totalHardware,
      'Materials': analytics.totalMaterials,
      'Grand Total': analytics.grandTotal,
      'Created': ''
    });

    const ws = XLSX.utils.json_to_sheet(summaryData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Financial Summary');

    // Add detail sheets per client if they have data
    analytics.clientData.forEach(client => {
      if (client.sections.length > 0) {
        const detailData = client.sections.map(s => ({
          'Section': s.name,
          'Entries': s.entryCount,
          'Expenses': s.expenses,
          'Hardware': s.hardware,
          'Materials': s.materials,
          'Section Total': s.total
        }));
        const ws2 = XLSX.utils.json_to_sheet(detailData);
        XLSX.utils.book_append_sheet(wb, ws2, client.name.substring(0, 28));
      }
    });

    XLSX.writeFile(wb, `FS_Financial_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const maxClientTotal = Math.max(...analytics.clientData.map(c => c.total), 1);

  return (
    <div className="reports-page fade-in">
      <header className="content-header">
        <div>
          <h2>Financial Intelligence</h2>
          <p>Comprehensive project spending analytics and export center.</p>
        </div>
        <div className="header-actions">
          <button onClick={exportSummaryExcel} className="export-action-btn">
            <FileText size={18} />
            <span>Excel</span>
          </button>
          <button onClick={exportSummaryPDF} className="export-action-btn primary">
            <Download size={18} />
            <span>Export PDF Report</span>
          </button>
        </div>
      </header>

      {/* KPI Summary Cards */}
      <div className="report-kpi-strip">
        <motion.div className="kpi-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <div className="kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}><TrendingUp size={22} /></div>
          <div className="kpi-info">
            <span className="kpi-value">{currency}{analytics.grandTotal.toLocaleString()}</span>
            <span className="kpi-label">Total Capital Deployed</span>
          </div>
        </motion.div>
        <motion.div className="kpi-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><Receipt size={22} /></div>
          <div className="kpi-info">
            <span className="kpi-value">{currency}{analytics.totalExpenses.toLocaleString()}</span>
            <span className="kpi-label">Labor & Expenses</span>
          </div>
        </motion.div>
        <motion.div className="kpi-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}><Hammer size={22} /></div>
          <div className="kpi-info">
            <span className="kpi-value">{currency}{analytics.totalHardware.toLocaleString()}</span>
            <span className="kpi-label">Hardware Total</span>
          </div>
        </motion.div>
        <motion.div className="kpi-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><Layers size={22} /></div>
          <div className="kpi-info">
            <span className="kpi-value">{currency}{analytics.totalMaterials.toLocaleString()}</span>
            <span className="kpi-label">Materials Total</span>
          </div>
        </motion.div>
      </div>

      {/* Main Analytics Grid */}
      <div className="report-analytics-grid">
        {/* LEFT: Category Breakdown + Client Bars */}
        <div className="report-left-col">
          {/* Category Distribution Card */}
          <section className="report-card card">
            <div className="report-card-header">
              <h3><BarChart3 size={18} /> Spending by Category</h3>
            </div>
            <div className="category-bars-section">
              {analytics.categories.map((cat, i) => (
                <HorizontalBar
                  key={i}
                  label={cat.label}
                  value={cat.value}
                  maxValue={analytics.grandTotal}
                  color={cat.color}
                  currency={currency}
                />
              ))}
            </div>
            <div className="category-percent-row">
              {analytics.categories.map((cat, i) => {
                const pct = analytics.grandTotal > 0 ? ((cat.value / analytics.grandTotal) * 100).toFixed(1) : '0.0';
                return (
                  <div key={i} className="cat-percent-chip" style={{ borderColor: cat.color }}>
                    <span className="cat-dot" style={{ background: cat.color }} />
                    <span className="cat-pct">{pct}%</span>
                    <span className="cat-name">{cat.label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Client Ranking */}
          <section className="report-card card">
            <div className="report-card-header">
              <h3><Users size={18} /> Client-wise Spend Ranking</h3>
              <span className="badge-count">{analytics.totalClients} clients</span>
            </div>
            <div className="client-rank-list">
              {analytics.clientData.map((client, i) => (
                <HorizontalBar
                  key={client.id}
                  label={`${client.name} — ${client.projectName}`}
                  value={client.total}
                  maxValue={maxClientTotal}
                  color={['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 6]}
                  currency={currency}
                />
              ))}
              {analytics.clientData.length === 0 && (
                <div className="empty-report-msg">No clients added yet. Start from the Projects page.</div>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT: Donut + Drill-down Table */}
        <div className="report-right-col">
          {/* Donut Chart */}
          <section className="report-card card donut-card">
            <div className="report-card-header">
              <h3><PieIcon size={18} /> Category Split</h3>
            </div>
            <div className="donut-container">
              <DonutChart
                segments={analytics.categories.map(c => ({ value: c.value, color: c.color }))}
                size={200}
                strokeWidth={32}
              />
            </div>
            <div className="donut-legend">
              {analytics.categories.map((cat, i) => (
                <div key={i} className="donut-legend-item">
                  <span className="d-leg-dot" style={{ background: cat.color }} />
                  <span className="d-leg-icon">{cat.icon}</span>
                  <div className="d-leg-info">
                    <span className="d-leg-name">{cat.label}</span>
                    <span className="d-leg-val">{currency}{cat.value.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Metrics */}
          <section className="report-card card">
            <div className="report-card-header">
              <h3><TrendingUp size={18} /> Quick Metrics</h3>
            </div>
            <div className="quick-metrics-list">
              <div className="qm-item">
                <span className="qm-label">Avg. Spend per Client</span>
                <span className="qm-value">{currency}{analytics.totalClients > 0 ? Math.round(analytics.grandTotal / analytics.totalClients).toLocaleString() : '0'}</span>
              </div>
              <div className="qm-item">
                <span className="qm-label">Avg. Spend per Section</span>
                <span className="qm-value">{currency}{analytics.totalSections > 0 ? Math.round(analytics.grandTotal / analytics.totalSections).toLocaleString() : '0'}</span>
              </div>
              <div className="qm-item">
                <span className="qm-label">Highest Project</span>
                <span className="qm-value highlight">{analytics.clientData[0]?.name || '—'}</span>
              </div>
              <div className="qm-item">
                <span className="qm-label">Total Ledger Entries</span>
                <span className="qm-value">{analytics.clientData.reduce((s, c) => s + c.sections.reduce((ss, sec) => ss + sec.entryCount, 0), 0)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Detailed Drill-Down Table */}
      <section className="report-card card drilldown-section">
        <div className="report-card-header">
          <h3><FolderOpen size={18} /> Project Drill-down Ledger</h3>
          <span className="hint-text">Click a client to expand section-wise breakdown</span>
        </div>
        <div className="drilldown-table-wrapper">
          <table className="drilldown-table">
            <thead>
              <tr>
                <th style={{ width: '30px' }}></th>
                <th>Client / Section</th>
                <th>Project</th>
                <th className="num-col">Labor & Exp.</th>
                <th className="num-col">Hardware</th>
                <th className="num-col">Materials</th>
                <th className="num-col">Total</th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {analytics.clientData.map((client, idx) => (
                <React.Fragment key={client.id}>
                  <tr
                    className="drilldown-client-row"
                    onClick={() => toggleClient(client.id)}
                  >
                    <td>
                      <motion.div animate={{ rotate: expandedClients[client.id] ? 90 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronRight size={16} />
                      </motion.div>
                    </td>
                    <td>
                      <div className="dd-client-name">
                        <div className="dd-avatar" style={{ background: `hsl(${idx * 55}, 70%, 92%)`, color: `hsl(${idx * 55}, 70%, 40%)` }}>
                          {client.name[0]}
                        </div>
                        <strong>{client.name}</strong>
                      </div>
                    </td>
                    <td><span className="dd-project-tag">{client.projectName}</span></td>
                    <td className="num-col">{currency}{client.expenses.toLocaleString()}</td>
                    <td className="num-col">{currency}{client.hardware.toLocaleString()}</td>
                    <td className="num-col">{currency}{client.materials.toLocaleString()}</td>
                    <td className="num-col total-col">{currency}{client.total.toLocaleString()}</td>
                    <td>
                      <Link to={`/clients/${client.id}`} className="dd-link" onClick={e => e.stopPropagation()}>
                        <ArrowUpRight size={16} />
                      </Link>
                    </td>
                  </tr>
                  {expandedClients[client.id] && client.sections.map(sec => (
                    <tr
                      key={sec.id}
                      className="drilldown-section-row"
                    >
                      <td></td>
                      <td>
                        <div className="dd-section-name">
                          <FolderOpen size={14} />
                          <span>{sec.name}</span>
                          <span className="dd-entry-count">{sec.entryCount} entries</span>
                        </div>
                      </td>
                      <td></td>
                      <td className="num-col sub-val">{currency}{sec.expenses.toLocaleString()}</td>
                      <td className="num-col sub-val">{currency}{sec.hardware.toLocaleString()}</td>
                      <td className="num-col sub-val">{currency}{sec.materials.toLocaleString()}</td>
                      <td className="num-col sub-val sub-total">{currency}{sec.total.toLocaleString()}</td>
                      <td>
                        <Link to={`/clients/${client.id}/section/${sec.id}`} className="dd-link small" onClick={e => e.stopPropagation()}>
                          <ArrowUpRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {analytics.clientData.length === 0 && (
                <tr><td colSpan="8" className="empty-drilldown">No project data available. Add clients and sections to see analytics.</td></tr>
              )}
            </tbody>
            {analytics.clientData.length > 0 && (
              <tfoot>
                <tr className="drilldown-total-row">
                  <td></td>
                  <td colSpan="2"><strong>GRAND TOTAL</strong></td>
                  <td className="num-col">{currency}{analytics.totalExpenses.toLocaleString()}</td>
                  <td className="num-col">{currency}{analytics.totalHardware.toLocaleString()}</td>
                  <td className="num-col">{currency}{analytics.totalMaterials.toLocaleString()}</td>
                  <td className="num-col total-col">{currency}{analytics.grandTotal.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
