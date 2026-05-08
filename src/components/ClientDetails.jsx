import { useState, useContext, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { Plus, Folder, FileText, ChevronRight, ArrowLeft, Trash2, Upload, Download, ExternalLink, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../utils/supabase';

export default function ClientDetails() {
  const { clientId } = useParams();
  const { db, setDb } = useContext(AppContext);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const client = db.clients.find(c => c.id === clientId);
  const [newSectionName, setNewSectionName] = useState('');
  const [uploading, setUploading] = useState(false);

  if (!client) return <div>Client not found</div>;

  const handleUploadEstimate = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file.');
      return;
    }

    setUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `estimates/${clientId}/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('finespace_docs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('finespace_docs')
        .getPublicUrl(filePath);

      const newDoc = {
        id: Date.now().toString(),
        name: file.name,
        url: publicUrl,
        clientId: clientId,
        createdAt: new Date().toISOString(),
        type: 'upload'
      };

      setDb({
        ...db,
        documents: [newDoc, ...(db.documents || [])]
      });

      alert('Estimate uploaded successfully!');
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadEstimate = () => {
    // ... existing logic ...
    try {
      const doc = new jsPDF();
      const currency = db.settings.currency;
      const primaryColor = [0, 32, 70];
      
      // --- HEADER ---
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setFontSize(26);
      doc.setTextColor(255, 255, 255);
      doc.text("FINE SPACE INTERIOR", 14, 25);
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
      client.projects.forEach((section, index) => {
        const sExp = section.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const sHw = section.hardware.reduce((s, e) => s + Number(e.total || 0), 0);
        const sMat = section.materials.reduce((s, e) => s + Number(e.total || 0), 0);
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
            ['General Expenses', `${section.expenses.length} entries`, `${currency}${sExp.toLocaleString()}`],
            ['Hardware Ledger', `${section.hardware.length} components`, `${currency}${sHw.toLocaleString()}`],
            ['Material Breakdown', `${section.materials.length} items`, `${currency}${sMat.toLocaleString()}`],
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

      doc.save(`Estimate_${client.name}_${client.projectName}.pdf`);
    } catch (err) {
      console.error("PDF Generation failed:", err);
      alert("Failed to generate estimate PDF.");
    }
  };

  const handleAddSection = (e) => {
    e.preventDefault();
    if (!newSectionName) return;

    const newSection = {
      id: Date.now().toString(),
      name: newSectionName,
      expenses: [],
      hardware: [],
      materials: [],
      createdAt: new Date().toISOString()
    };

    const updatedClients = db.clients.map(c => {
      if (c.id === clientId) {
        return { ...c, projects: [...c.projects, newSection] };
      }
      return c;
    });

    setDb({ ...db, clients: updatedClients });
    setNewSectionName('');
  };

  const handleDeleteSection = (id) => {
    if (confirm('Delete this project section? All data inside will be lost.')) {
      const updatedClients = db.clients.map(c => {
        if (c.id === clientId) {
          return { ...c, projects: c.projects.filter(p => p.id !== id) };
        }
        return c;
      });
      setDb({ ...db, clients: updatedClients });
    }
  };

  return (
    <div className="client-details-page">
      <header className="page-header">
        <div className="header-left">
          <button onClick={() => navigate('/clients')} className="back-btn"><ArrowLeft size={20} /></button>
          <div>
            <h2>{client.name}</h2>
            <p>{client.projectName} • {client.phone}</p>
          </div>
        </div>
        <div className="header-actions">
           <input 
             type="file" 
             ref={fileInputRef} 
             style={{ display: 'none' }} 
             accept=".pdf"
             onChange={handleUploadEstimate}
           />
           <button 
             className="btn-secondary" 
             onClick={() => fileInputRef.current?.click()}
             disabled={uploading}
           >
             <Upload size={18} />
             <span>{uploading ? 'Uploading...' : 'Upload Reference'}</span>
           </button>
           <button className="btn-secondary" onClick={handleDownloadEstimate}>
             <FileText size={18} />
             <span>Download Full Estimate</span>
           </button>
        </div>
      </header>

      <div className="project-sections">
        <div className="section-header">
          <h3>Project Sections</h3>
          <p>Break down the project into rooms or areas for detailed tracking.</p>
        </div>

        <div className="sections-grid">
          {client.projects.map((section) => (
            <div key={section.id} className="section-card">
              <div className="section-icon">
                <Folder size={24} />
              </div>
              <div className="section-info">
                <h4>{section.name}</h4>
                <div className="section-counts">
                  <span>{section.expenses.length} Expenses</span>
                  <span>{section.hardware.length} Hardware</span>
                </div>
              </div>
              <div className="section-actions">
                <Link to={`/clients/${client.id}/section/${section.id}`} className="enter-btn">
                  <span>Manage</span>
                  <ChevronRight size={18} />
                </Link>
                <button onClick={() => handleDeleteSection(section.id)} className="delete-mini">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          {/* Add Section Card */}
          <div className="add-section-card">
            <form onSubmit={handleAddSection}>
              <Plus size={24} className="plus-icon" />
              <input 
                placeholder="Add Section (e.g. Kitchen)"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
              />
              <button type="submit" disabled={!newSectionName}>Add</button>
            </form>
          </div>
        </div>
      </div>

      <div className="project-documents-section card">
        <div className="section-header">
          <h3>Project Documents</h3>
          <p>Access all generated estimates and uploaded references for this project.</p>
        </div>
        
        <div className="doc-mini-list">
          {(db.documents || []).filter(d => d.clientId === clientId).map(doc => (
            <div key={doc.id} className="doc-mini-item">
              <div className="doc-info">
                <FileText size={20} className="doc-icon" />
                <div>
                  <span className="doc-name">{doc.name}</span>
                  <span className="doc-date">{new Date(doc.createdAt).toLocaleDateString()} • {doc.type === 'upload' ? 'Upload' : 'Generated'}</span>
                </div>
              </div>
              <div className="doc-actions">
                <a 
                  href={doc.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="preview-btn-mini"
                  title="View / Preview"
                >
                  <Eye size={16} />
                </a>
                <button 
                  onClick={async () => {
                    try {
                      const response = await fetch(doc.url.includes('supabase.co') ? `${doc.url}?download=` : doc.url);
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = doc.name;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    } catch (err) {
                      window.open(doc.url, '_blank');
                    }
                  }} 
                  className="download-btn-mini"
                  title="Download Locally"
                >
                  <Download size={16} />
                </button>
                <button 
                  onClick={() => {
                    if (confirm('Are you sure you want to remove this document from the project?')) {
                      setDb({
                        ...db,
                        documents: (db.documents || []).filter(d => d.id !== doc.id)
                      });
                    }
                  }} 
                  className="delete-btn-mini"
                  title="Remove Document"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {(db.documents || []).filter(d => d.clientId === clientId).length === 0 && (
            <div className="empty-docs-hint">No documents found for this project yet.</div>
          )}
        </div>
      </div>

    </div>
  );
}
