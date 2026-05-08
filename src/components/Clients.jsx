import { useState, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import { Plus, Search, ExternalLink, Phone, MapPin, Trash2, MoreHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText as FileIcon } from 'lucide-react';

const INTERIOR_IMAGES = [
  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1556911223-e153e4406697?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1513519247388-19346eaa95d4?w=800&auto=format&fit=crop'
];

export default function Clients() {
  const { db, setDb } = useContext(AppContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    address: '',
    projectName: ''
  });

  const clients = db?.clients || [];

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.projectName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddClient = (e) => {
    if (e) e.preventDefault();
    const clientToAdd = {
      id: Date.now().toString(),
      ...newClient,
      projects: [],
      createdAt: new Date().toISOString(),
      image: INTERIOR_IMAGES[clients.length % INTERIOR_IMAGES.length]
    };
    setDb({ ...db, clients: [...clients, clientToAdd] });
    setNewClient({ name: '', phone: '', address: '', projectName: '' });
    setIsModalOpen(false);
  };

  const handleDeleteClient = (id) => {
    if (confirm('Are you sure you want to delete this client?')) {
      setDb({ ...db, clients: clients.filter(c => c.id !== id) });
    }
  };

  // --- SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'n' && !isModalOpen && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsModalOpen(true);
      }
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const handleEnterKey = (e) => {
    if (e.key === 'Enter') {
      const form = e.target.form;
      const index = Array.prototype.indexOf.call(form, e.target);
      if (e.target.tagName === 'TEXTAREA') return;
      
      e.preventDefault();
      if (index < form.elements.length - 2) {
        form.elements[index + 1].focus();
      } else {
        form.requestSubmit();
      }
    }
  };

  const handleDownloadEstimate = (client) => {
    try {
      const doc = new jsPDF();
      const currency = db.settings.currency;
      const primaryColor = [0, 32, 70];
      
      // --- HEADER ---
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setFontSize(26);
      doc.setTextColor(255, 255, 255);
      doc.text("FINE SPACE", 14, 25);
      doc.setFontSize(10);
      doc.text("FULL PROJECT ESTIMATE SUMMARY", 14, 32);
      
      // --- CLIENT INFO ---
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text("CLIENT SUMMARY", 14, 55);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Client: ${client.name}`, 14, 62);
      doc.text(`Project: ${client.projectName}`, 14, 68);
      doc.text(`Contact: ${client.phone}`, 14, 74);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 62);
      
      let currentY = 85;
      let grandTotal = 0;

      // --- SECTIONS SUMMARY ---
      if (!client.projects || client.projects.length === 0) {
        doc.text("No project sections assigned yet.", 14, currentY);
      } else {
        client.projects.forEach((section, index) => {
          const sExp = (section.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
          const sHw = (section.hardware || []).reduce((s, e) => s + Number(e.total || 0), 0);
          const sMat = (section.materials || []).reduce((s, e) => s + Number(e.total || 0), 0);
          const sTotal = sExp + sHw + sMat;
          grandTotal += sTotal;

          if (currentY > 250) {
            doc.addPage();
            currentY = 20;
          }

          doc.setFont('helvetica', 'bold');
          doc.text(`${index + 1}. ${section.name.toUpperCase()}`, 14, currentY);
          currentY += 5;

          autoTable(doc, {
            startY: currentY,
            head: [['Category', 'Details', 'Amount']],
            body: [
              ['General Expenses', `${(section.expenses || []).length} entries`, `${currency}${sExp.toLocaleString()}`],
              ['Hardware Ledger', `${(section.hardware || []).length} components`, `${currency}${sHw.toLocaleString()}`],
              ['Material Breakdown', `${(section.materials || []).length} items`, `${currency}${sMat.toLocaleString()}`],
              [{ content: 'Section Total', styles: { fontStyle: 'bold' } }, '', { content: `${currency}${sTotal.toLocaleString()}`, styles: { fontStyle: 'bold' } }]
            ],
            theme: 'grid',
            headStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontSize: 9 },
            styles: { fontSize: 8 },
            margin: { left: 14, right: 14 }
          });
          
          currentY = doc.lastAutoTable.finalY + 15;
        });

        // --- FINAL TOTAL ---
        doc.setFillColor(243, 244, 246);
        doc.rect(14, currentY, 182, 12, 'F');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text(`GRAND TOTAL ESTIMATE: ${currency}${grandTotal.toLocaleString()}`, 20, currentY + 8);
      }

      doc.save(`Estimate_${client.name}_${client.projectName}.pdf`);
    } catch (err) {
      console.error("PDF Generation failed:", err);
      alert("Failed to generate estimate PDF.");
    }
  };

  return (
    <div className="clients-page fade-in">
      <header className="content-header">
        <div>
          <h2>Project Portfolio</h2>
          <p>Management of ongoing and upcoming interior projects. <kbd>N</kbd> for New</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={20} />
          <span>Start New Project</span>
        </button>
      </header>

      <div className="portfolio-grid">
        {filteredClients.map((client) => (
          <motion.div 
            layout
            key={client.id} 
            className="project-card card"
          >
            <div className="project-image">
              <img src={client.image || INTERIOR_IMAGES[0]} alt={client.projectName} />
              <div className="project-overlay">
                <span className="status-badge">Active</span>
                <button className="action-dot-btn"><MoreHorizontal size={20} /></button>
              </div>
            </div>
            
            <div className="project-body">
              <div className="project-main-info">
                 <h3>{client.projectName}</h3>
                 <span className="client-name">{client.name}</span>
              </div>
              
              <div className="project-meta">
                 <div className="meta-item">
                    <MapPin size={14} />
                    <span>{client.address || 'Site Address N/A'}</span>
                 </div>
                 <div className="meta-item">
                    <Phone size={14} />
                    <span>{client.phone}</span>
                 </div>
              </div>
            </div>

            <div className="project-footer">
              <div className="section-counts">
                 <strong>{client.projects.length}</strong>
                 <span>Assigned Sections</span>
              </div>
              <div className="footer-actions">
                <button 
                  onClick={() => handleDownloadEstimate(client)} 
                  className="estimate-btn"
                  title="Download Full Estimate"
                >
                  <FileIcon size={16} />
                  <span>Estimate</span>
                </button>
                <div className="footer-actions-right">
                  <Link to={`/clients/${client.id}`} className="open-btn">
                    <span>Open</span>
                    <ExternalLink size={16} />
                  </Link>
                  <button 
                    onClick={(e) => { e.preventDefault(); handleDeleteClient(client.id); }} 
                    className="delete-mini-btn"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        {filteredClients.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon"><Search size={48} /></div>
            <h3>No Projects Found</h3>
            <p>Ready to start a new interior design project? Use the "Start New Project" button or press <kbd>N</kbd></p>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="modal-content glass-widget" 
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Client Registration</h3>
              <p className="modal-subtitle">Enter the details below to initialize a new project workspace.</p>
              
              <form onSubmit={handleAddClient} onKeyDown={handleEnterKey}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Client Full Name</label>
                    <input 
                      required 
                      autoFocus
                      value={newClient.name}
                      onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                      placeholder="e.g. Rahul Sharma"
                    />
                  </div>
                  <div className="form-group">
                    <label>Project Name / Type</label>
                    <input 
                      required 
                      value={newClient.projectName}
                      onChange={(e) => setNewClient({...newClient, projectName: e.target.value})}
                      placeholder="e.g. 3BHK Modular Kitchen"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Primary Contact</label>
                  <input 
                    required 
                    value={newClient.phone}
                    onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>

                <div className="form-group">
                  <label>Site Address</label>
                  <textarea 
                    rows="2"
                    value={newClient.address}
                    onChange={(e) => setNewClient({...newClient, address: e.target.value})}
                    placeholder="Provide full site location for reports..."
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="discard-btn">Discard</button>
                  <button type="submit" className="btn-primary">Initialize Project <kbd>↵</kbd></button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
