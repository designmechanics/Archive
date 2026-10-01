import React, { useState, useRef } from 'react';
import { ThemeMode } from '../types';

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngestFiles: (files: FileList | File[]) => void;
  onAddFolder: (folderPath: string) => void;
  onScanNativeFolder?: () => Promise<void>;
  onScanDiskFolder?: (folderPath: string) => void;
  theme?: ThemeMode;
}

export const IngestModal: React.FC<IngestModalProps> = ({
  isOpen,
  onClose,
  onIngestFiles,
  onAddFolder,
  onScanNativeFolder,
  onScanDiskFolder,
  theme = 'dark'
}) => {
  const isLight = theme === 'light';
  const isMid = theme === 'mid';
  const isBlack = theme === 'black';
  const isDark = !isLight && !isMid && !isBlack;

  const c = {
    backdropBg: isLight ? 'rgba(15, 23, 42, 0.45)' : isMid ? 'rgba(15, 27, 39, 0.55)' : isBlack ? 'rgba(0, 0, 0, 0.88)' : 'rgba(29,45,61,.62)',
    modalBg: isLight ? '#ffffff' : isMid ? '#6c8ea8' : 'var(--bg, #10161d)',
    modalBorder: isLight ? '1px solid rgba(15, 23, 42, 0.12)' : isMid ? '1px solid rgba(15, 27, 39, 0.22)' : isBlack ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid rgba(148, 188, 227, 0.18)',
    textPrimary: isLight ? '#0f172a' : isMid ? '#09131d' : 'var(--ink, #e9edf2)',
    textSecondary: isLight ? '#334155' : isMid ? '#16293d' : 'rgba(233,237,242,.75)',
    textMuted: isLight ? '#64748b' : isMid ? '#29435c' : 'rgba(233,237,242,.45)',
    accentBadge: isLight ? '#1d4ed8' : isMid ? '#0a2e58' : '#94bce3',
    sectionTitle: isLight ? '#1e40af' : isMid ? '#051d38' : '#b5d9fd',
    cardBg: isLight ? '#f8fafc' : isMid ? 'rgba(255, 255, 255, 0.25)' : 'rgba(148,188,227,.06)',
    cardBorder: isLight ? 'rgba(15, 23, 42, 0.12)' : isMid ? 'rgba(15, 27, 39, 0.22)' : 'rgba(148,188,227,.28)',
    actionCardBg: isLight ? '#ffffff' : isMid ? 'rgba(255, 255, 255, 0.4)' : 'var(--surface, #182636)',
    actionCardBorder: isLight ? 'rgba(15, 23, 42, 0.12)' : isMid ? 'rgba(15, 27, 39, 0.20)' : 'rgba(148,188,227,.2)',
    actionCardHoverBorder: isLight ? '#2563eb' : isMid ? '#0a2e58' : '#94bce3',
    actionCardHoverBg: isLight ? 'rgba(37,99,235,0.06)' : isMid ? 'rgba(255,255,255,0.55)' : 'rgba(148,188,227,.12)',
    inputBg: isLight ? '#ffffff' : isMid ? '#f0f5fa' : 'var(--surface, #182636)',
    inputBorder: isLight ? 'rgba(15, 23, 42, 0.16)' : isMid ? 'rgba(11, 23, 36, 0.25)' : 'rgba(148,188,227,.25)',
    inputText: isLight ? '#0f172a' : isMid ? '#0b1724' : 'var(--ink, #e9edf2)',
    btnSecBg: isLight ? 'rgba(15, 23, 42, 0.06)' : isMid ? 'rgba(11, 23, 36, 0.12)' : 'rgba(148,188,227,.12)',
    btnSecBorder: isLight ? 'rgba(15, 23, 42, 0.12)' : isMid ? 'rgba(11, 23, 36, 0.22)' : 'rgba(148,188,227,.2)',
    btnSecText: isLight ? '#0f172a' : isMid ? '#0b1724' : '#94bce3',
    btnPriBg: isLight
      ? 'linear-gradient(180deg, #3b82f6, #2563eb)'
      : isMid
      ? 'linear-gradient(180deg, #2a4e76, #1d3958)'
      : 'linear-gradient(180deg, #6b91b6, #5980a6)',
    btnPriBorder: isLight ? '#2563eb' : isMid ? '#1e3a5f' : '#416180',
    btnPriShadow: isLight
      ? '0 2px 0 #1d4ed8'
      : isMid
      ? '0 2px 0 #13253b'
      : '0 2px 0 #2c455d',
    closeBg: isLight ? 'rgba(15, 23, 42, 0.06)' : isMid ? 'rgba(11, 23, 36, 0.12)' : 'var(--well, #1d2d3d)',
    closeText: isLight ? '#0f172a' : isMid ? '#0b1724' : 'var(--ink, #e9edf2)'
  };
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
        background: c.backdropBg,
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
          background: c.modalBg,
          color: c.textPrimary,
          border: c.modalBorder,
          boxShadow: isLight
            ? '0 20px 60px rgba(15, 23, 42, 0.15)'
            : isMid
            ? '0 20px 60px rgba(11, 23, 36, 0.35)'
            : '0 30px 80px rgba(29,45,61,.5)',
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
                color: c.accentBadge,
                fontWeight: 700
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
                textTransform: 'uppercase',
                color: c.textPrimary
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
              background: c.closeBg,
              color: c.closeText,
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
            border: c.cardBorder,
            background: c.cardBg,
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
                color: c.sectionTitle
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
                background: '#10b981',
                color: '#ffffff',
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
              color: c.textMuted,
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
                border: c.inputBorder,
                background: c.inputBg,
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '11.5px',
                color: c.inputText
              }}
            />
            <button
              onClick={handleDiskScanSubmit}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                cursor: 'pointer',
                border: `1px solid ${c.btnPriBorder}`,
                background: c.btnPriBg,
                color: '#ffffff',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '.05em',
                textTransform: 'uppercase',
                boxShadow: c.btnPriShadow
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
                color: c.textMuted
              }}
            >
              Quick Presets:
            </span>
            <button
              onClick={() => setFolderInput('D:\\Archive')}
              style={{
                padding: '3px 7px',
                borderRadius: '5px',
                background: c.btnSecBg,
                border: c.btnSecBorder,
                color: c.btnSecText,
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
                background: c.btnSecBg,
                border: c.btnSecBorder,
                color: c.btnSecText,
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
            border: c.actionCardBorder,
            background: c.actionCardBg,
            color: c.textPrimary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: scanning ? 'wait' : 'pointer',
            textAlign: 'left',
            transition: 'background 0.2s, border-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = c.actionCardHoverBorder;
            e.currentTarget.style.background = c.actionCardHoverBg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = c.actionCardBorder;
            e.currentTarget.style.background = c.actionCardBg;
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
                textTransform: 'uppercase',
                color: c.sectionTitle
              }}
            >
              📁 Select Folder via Browser File Dialog
            </div>
            <div
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                color: c.textMuted,
                marginTop: '2px'
              }}
            >
              Native OS directory dialog (recursively indexes all assets)
            </div>
          </div>
          <span style={{ fontSize: '18px', color: c.accentBadge }}>›</span>
        </label>

        {/* Action 3: Drop / Choose Zips and Files */}
        <label
          style={{
            padding: '18px',
            borderRadius: '12px',
            border: isLight ? '2px dashed rgba(15, 23, 42, 0.20)' : isMid ? '2px dashed rgba(15, 27, 39, 0.30)' : '2px dashed rgba(148,188,227,.3)',
            background: c.actionCardBg,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            cursor: 'pointer',
            transition: 'border-color 0.2s, background 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = c.actionCardHoverBorder;
            e.currentTarget.style.background = c.actionCardHoverBg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = isLight ? 'rgba(15, 23, 42, 0.20)' : isMid ? 'rgba(15, 27, 39, 0.30)' : 'rgba(148,188,227,.3)';
            e.currentTarget.style.background = c.actionCardBg;
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
              textTransform: 'uppercase',
              color: c.sectionTitle
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
              color: c.textMuted
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
              border: c.btnSecBorder,
              background: 'transparent',
              color: c.textPrimary,
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
              border: `1px solid ${c.btnPriBorder}`,
              color: '#ffffff',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              background: c.btnPriBg,
              boxShadow: c.btnPriShadow
            }}
          >
            Add as Watched Folder
          </button>
        </div>
      </div>
    </div>
  );
};
