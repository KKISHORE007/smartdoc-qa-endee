import React, { useEffect, useRef, useState, useCallback } from 'react';
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import { Loader2, AlertCircle, Download } from 'lucide-react';
import { renderAsync as renderDocx } from "docx-preview";
import * as XLSX from "xlsx";
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

// File formats that can be natively previewed in the browser
const BROWSER_PREVIEWABLE = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'txt', 'csv', 'md', 'svg'];
// File formats we can render ourselves in-browser
const CUSTOM_RENDERABLE = ['docx', 'xlsx', 'xls'];
// Anything else (pptx, ppt, doc, etc.) gets a "Open in Desktop App" button

export default function LocalDocViewer({ uploadedFile }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [htmlContent, setHtmlContent] = useState(null);

  const type = (uploadedFile?.type || '').toLowerCase();
  const ext = (uploadedFile?.name || '').split('.').pop().toLowerCase();

  const isDocViewerSupported = (() => {
    if (type.startsWith('image/') || type === 'application/pdf' || type.startsWith('text/')) return true;
    if (BROWSER_PREVIEWABLE.includes(ext)) return true;
    return false;
  })();

  const isCustomRenderable = CUSTOM_RENDERABLE.includes(ext);
  const needsDesktopFallback = !isDocViewerSupported && !isCustomRenderable;

  // Handler to download the file so user can open in their native app
  const handleOpenInDesktop = useCallback(() => {
    const downloadUrl = `${API_BASE}/documents/${uploadedFile.id}/download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = uploadedFile.name || 'document';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [uploadedFile]);

  useEffect(() => {
    // If the browser can preview it natively or it needs the desktop fallback, skip custom rendering
    if (isDocViewerSupported || !uploadedFile || needsDesktopFallback) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setHtmlContent(null);
    if (containerRef.current) containerRef.current.innerHTML = '';

    const downloadUrl = `${API_BASE}/documents/${uploadedFile.id}/download`;

    axios.get(downloadUrl, { responseType: 'arraybuffer' })
      .then(async (response) => {
        if (!isMounted) return;
        const arrayBuffer = response.data;
        
        try {
          if (ext === 'docx') {
             await renderDocx(arrayBuffer, containerRef.current, null, {
               className: 'docx-preview-container',
               inWrapper: true,
               ignoreLastRenderedPageBreak: false
             });
          } else if (ext === 'xlsx' || ext === 'xls') {
             const workbook = XLSX.read(arrayBuffer, { type: 'array' });
             const firstSheetName = workbook.SheetNames[0];
             const worksheet = workbook.Sheets[firstSheetName];
             const html = XLSX.utils.sheet_to_html(worksheet, { id: 'excel-preview-table' });
             
             const styledHtml = `
                <style>
                  #excel-preview-table { border-collapse: collapse; width: 100%; font-size: 12px; }
                  #excel-preview-table td, #excel-preview-table th { border: 1px solid #ddd; padding: 6px; }
                  #excel-preview-table tr:nth-child(even){ background-color: #f9fafb; }
                  #excel-preview-table tr:hover { background-color: #f1f5f9; }
                </style>
                ${html}
             `;
             setHtmlContent(styledHtml);
          }
        } catch (err) {
          console.error("Rendering error:", err);
          if (isMounted) setError("Failed to render this document. " + err.message);
        } finally {
          if (isMounted) setLoading(false);
        }
      })
      .catch(err => {
         console.error("Download error:", err);
         if (isMounted) {
            setError("Failed to fetch document for preview.");
            setLoading(false);
         }
      });

    return () => { isMounted = false; };
  }, [uploadedFile, isDocViewerSupported, isCustomRenderable, needsDesktopFallback, ext]);

  // ── Native browser preview (PDF, images, text) ──
  if (isDocViewerSupported) {
    const fileUrl = `${API_BASE}/documents/${uploadedFile.id}/download`;
    
    // Native Image Rendering
    if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e7eb', padding: '1rem', overflow: 'auto' }}>
          <img src={fileUrl} alt={uploadedFile.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }} />
        </div>
      );
    }

    // Native PDF & Text Rendering (Browsers are excellent at this natively)
    return (
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'block' }}>
        <iframe 
          src={`${fileUrl}#view=FitH`} 
          title={uploadedFile.name}
          style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#525659', display: 'block' }}
        />
      </div>
    );
  }

  // ── Desktop fallback for unsupported formats (PPTX, PPT, DOC, etc.) ──
  if (needsDesktopFallback) {
    const formatLabel = ext.toUpperCase();
    const appName = (ext === 'pptx' || ext === 'ppt') ? 'PowerPoint' :
                    (ext === 'doc') ? 'Microsoft Word' :
                    'the default application';
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
        backgroundColor: 'var(--bg-primary)',
      }}>
        {/* Gradient Icon Circle */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(59, 130, 246, 0.15))',
          padding: '20px',
          borderRadius: '50%',
          marginBottom: '20px',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </div>

        {/* Title */}
        <h3 style={{
          fontSize: '17px',
          fontWeight: '700',
          color: 'var(--text-primary)',
          marginBottom: '8px',
        }}>
          {formatLabel} Preview Not Available
        </h3>

        {/* Subtitle */}
        <p style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          maxWidth: '380px',
          lineHeight: '1.7',
          marginBottom: '24px',
        }}>
          This file format cannot be rendered directly in the browser.
          Click the button below to download and open it in{' '}
          <strong style={{ color: '#a855f7' }}>{appName}</strong> on your system.
        </p>

        {/* Open in Desktop Button */}
        <button
          onClick={handleOpenInDesktop}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 28px',
            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(168, 85, 247, 0.45)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(168, 85, 247, 0.3)';
          }}
        >
          <Download size={18} />
          Open in Desktop App
        </button>

        {/* Hint */}
        <p style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          marginTop: '16px',
          opacity: 0.7,
        }}>
          💡 The AI has already extracted the text — you can chat about it right away!
        </p>
      </div>
    );
  }

  // ── Custom rendered formats (DOCX, XLSX) ──
  return (
    <div className="w-full h-full relative" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 bg-[var(--bg-secondary)] fallback-loader transition-all">
          <Loader2 className="w-8 h-8 animate-spin mb-4" style={{ color: '#3b82f6' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Rendering format...</p>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-[var(--bg-secondary)]">
          <AlertCircle className="w-8 h-8 mb-3" style={{ color: 'var(--error)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--error)' }}>{error}</p>
        </div>
      )}

      {/* Container for DOCX rendering */}
      <div 
         ref={containerRef} 
         className="w-full h-full overflow-y-auto bg-white custom-scrollbar doc-preview-wrapper"
         style={{ display: htmlContent ? 'none' : 'block' }}
      />
      
      {/* Container for XLSX rendering */}
      {htmlContent && (
        <div 
          className="w-full h-full overflow-auto p-4 bg-white text-black" 
          dangerouslySetInnerHTML={{ __html: htmlContent }} 
        />
      )}
    </div>
  );
}
