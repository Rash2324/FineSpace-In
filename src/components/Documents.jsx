import { useContext } from 'react';
import { AppContext } from '../App';
import { 
  FileText, 
  Download, 
  ExternalLink, 
  Trash2, 
  Search,
  Calendar,
  Filter,
  FileDown,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';

export default function Documents() {
  const { db, setDb } = useContext(AppContext);
  const { documents = [], clients = [] } = db;

  const deleteDocument = (id) => {
    if (confirm("Are you sure you want to remove this document from history?")) {
      setDb({
        ...db,
        documents: documents.filter(d => d.id !== id)
      });
    }
  };

  const getClientName = (clientId) => {
    return clients.find(c => c.id === clientId)?.name || 'Unknown Client';
  };

  const handleDownload = async (url, name) => {
    try {
      // For Supabase URLs, we can use the ?download parameter to force download headers
      // Or we can fetch and create a blob for more control
      const downloadUrl = url.includes('supabase.co') ? `${url}?download=` : url;
      
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = name || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
      // Fallback: Open in new tab if fetch fails
      window.open(url, '_blank');
    }
  };

  return (
    <div className="documents-page fade-in">
      <header className="content-header">
        <div>
          <h2>Document Repository</h2>
          <p>History of all generated quotations and financial reports.</p>
        </div>
        <div className="header-actions">
           <div className="search-box mini">
              <Search size={16} />
              <input type="text" placeholder="Filter documents..." />
           </div>
        </div>
      </header>

      <div className="documents-grid">
        <div className="doc-list-panel card">
          <div className="panel-header">
            <h3>Recent Generations</h3>
            <span className="badge-count">{documents.length} Files</span>
          </div>

          <div className="doc-table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Client / Project</th>
                  <th>Generated Date</th>
                  <th>Size / Type</th>
                  <th style={{ width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="doc-row">
                    <td>
                      <div className="doc-name-cell">
                        <FileText size={20} className="text-blue-500" />
                        <div>
                          <div className="doc-title">{doc.name}</div>
                          <div className="doc-meta">PDF Document</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="doc-client">{getClientName(doc.clientId)}</div>
                    </td>
                    <td>
                      <div className="doc-date">
                        <Calendar size={14} />
                        {format(new Date(doc.createdAt), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </td>
                    <td>
                      <span className="type-tag pdf">PDF</span>
                    </td>
                    <td>
                      <div className="doc-actions">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="icon-btn-small" title="View/Print">
                          <Eye size={16} />
                        </a>
                        <button 
                          onClick={() => handleDownload(doc.url, doc.name)} 
                          className="icon-btn-small primary" 
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                        <button onClick={() => deleteDocument(doc.id)} className="icon-btn-small danger" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {documents.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-state">
                      <div className="empty-icon"><FileDown size={48} /></div>
                      <h4>No documents generated yet</h4>
                      <p>Generate a PDF from any project section to see it here.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
