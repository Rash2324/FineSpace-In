import { useContext, useRef } from 'react';
import { AppContext } from '../App';
import { 
  Download, 
  Upload, 
  Trash2, 
  ShieldCheck, 
  Palette, 
  AlertTriangle,
  Calculator
} from 'lucide-react';

export default function Settings() {
  const { db, setDb } = useContext(AppContext);
  const fileInputRef = useRef();

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fs_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (confirm('Importing data will overwrite your current database. Continue?')) {
          setDb(data);
          alert('Data restored successfully!');
        }
      } catch (err) {
        alert('Invalid backup file.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    if (confirm('CRITICAL: This will delete ALL data. This cannot be undone. Are you absolutely sure?')) {
       const initial = {
         clients: [],
         priceMaster: { hardware: [], materials: [] },
         settings: { darkMode: false, currency: '₹' }
       };
       setDb(initial);
    }
  };

  return (
    <div className="settings-page">
      <header className="page-header">
        <h2>App Settings</h2>
        <p>Manage your data backups, formulas, and system preferences.</p>
      </header>

      <div className="settings-grid">
         <section className="settings-card card">
           <div className="card-header">
             <ShieldCheck className="icon-blue" />
             <h3>Backup & Restore</h3>
           </div>
           <p className="card-desc">Keep your data safe by exporting it regularly.</p>
           <div className="settings-actions">
              <button onClick={handleExport} className="btn-secondary">
                <Download size={18} />
                <span>Export JSON Backup</span>
              </button>
              <button onClick={() => fileInputRef.current.click()} className="btn-secondary">
                <Upload size={18} />
                <span>Import Backup</span>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept=".json"
                onChange={handleImport}
              />
           </div>
         </section>

         <section className="settings-card card">
           <div className="card-header">
             <Calculator className="icon-purple" />
             <h3>System Formulas</h3>
           </div>
           <p className="card-desc">Active calculation logic for billing and data entry.</p>
           
           <div className="formula-group">
              <div className="formula-box">
                <span className="name">Plywood Material</span>
                <code>Qty × Sq.Ft × Price = Amount</code>
              </div>
              <div className="formula-box">
                <span className="name">Hardware & Items</span>
                <code>Qty × Price = Amount</code>
              </div>
              <div className="formula-box">
                <span className="name">Daily Expenses</span>
                <code>Direct Amount Entry</code>
              </div>
           </div>

           <div className="form-group" style={{ marginTop: '1.5rem' }}>
              <label>Currency Symbol</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  style={{ width: '80px', textAlign: 'center' }}
                  value={db.settings.currency} 
                  onChange={e => setDb({...db, settings: {...db.settings, currency: e.target.value}})} 
                />
                <span style={{ alignSelf: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Symbol used in reports</span>
              </div>
            </div>
         </section>

         <section className="settings-card card danger-zone">
           <div className="card-header">
             <AlertTriangle className="icon-red" />
             <h3>Danger Zone</h3>
           </div>
           <p className="card-desc">Perform destructive actions on your database.</p>
           <button onClick={handleClearAll} className="btn-danger">
             <Trash2 size={18} />
             <span>Wipe All Data</span>
           </button>
         </section>
      </div>

    </div>
  );
}
