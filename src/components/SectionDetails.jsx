import { useState, useContext, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import {
  Plus,
  ArrowLeft,
  FileDown,
  Trash2,
  Receipt,
  Hammer,
  Layers,
  Search,
  Check,
  Zap,
  ChevronRight,
  TrendingUp,
  FileText
} from 'lucide-react';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from '../utils/supabase';

export default function SectionDetails() {
  const { clientId, sectionId } = useParams();
  const { db, setDb, session } = useContext(AppContext);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('expenses'); // expenses, hardware, materials
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- STATE FOR FORMS ---
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().split('T')[0],
    item: '',
    amount: '',
    notes: ''
  });
  const [hardwareForm, setHardwareForm] = useState({ item: '', qty: '', price: '', supplier: '' });
  const [materialForm, setMaterialForm] = useState({ type: '', size: '8x4', qty: '', sqft: '32', price: '' });

  const [suggestions, setSuggestions] = useState([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [successFlash, setSuccessFlash] = useState(false);

  // --- REFS FOR FOCUS MANAGEMENT ---
  const expenseDateRef = useRef(null);
  const hardwareItemRef = useRef(null);
  const materialTypeRef = useRef(null);
  const formRef = useRef(null);

  const client = db.clients.find(c => c.id === clientId);
  const section = client?.projects.find(p => p.id === sectionId);

  // --- SHORTCUTS ---
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.altKey) {
        if (e.key === '1') setActiveTab('expenses');
        if (e.key === '2') setActiveTab('hardware');
        if (e.key === '3') setActiveTab('materials');
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // --- FOCUS AFTER TAB CHANGE ---
  useEffect(() => {
    if (activeTab === 'expenses') expenseDateRef.current?.focus();
    if (activeTab === 'hardware') hardwareItemRef.current?.focus();
    if (activeTab === 'materials') materialTypeRef.current?.focus();
  }, [activeTab]);

  if (!client || !section) return <div className="p-10 text-center">Section not found</div>;

  // --- HELPERS ---
  const updateDB = (updatedClients) => {
    setDb({ ...db, clients: updatedClients });
  };

  const calculateTotal = (items, priceField = 'total') => {
    return items.reduce((acc, item) => acc + Number(item[priceField] || 0), 0);
  };

  const handleEnterKey = (e) => {
    if (e.key === 'Enter') {
      const form = e.target.form;
      const index = Array.prototype.indexOf.call(form, e.target);

      if (e.target.tagName === 'TEXTAREA' && !e.ctrlKey) return;
      if (suggestions.length > 0 && suggestionIndex !== -1) return;

      e.preventDefault();
      if (index < form.elements.length - 2) { 
        form.elements[index + 1].focus();
      } else {
        form.requestSubmit();
      }
    }
  };

  const triggerSuccess = () => {
    setSuccessFlash(true);
    setTimeout(() => setSuccessFlash(false), 500);
  };

  // --- ACTIONS ---
  const addExpense = (e) => {
    if (e) e.preventDefault();
    const newEntry = { id: Date.now().toString(), ...expenseForm };
    const updatedClients = db.clients.map(c => {
      if (c.id === clientId) {
        return { ...c, projects: c.projects.map(p => p.id === sectionId ? { ...p, expenses: [...p.expenses, newEntry] } : p) };
      }
      return c;
    });
    updateDB(updatedClients);
    triggerSuccess();
    setExpenseForm({ ...expenseForm, item: '', amount: '', notes: '' });
    setTimeout(() => formRef.current?.querySelector('input[placeholder*="Item/Work"]')?.focus(), 10);
  };

  const addHardware = (e) => {
    if (e) e.preventDefault();
    const total = Number(hardwareForm.qty) * Number(hardwareForm.price);
    const newEntry = { id: Date.now().toString(), ...hardwareForm, total };

    const updatedPriceMaster = { ...db.priceMaster };
    const existing = updatedPriceMaster.hardware.find(h => h.name === hardwareForm.item);
    if (!existing && hardwareForm.item) {
      updatedPriceMaster.hardware.push({ name: hardwareForm.item, price: hardwareForm.price, updatedAt: new Date().toISOString() });
    }

    const updatedClients = db.clients.map(c => {
      if (c.id === clientId) {
        return { ...c, projects: c.projects.map(p => p.id === sectionId ? { ...p, hardware: [...p.hardware, newEntry] } : p) };
      }
      return c;
    });
    setDb({ ...db, clients: updatedClients, priceMaster: updatedPriceMaster });
    triggerSuccess();
    setHardwareForm({ ...hardwareForm, item: '', qty: '', price: '' });
    hardwareItemRef.current?.focus();
  };

  const addMaterial = (e) => {
    if (e) e.preventDefault();
    const total = Number(materialForm.qty) * Number(materialForm.sqft) * Number(materialForm.price);
    const newEntry = { id: Date.now().toString(), ...materialForm, total };

    const updatedClients = db.clients.map(c => {
      if (c.id === clientId) {
        return { ...c, projects: c.projects.map(p => p.id === sectionId ? { ...p, materials: [...p.materials, newEntry] } : p) };
      }
      return c;
    });
    updateDB(updatedClients);
    triggerSuccess();
    setMaterialForm({ ...materialForm, type: '', qty: '' });
    materialTypeRef.current?.focus();
  };

  const deleteItem = (type, id) => {
    const updatedClients = db.clients.map(c => {
      if (c.id === clientId) {
        return {
          ...c,
          projects: c.projects.map(p => {
            if (p.id === sectionId) return { ...p, [type]: p[type].filter(item => item.id !== id) };
            return p;
          })
        };
      }
      return c;
    });
    updateDB(updatedClients);
  };

  // --- SMART SUGGESTIONS ---
  const handleItemInput = (val, type) => {
    if (type === 'hardware') {
      setHardwareForm({ ...hardwareForm, item: val });
      const matches = db.priceMaster.hardware.filter(h => h.name.toLowerCase().includes(val.toLowerCase()));
      setSuggestions(val ? matches : []);
      setSuggestionIndex(-1);
    }
  };

  const handleSuggestionKeyDown = (e) => {
    if (suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggestionIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestionIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && suggestionIndex !== -1) {
      e.preventDefault();
      selectSuggestion(suggestions[suggestionIndex]);
    } else if (e.key === 'Escape') {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (item) => {
    setHardwareForm({ ...hardwareForm, item: item.name, price: item.price });
    setSuggestions([]);
    setSuggestionIndex(-1);
    setTimeout(() => {
      const qtyInput = formRef.current?.querySelector('input[type="number"]');
      qtyInput?.focus();
    }, 10);
  };

  // --- EXPORT ---
  const exportToPDF = async () => {
    try {
      const doc = new jsPDF();
      const currency = db.settings.currency;
      const primaryColor = [0, 32, 70];
      
      // --- HEADER SECTION ---
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setFontSize(28);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text("FINE SPACE INTERIOR", 14, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text("INTERIOR DESIGN & MANAGEMENT SOLUTIONS", 14, 32);
      
      doc.setFontSize(18);
      doc.text("QUOTATION", 196, 25, { align: 'right' });
      
      // --- INFO SECTION ---
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text("CLIENT DETAILS:", 14, 55);
      doc.setFont('helvetica', 'normal');
      doc.text(client.name, 14, 60);
      doc.text(`Project: ${client.projectName || 'General'}`, 14, 65);
      
      doc.setFont('helvetica', 'bold');
      doc.text("DOCUMENT INFO:", 140, 55);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 60);
      doc.text(`Section: ${section.name}`, 140, 65);
      doc.text(`Category: ${activeTab.toUpperCase()}`, 140, 70);
      
      doc.setDrawColor(229, 231, 235);
      doc.line(14, 75, 196, 75);

      const data = activeTab === 'expenses' ? section.expenses :
        activeTab === 'hardware' ? section.hardware : section.materials;

      if (!data || data.length === 0) {
        alert("No data to export for this section.");
        return;
      }

      const columns = activeTab === 'expenses' ? ["No.", "Date", "Description", "Amount"] :
        activeTab === 'hardware' ? ["No.", "Item Description", "Qty", "Rate", "Amount"] :
          ["No.", "Material Detail", "Size", "Qty/Ft", "Rate", "Amount"];

      let totalAmount = 0;
      const body = data.map((item, i) => {
        totalAmount += parseFloat(item.amount || item.total || 0);
        if (activeTab === 'expenses') return [i+1, item.date, item.item, `${currency}${item.amount.toLocaleString()}`];
        if (activeTab === 'hardware') return [i+1, item.item, item.qty, `${currency}${item.price.toLocaleString()}`, `${currency}${item.total.toLocaleString()}`];
        return [i+1, item.type, item.size, `${item.qty} sh / ${item.sqft} ft`, `${currency}${item.price.toLocaleString()}`, `${currency}${item.total.toLocaleString()}`];
      });

      // Add Summary Row
      body.push([
        { content: 'GRAND TOTAL', colSpan: columns.length - 1, styles: { halign: 'right', fontStyle: 'bold', fillColor: [243, 244, 246] } },
        { content: `${currency}${totalAmount.toLocaleString()}`, styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } }
      ]);

      autoTable(doc, {
        startY: 85,
        head: [columns],
        body: body,
        theme: 'grid',
        headStyles: { 
          fillColor: primaryColor, 
          textColor: [255, 255, 255],
          fontSize: 10, 
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 4
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 15 },
          [columns.length - 1]: { halign: 'right', fontStyle: 'bold' }
        },
        styles: { 
          cellPadding: 4, 
          fontSize: 9,
          valign: 'middle',
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
        doc.text(`Page ${i} of ${pageCount}`, 196, 285, { align: 'right' });
        doc.text("Generated via Fine Space Interior", 14, 285);
        
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(0.5);
        doc.line(14, 280, 196, 280);
      }

      const fileName = `FS_${client.name}_${section.name}_${activeTab}.pdf`.replace(/[^a-z0-9.]/gi, '_');
      doc.save(fileName);

      // Save to Cloud History
      try {
        const blob = doc.output('blob');
        const path = `${session.user.id}/pdfs/${Date.now()}_${fileName}`;
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
                clientId: clientId,
                sectionId: sectionId
              },
              ... (prev.documents || [])
            ]
          }));
        }
      } catch (uploadErr) {
        console.error("Cloud document save failed:", uploadErr);
      }
    } catch (err) {
      console.error("PDF Export failed:", err);
      alert("Failed to generate PDF. Check console for details.");
    }
  };

  const exportToExcel = () => {
    const data = activeTab === 'expenses' ? section.expenses :
      activeTab === 'hardware' ? section.hardware : section.materials;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab);
    XLSX.writeFile(wb, `FS_Report_${client.name}_${section.name}.xlsx`);
  };

  return (
    <div className="section-details-page fade-in">
      <header className="content-header">
        <div className="header-left">
          <button onClick={() => navigate(`/clients/${clientId}`)} className="back-btn-new">
            <ArrowLeft size={18} />
          </button>
          <div className="title-group">
            <div className="breadcrumb">Projects / {client.name}</div>
            <h2>{section.name} Workflow</h2>
          </div>
        </div>
        <div className="header-actions">
          <div className="hint-pill-premium"><Zap size={14} /><span>Shortcuts Active</span></div>
          <button onClick={exportToExcel} className="export-action-btn"><FileText size={18} /><span>Excel</span></button>
          <button onClick={exportToPDF} className="export-action-btn primary"><FileDown size={18} /><span>Generate PDF</span></button>
        </div>
      </header>

      <div className="section-dashboard">
        {/* Analysis Bar */}
        <div className="metrics-box card">
          <div className="metric">
            <div className="metric-icon blue"><TrendingUp size={20} /></div>
            <div className="metric-info">
              <span className="label">Accumulated Value</span>
              <span className="value">
                {db.settings.currency}{(
                  calculateTotal(section.expenses, 'amount') +
                  calculateTotal(section.hardware) +
                  calculateTotal(section.materials)
                ).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="metric">
            <div className="metric-icon purple"><Hammer size={20} /></div>
            <div className="metric-info">
              <span className="label">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Total</span>
              <span className="value">
                {db.settings.currency}{activeTab === 'expenses' ?
                  calculateTotal(section.expenses, 'amount').toLocaleString() :
                  calculateTotal(section[activeTab]).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="metric-status">
             <div className="status-label">Live Status</div>
             <div className="live-indicator"><span className="ping" /> Synchronized</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="modern-tabs">
          <button className={activeTab === 'expenses' ? 'tab active' : 'tab'} onClick={() => setActiveTab('expenses')}>
            <Receipt size={18} />
            <span>General Expenses</span>
            <kbd>1</kbd>
          </button>
          <button className={activeTab === 'hardware' ? 'active tab' : 'tab'} onClick={() => setActiveTab('hardware')}>
            <Hammer size={18} />
            <span>Hardware Ledger</span>
            <kbd>2</kbd>
          </button>
          <button className={activeTab === 'materials' ? 'active tab' : 'tab'} onClick={() => setActiveTab('materials')}>
            <Layers size={18} />
            <span>Material Breakdown</span>
            <kbd>3</kbd>
          </button>
        </div>

        {/* Entry Grid */}
        <div className="workspace-grid">
          <section className={`entry-panel card ${successFlash ? 'success-pulse' : ''}`}>
            <div className="panel-header">
               <h3>New Entry</h3>
               <span className="hint">Press Enter to move between fields</span>
            </div>
            
            {activeTab === 'expenses' && (
              <form onSubmit={addExpense} ref={formRef} onKeyDown={handleEnterKey} className="standard-form">
                <div className="form-group">
                  <label>Service Date</label>
                  <input
                    ref={expenseDateRef}
                    type="date"
                    value={expenseForm.date}
                    onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Particulars (Item/Work)</label>
                  <input
                    placeholder="e.g. Laminate pressing charges"
                    value={expenseForm.item}
                    onChange={e => setExpenseForm({ ...expenseForm, item: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Amount (Value)</label>
                  <div className="input-with-symbol">
                    <span className="symbol">{db.settings.currency}</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={expenseForm.amount}
                      onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Supplementary Notes</label>
                  <textarea
                    rows="2"
                    placeholder="Add details... (Ctrl+Enter to Save)"
                    value={expenseForm.notes}
                    onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) addExpense(); }}
                  />
                </div>
                <button type="submit" className="submit-btn-premium">Commit Entry <Plus size={18} /></button>
              </form>
            )}

            {activeTab === 'hardware' && (
              <form onSubmit={addHardware} ref={formRef} onKeyDown={handleEnterKey} className="standard-form">
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Component Name</label>
                  <input
                    ref={hardwareItemRef}
                    placeholder="Search master or type new..."
                    value={hardwareForm.item}
                    onChange={e => handleItemInput(e.target.value, 'hardware')}
                    onKeyDown={handleSuggestionKeyDown}
                    autoComplete="off"
                    required
                  />
                  {suggestions.length > 0 && (
                    <ul className="suggestions-modern glass-widget">
                      {suggestions.map((s, i) => (
                        <li
                          key={i}
                          onClick={() => selectSuggestion(s)}
                          className={suggestionIndex === i ? 'active' : ''}
                        >
                          <span className="s-name">{s.name}</span>
                          <span className="s-price">{db.settings.currency}{s.price}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="dual-form-row">
                  <div className="form-group">
                    <label>Quantity</label>
                    <input
                      type="number"
                      value={hardwareForm.qty}
                      onChange={e => setHardwareForm({ ...hardwareForm, qty: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Rate / Price</label>
                    <input
                      type="number"
                      value={hardwareForm.price}
                      onChange={e => setHardwareForm({ ...hardwareForm, price: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Vendor / Supplier</label>
                  <input
                    placeholder="e.g. Modern Hardware Store"
                    value={hardwareForm.supplier}
                    onChange={e => setHardwareForm({ ...hardwareForm, supplier: e.target.value })}
                  />
                </div>
                <div className="calculation-box glass-widget">
                   <span className="formula">{hardwareForm.qty || 0} units × {db.settings.currency}{hardwareForm.price || 0}</span>
                   <span className="result">{db.settings.currency}{(Number(hardwareForm.qty) * Number(hardwareForm.price)).toLocaleString()}</span>
                   <span className="label">NET AMOUNT</span>
                </div>
                <button type="submit" className="submit-btn-premium">Commit Component <Plus size={18} /></button>
              </form>
            )}

            {activeTab === 'materials' && (
              <form onSubmit={addMaterial} ref={formRef} onKeyDown={handleEnterKey} className="standard-form">
                <div className="form-group">
                  <label>Broad Material Type</label>
                  <input
                    ref={materialTypeRef}
                    placeholder="e.g. Gurjan Plywood"
                    value={materialForm.type}
                    onChange={e => setMaterialForm({ ...materialForm, type: e.target.value })}
                    required
                  />
                </div>
                <div className="dual-form-row">
                   <div className="form-group">
                    <label>Qty (Sheets)</label>
                    <input
                      type="number"
                      value={materialForm.qty}
                      onChange={e => setMaterialForm({ ...materialForm, qty: e.target.value })}
                      required
                    />
                  </div>
                   <div className="form-group">
                    <label>Sq.Ft / Unit</label>
                    <input
                      type="number"
                      value={materialForm.sqft}
                      onChange={e => setMaterialForm({ ...materialForm, sqft: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Price per Square Foot</label>
                  <input
                    type="number"
                    value={materialForm.price}
                    onChange={e => setMaterialForm({ ...materialForm, price: e.target.value })}
                    required
                  />
                </div>
                <div className="calculation-box glass-widget">
                   <span className="formula">({materialForm.qty || 0} sh × {materialForm.sqft || 0} ft) × {db.settings.currency}{materialForm.price || 0}</span>
                   <span className="result">{db.settings.currency}{(Number(materialForm.qty) * Number(materialForm.sqft) * Number(materialForm.price)).toLocaleString()}</span>
                   <span className="label">NET MATERIAL AMOUNT</span>
                </div>
                <button type="submit" className="submit-btn-premium">Commit Material <Plus size={18} /></button>
              </form>
            )}
          </section>

          <section className="listing-panel card">
             <div className="panel-header">
               <h3>Project Ledger</h3>
               <div className="mini-search">
                  <Search size={16} />
                  <input placeholder="Filter ledger..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
               </div>
             </div>

             <div className="ledger-table-wrapper">
               <table className="modern-table">
                  <thead>
                    {activeTab === 'expenses' ? (
                      <tr><th>Date</th><th>Particulars</th><th>Amount</th><th style={{ width: '50px' }}></th></tr>
                    ) : (
                      <tr><th>Description</th><th>Qty Detail</th><th>Price Detail</th><th>Amount</th><th style={{ width: '50px' }}></th></tr>
                    )}
                  </thead>
                  <tbody>
                    {section[activeTab].filter(item =>
                      (item.item || item.type || "").toLowerCase().includes(searchTerm.toLowerCase())
                    ).map((item) => (
                      <tr key={item.id} className="ledger-row">
                        {activeTab === 'expenses' ? (
                          <>
                            <td><span className="date-tag">{item.date}</span></td>
                            <td><div className="item-txt">{item.item}</div><div className="notes-txt">{item.notes}</div></td>
                            <td className="amount-col">{db.settings.currency}{Number(item.amount).toLocaleString()}</td>
                          </>
                        ) : activeTab === 'hardware' ? (
                          <>
                            <td><div className="item-txt">{item.item}</div><div className="notes-txt">{item.supplier}</div></td>
                            <td>{item.qty} units</td>
                            <td>{db.settings.currency}{item.price} / unit</td>
                            <td className="amount-col">{db.settings.currency}{Number(item.total).toLocaleString()}</td>
                          </>
                        ) : (
                          <>
                            <td><div className="item-txt">{item.type}</div><div className="notes-txt">{item.size} • {item.sqft} sqft/sh</div></td>
                            <td>{item.qty} sheets</td>
                            <td>{db.settings.currency}{item.price} / sqft</td>
                            <td className="amount-col">{db.settings.currency}{Number(item.total).toLocaleString()}</td>
                          </>
                        )}
                        <td>
                          <button onClick={() => deleteItem(activeTab, item.id)} className="row-delete-btn"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                    {section[activeTab].length === 0 && <tr><td colSpan="5" className="empty-ledger">No records found for this section.</td></tr>}
                  </tbody>
               </table>
             </div>
          </section>
        </div>
      </div>

    </div>
  );
}
