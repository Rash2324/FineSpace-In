import { useState, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import { Database, Plus, Search, Trash2, Edit2, Check, X, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PriceMaster() {
  const { db, setDb } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('hardware');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({ name: '', price: '', unit: 'pcs' });

  const list = db.priceMaster[activeTab] || [];
  const filteredList = list.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleAdd = (e) => {
    if (e) e.preventDefault();
    const updated = { ...db.priceMaster };
    updated[activeTab].push({ ...form, id: Date.now().toString(), updatedAt: new Date().toISOString() });
    setDb({ ...db, priceMaster: updated });
    setForm({ name: '', price: '', unit: 'pcs' });
    setIsAdding(false);
  };

  const handleDelete = (id) => {
    if (confirm('Delete this item from price master?')) {
      const updated = { ...db.priceMaster };
      updated[activeTab] = updated[activeTab].filter(i => i.id !== id);
      setDb({ ...db, priceMaster: updated });
    }
  };

  // --- SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'n' && !isAdding && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsAdding(true);
      }
      if (e.key === 'Escape') {
        setIsAdding(false);
        setEditingId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdding]);

  const handleEnterKey = (e) => {
    if (e.key === 'Enter') {
      const form = e.target.form;
      const index = Array.prototype.indexOf.call(form, e.target);
      e.preventDefault();
      if (index < form.elements.length - 1) {
        form.elements[index + 1].focus();
      } else {
        form.requestSubmit();
      }
    }
  };

  return (
    <div className="price-master-page fade-in">
      <header className="content-header">
        <div>
          <h2>Product Inventory Master</h2>
          <p>Configure global rate cards for automated project billing. <kbd>N</kbd> for New</p>
        </div>
        <button className="btn-primary" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? <X size={20} /> : <Plus size={20} />}
          <span>{isAdding ? 'Close Editor' : 'Register New Item'}</span>
        </button>
      </header>

      <div className="tab-navigation-modern">
        <button className={activeTab === 'hardware' ? 'active' : ''} onClick={() => setActiveTab('hardware')}>
          <Tag size={18} />
          <span>Hardware Components</span>
        </button>
        <button className={activeTab === 'materials' ? 'active' : ''} onClick={() => setActiveTab('materials')}>
          <Database size={18} />
          <span>Raw Materials</span>
        </button>
      </div>

      <div className="utility-search-bar">
         <Search size={20} className="s-icon" />
         <input 
            placeholder={`Filter ${activeTab} catalog... (Press 'N' for quick entry)`} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
      </div>

      <div className="master-grid-modern">
        <AnimatePresence>
          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }}
              className="master-form-card glass-widget"
            >
              <h3>Add to {activeTab} Master</h3>
              <form onSubmit={handleAdd} onKeyDown={handleEnterKey}>
                <div className="form-group">
                  <label>Service/Item Name</label>
                  <input required autoFocus value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. EBCO Soft Close" />
                </div>
                <div className="dual-row">
                  <div className="form-group"><label>Rate / Price</label><input type="number" required value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="0.00" /></div>
                  <div className="form-group"><label>UOM / Unit</label><input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} placeholder="pcs/sqft" /></div>
                </div>
                <button type="submit" className="submit-master-btn">Save to Cloud Master <kbd>↵</kbd></button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {filteredList.map((item) => (
          <motion.div layout key={item.id} className="master-item-card card">
            <div className="m-card-top">
              <div className="m-info">
                <h4>{item.name}</h4>
                <div className="m-tag">{activeTab}</div>
              </div>
              <button onClick={() => handleDelete(item.id)} className="m-delete-btn"><Trash2 size={16} /></button>
            </div>
            <div className="m-card-price">
              <div className="price-tag-big">
                <span className="cur">{db.settings.currency}</span>
                <span className="amt">{item.price}</span>
              </div>
              <span className="unit">per {item.unit}</span>
            </div>
            <div className="m-card-footer">
              <div className="updated-info">
                <span>Sync Date: {new Date(item.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

    </div>
  );
}
