import React, { useState, useRef } from 'react';

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngestFiles: (files: FileList | File[]) => void;
  onAddFolder: (folderPath: string) => void;
  onScanNativeFolder?: () => Promise<void>;
  onScanDiskFolder?: (folderPath: string) => void;
}

export const IngestModal: React.FC<IngestModalProps> = ({
  isOpen,
  onClose,
  onIngestFiles,
  onAddFolder,
  onScanNativeFolder,
  onScanDiskFolder
}) => {
  const [folderInput, setFolderInput] = useState('D:\\Archive');
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onIngestFiles(e.target.files);
      e.target.value = '';
      onClose();
    }
  };

  const handleNativeDir = async () => {
    if ('showDirectoryPicker' in window && onScanNativeFolder) {
      setScanning(true);
      try {
        await onScanNativeFolder();
        onClose();
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setScanning(false);
          return;
        }
        console.warn('Native folder scan canceled or failed, using file dialog fallback:', err);
      } finally {
        setScanning(false);
      }
    }
    
    if (dirInputRef.current) {
      dirInputRef.current.click();
    }
  };

  const handleDiskScanSubmit = () => {
    if (folderInput.trim() && onScanDiskFolder) {
      onScanDiskFolder(folderInput.trim());
      onClose();
    } else if (folderInput.trim()) {
      onAddFolder(folderInput.trim());
      onClose();
    }
  };

  const handleFolderSubmit = () => {
    if (folderInput.trim()) {
      onAddFolder(folderInput.trim());
      onClose();
    }
  };

  return (
    <div
      data-modal="1"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'rgba(29,45,61,.62)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.25s ease'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-modalcard="1"
        style={{
          width: '560px',
          maxWidth: '92vw',
          padding: '26px',
          borderRadius: '20px',
          background: 'var(--bg, #10161d)',
          color: 'var(--ink, #e9edf2)',
          boxShadow: '0 30px 80px rgba(29,45,61,.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          transform: 'translateY(0) scale(1)',
          animation: 'cardPop 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: '#94bce3'
              }}
            >
              Ingest & SQLite Indexer
            </div>
            <div
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
                fontSize: '30px',
                lineHeight: 1.05,
                textTransform: 'uppercase'
              }}
            >
              Add to the archive
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              border: 0,
              borderRadius: '11px',
              cursor: 'pointer',
              background: 'var(--well, #1d2d3d)',
              color: 'var(--ink, #e9edf2)',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '13px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Action 1: High-Performance Node Disk Crawler (SQLite archive.db) */}
        <div
          style={{
            padding: '16px',
            borderRadius: '14px',
            border: '1px solid rgba(148,188,227,.28)',
            background: 'rgba(148,188,227,.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 600,
                fontSize: '17px',
                letterSpacing: '.03em',
                textTransform: 'uppercase',
                color: '#b5d9fd'
              }}
            >
              ⚡ Fast Node Disk Crawler (Direct to SQLite archive.db)
            </div>
            <span
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9px',
                padding: '2px 6px',
                borderRadius: '5px',
                background: '#38ef7d',
                color: '#0d151c',
                fontWeight: 700
              }}
            >
              WAL MODE
            </span>
          </div>

          <div
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '10px',
              color: 'rgba(233,237,242,.6)',
              lineHeight: 1.4
            }}
          >
            Crawls local directories on Windows with zero memory limits. Parses zip central directories, indexes fonts, PSDs, videos & code into SQLite FTS5 index.
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDiskScanSubmit();
              }}
              placeholder="e.g. D:\Archive or C:\CreativeAssets"
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(148,188,227,.25)',
                background: 'var(--surface, #182636)',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '11.5px',
                color: 'var(--ink, #e9edf2)'
              }}
            />
            <button
              onClick={handleDiskScanSubmit}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                cursor: 'pointer',
                border: '1px solid #416180',
                background: 'linear-gradient(180deg, #6b91b6, #5980a6)',
                color: '#ffffff',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '.05em',
                textTransform: 'uppercase',
                boxShadow: '0 2px 0 #2c455d'
              }}
            >
              Scan Disk
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                color: 'rgba(233,237,242,.4)'
              }}
            >
              Quick Presets:
            </span>
            <button
              onClick={() => setFolderInput('D:\\Archive')}
              style={{
                padding: '3px 7px',
                borderRadius: '5px',
                background: 'rgba(148,188,227,.12)',
                border: '1px solid rgba(148,188,227,.2)',
                color: '#94bce3',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9px',
                cursor: 'pointer'
              }}
            >
              D:\Archive
            </button>
            <button
              onClick={() => setFolderInput('D:\\Archive\\design_handoff_archive_library')}
              style={{
                padding: '3px 7px',
                borderRadius: '5px',
                background: 'rgba(148,188,227,.12)',
                border: '1px solid rgba(148,188,227,.2)',
                color: '#94bce3',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9px',
                cursor: 'pointer'
              }}
            >
              design_handoff
            </button>
          </div>
        </div>

        {/* Action 2: Browser Directory Picker */}
        <label
          style={{
            padding: '13px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(148,188,227,.2)',
            background: 'var(--surface, #182636)',
            color: '#b5d9fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: scanning ? 'wait' : 'pointer',
            textAlign: 'left',
            transition: 'background 0.2s, border-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#94bce3';
            e.currentTarget.style.background = 'rgba(148,188,227,.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(148,188,227,.2)';
            e.currentTarget.style.background = 'var(--surface, #182636)';
          }}
        >
          <input
            ref={dirInputRef}
            type="file"
            // @ts-ignore
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFiles}
            style={{ display: 'none' }}
          />
          <div>
            <div
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 600,
                fontSize: '16px',
                textTransform: 'uppercase'
              }}
            >
              📁 Select Folder via Browser File Dialog
            </div>
            <div
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                color: 'rgba(233,237,242,.5)',
                marginTop: '2px'
              }}
            >
              Native OS directory dialog (recursively indexes all assets)
            </div>
          </div>
          <span style={{ fontSize: '18px' }}>›</span>
        </label>

        {/* Action 3: Drop / Choose Zips and Files */}
        <label
          style={{
            padding: '18px',
            borderRadius: '12px',
            border: '2px dashed rgba(148,188,227,.3)',
            background: 'var(--surface, #182636)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            cursor: 'pointer',
            transition: 'border-color 0.2s, background 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#94bce3';
            e.currentTarget.style.background = 'rgba(148,188,227,.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(148,188,227,.3)';
            e.currentTarget.style.background = 'var(--surface, #182636)';
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFiles}
            style={{ display: 'none' }}
          />
          <div
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600,
              fontSize: '16px',
              textTransform: 'uppercase'
            }}
          >
            Drop or choose zips & loose creative assets
          </div>
          <div
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '9.5px',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'rgba(233,237,242,.5)'
            }}
          >
            Each zip becomes one entry · indexed into archive.db with inner file contents
          </div>
        </label>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              borderRadius: '11px',
              cursor: 'pointer',
              border: '1px solid rgba(148,188,227,.2)',
              background: 'transparent',
              color: 'var(--ink, #e9edf2)',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '.05em',
              textTransform: 'uppercase'
            }}
          >
            Close
          </button>
          <button
            onClick={handleFolderSubmit}
            style={{
              padding: '10px 18px',
              borderRadius: '11px',
              cursor: 'pointer',
              border: '1px solid #416180',
              color: '#f2f2f3',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              background: 'linear-gradient(180deg, #6b91b6, #5980a6)',
              boxShadow: '0 2px 0 #416180, inset 0 1px 0 rgba(255,255,255,.26)'
            }}
          >
            Add as Watched Folder
          </button>
        </div>
      </div>
    </div>
  );
};
