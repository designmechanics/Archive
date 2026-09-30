import React, { useEffect, useState } from 'react';
import gsap from 'gsap';
import { AssetEntry, ZipPack, ThemeMode } from '../types';
import { KINDS, fmtSize, isIn } from '../data/seedData';
import { generatePreviewDoc, getPack, isZipArchive, pickDefaultFile, restorePackFromDB } from '../services/zipService';
import { UniversalPreview } from './preview/UniversalPreview';

interface SidePanelProps {
  theme?: ThemeMode;
  entry: AssetEntry | null;
  onClose: () => void;
  onPrevInPool?: () => void;
  onNextInPool: () => void;
  specimenText: string;
  onSpecimenChange: (txt: string) => void;
  motionMultiplier: number;
  onOpenZipContents?: (entry: AssetEntry) => void;
  isStudioMode?: boolean;
  onToggleStudioMode?: () => void;
}

type PanelTab = 'preview' | 'info' | 'files' | 'specimen';

export const SidePanel: React.FC<SidePanelProps> = ({
  theme,
  entry,
  onClose,
  onPrevInPool,
  onNextInPool,
  specimenText,
  onSpecimenChange,
  motionMultiplier,
  onOpenZipContents,
  isStudioMode: propStudioMode,
  onToggleStudioMode: propToggleStudioMode
}) => {
  const isLight = theme === 'light';
  const [pack, setPack] = useState<ZipPack | null>(null);
  const [packSel, setPackSel] = useState<string | null>(null);
  const [packDoc, setPackDoc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [internalStudioMode, setInternalStudioMode] = useState(false);
  const isStudioMode = propStudioMode !== undefined ? propStudioMode : internalStudioMode;
  const toggleStudioMode = propToggleStudioMode || (() => setInternalStudioMode((prev) => !prev));
  const [activeTab, setActiveTab] = useState<PanelTab>('preview');
  const [fileFilter, setFileFilter] = useState('');
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Animate width changes: default to at least middle of screen (56vw), studio mode (88vw)
  useEffect(() => {
    const p = panelRef.current;
    if (!p) return;
    const targetWidth = isStudioMode ? '88vw' : '56vw';
    gsap.to(p, {
      width: targetWidth,
      duration: 0.45 * motionMultiplier,
      ease: 'expo.out'
    });
  }, [isStudioMode, motionMultiplier]);

  // Reset tab to preview on entry change
  useEffect(() => {
    if (entry) {
      setActiveTab('preview');
      setFileFilter('');
    }
  }, [entry?.id]);

  // Animate panel slide in/out
  useEffect(() => {
    const p = panelRef.current;
    if (!p) return;
    const isOpen = !!entry;

    gsap.to(p, {
      x: isOpen ? '0%' : '104%',
      duration: 0.62 * motionMultiplier,
      ease: isOpen ? 'expo.out' : 'power3.inOut'
    });

    if (isOpen) {
      gsap.fromTo(
        '[data-sandbox="1"]',
        { y: 16, opacity: 0, scale: 0.98 },
        { y: 0, opacity: 1, scale: 1, duration: 0.5 * motionMultiplier, ease: 'expo.out', delay: 0.1 * motionMultiplier }
      );
    }
  }, [entry, motionMultiplier]);

  // Load zip pack if entry has packId
  useEffect(() => {
    if (!entry || !entry.packId) {
      setPack(null);
      setPackSel(null);
      setPackDoc(null);
      return;
    }

    let active = true;
    const load = async () => {
      let p = getPack(entry.packId!);
      if (!p) {
        p = await restorePackFromDB(entry.packId!);
      }
      if (!active) return;
      setPack(p);
      if (p) {
        if (entry.isZipInnerFile && entry.zipInnerPath) {
          setPackSel(entry.zipInnerPath);
        } else {
          const def = pickDefaultFile(p);
          setPackSel(def);
        }
      }
    };
    load();

    return () => {
      active = false;
    };
  }, [entry]);

  // Sync packSel if entry.zipInnerPath updates
  useEffect(() => {
    if (entry?.isZipInnerFile && entry.zipInnerPath) {
      setPackSel(entry.zipInnerPath);
    }
  }, [entry?.id, entry?.zipInnerPath]);

  // Generate preview document when packSel, pack, or specimenText changes
  useEffect(() => {
    if (!pack || !packSel) {
      setPackDoc(null);
      return;
    }

    let active = true;
    const generate = async () => {
      try {
        const doc = await generatePreviewDoc(pack, packSel, specimenText);
        if (active) setPackDoc(doc);
      } catch (err) {
        if (active) {
          setPackDoc(
            `<body style="font:11px ui-monospace,monospace;padding:16px;color:#2c455d">could not render ${packSel}</body>`
          );
        }
      }
    };
    generate();

    return () => {
      active = false;
    };
  }, [pack, packSel, specimenText]);

  if (!entry) {
    return (
      <div
        ref={panelRef}
        data-panel="1"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: isStudioMode ? '88vw' : '56vw',
          minWidth: isStudioMode ? '840px' : '580px',
          maxWidth: '96vw',
          zIndex: 40,
          transform: 'translateX(104%)',
          background: 'var(--rail, #1d2d3d)',
          color: '#e9edf2',
          boxShadow: '-20px 0 60px rgba(29,45,61,.42)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      />
    );
  }

  const isFont = entry.type === 'font' || (pack && isIn('font', packSel || ''));
  const isZip = isZipArchive(entry);

  // Copy handler
  const handleCopyOpen = async () => {
    let textToCopy = entry.title;
    if (pack && packSel && isIn('text', packSel)) {
      textToCopy = await pack.text(packSel);
    } else if (pack && packSel) {
      textToCopy = `${pack.name}/${packSel}`;
    } else {
      textToCopy = `/Volumes/Archive/${entry.cat.toLowerCase().replace(/[^a-z]+/g, '-')}/${entry.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    }

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(textToCopy);
      }
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const metadataList = [
    { k: 'Format', v: KINDS[entry.type]?.[0] || entry.type.toUpperCase() },
    { k: 'Pool', v: entry.cat },
    { k: 'Source', v: entry.author },
    { k: 'Added', v: entry.date },
    { k: 'Size', v: entry.size },
    { k: 'Dependencies', v: entry.deps || 'none' },
    { k: 'Files', v: String(pack ? pack.list.length : entry.fileCount || 1) },
    {
      k: 'Path',
      v: pack
        ? `local · ${pack.name}${packSel ? ' › ' + packSel : ''}`
        : `/Volumes/Archive/${entry.cat.toLowerCase().replace(/[^a-z]+/g, '-')}/${entry.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
    }
  ];

  const handleDownload = async () => {
    if (pack && pack.rawBlob) {
      const url = URL.createObjectURL(pack.rawBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pack.name;
      a.click();
      URL.revokeObjectURL(url);
    } else if (pack && packSel) {
      const txt = await pack.text(packSel);
      const blob = new Blob([txt], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = packSel.split('/').pop() || 'asset.txt';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const content = entry.demo || `<!-- ${entry.title} -->\n<!-- Format: ${entry.type} -->\n`;
      const blob = new Blob([content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entry.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const filteredPackList = pack
    ? pack.list.filter((f) => {
        if (!fileFilter.trim()) return true;
        return f.path.toLowerCase().includes(fileFilter.toLowerCase().trim());
      })
    : [];

  return (
    <>
      {/* Backdrop overlay: shown in Studio Mode (88vw) to dim background; omitted in Dock Mode (56vw) so the centered content card remains clear and interactive */}
      {isStudioMode && (
        <div
          data-panel-backdrop="1"
          onClick={onClose}
          title="Click to close preview"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 38,
            background: 'rgba(8, 14, 22, 0.42)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            cursor: 'pointer',
            animation: 'panelBackdropFadeIn 0.22s ease-out'
          }}
        />
      )}
      <div
        ref={panelRef}
        data-panel="1"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: isStudioMode ? '88vw' : '56vw',
        minWidth: isStudioMode ? '840px' : '580px',
        maxWidth: '96vw',
        zIndex: 40,
        transform: 'translateX(104%)',
        background: isLight ? '#ffffff' : 'var(--rail, #1d2d3d)',
        color: isLight ? '#0f172a' : '#e9edf2',
        borderLeft: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(148, 188, 227, 0.18)',
        boxShadow: isLight ? '-16px 0 48px rgba(15, 23, 42, 0.12)' : '-20px 0 60px rgba(29,45,61,.42)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Panel Top Header */}
      <div
        style={{
          flex: 'none',
          padding: '16px 20px 12px',
          borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(148,188,227,.18)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: isLight ? 'var(--tint-ink, #1d4ed8)' : '#94bce3'
              }}
            >
              {KINDS[entry.type]?.[0] || entry.type} · {entry.cat}
            </div>
            <div
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
                fontSize: '26px',
                lineHeight: 1.1,
                wordBreak: 'break-word',
                marginTop: '1px'
              }}
            >
              {entry.title}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {onPrevInPool && (
              <button
                onClick={onPrevInPool}
                title="Previous asset (‹ or Left Arrow)"
                style={{
                  height: '32px',
                  width: '32px',
                  border: isLight ? '1px solid rgba(15, 23, 42, 0.12)' : '1px solid rgba(148,188,227,.2)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(148,188,227,.12)',
                  color: isLight ? '#0f172a' : '#b5d9fd',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s, border-color 0.15s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isLight ? 'rgba(15, 23, 42, 0.09)' : 'rgba(148,188,227,.24)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(148,188,227,.12)')}
              >
                ‹
              </button>
            )}
            {onNextInPool && (
              <button
                onClick={onNextInPool}
                title="Next asset (› or Right Arrow)"
                style={{
                  height: '32px',
                  width: '32px',
                  border: isLight ? '1px solid rgba(15, 23, 42, 0.12)' : '1px solid rgba(148,188,227,.2)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(148,188,227,.12)',
                  color: isLight ? '#0f172a' : '#b5d9fd',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s, border-color 0.15s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isLight ? 'rgba(15, 23, 42, 0.09)' : 'rgba(148,188,227,.24)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(148,188,227,.12)')}
              >
                ›
              </button>
            )}
            <button
              onClick={toggleStudioMode}
              title={isStudioMode ? 'Collapse to standard dock (56vw)' : 'Expand to Studio mode (88vw)'}
              style={{
                height: '32px',
                padding: '0 11px',
                border: isLight ? '1px solid rgba(15, 23, 42, 0.12)' : '1px solid rgba(148,188,227,.2)',
                borderRadius: '10px',
                cursor: 'pointer',
                background: isStudioMode
                  ? (isLight ? 'rgba(37, 99, 235, 0.15)' : 'rgba(148,188,227,.35)')
                  : (isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(148,188,227,.14)'),
                color: isStudioMode
                  ? (isLight ? '#1d4ed8' : '#ffffff')
                  : (isLight ? '#0f172a' : '#b5d9fd'),
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>{isStudioMode ? '⇲ 56vw' : '⇱ 88vw Studio'}</span>
            </button>
            {isZip && !entry.isZipInnerFile && onOpenZipContents && (
              <button
                onClick={() => {
                  onOpenZipContents(entry);
                  onClose();
                }}
                title="Browse Archive Contents in Stage view"
                style={{
                  height: '32px',
                  padding: '0 12px',
                  border: isLight ? '1px solid rgba(34, 197, 94, 0.45)' : '1px solid rgba(56,239,125,.4)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: isLight ? 'rgba(34, 197, 94, 0.12)' : 'rgba(56,239,125,.14)',
                  color: isLight ? '#15803d' : '#38ef7d',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isLight ? 'rgba(34, 197, 94, 0.2)' : 'rgba(56,239,125,.28)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = isLight ? 'rgba(34, 197, 94, 0.12)' : 'rgba(56,239,125,.14)')}
              >
                <span>📦</span>
                <span>Open in Stage</span>
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                flex: 'none',
                width: '32px',
                height: '32px',
                border: isLight ? '1px solid rgba(15, 23, 42, 0.1)' : 0,
                borderRadius: '10px',
                cursor: 'pointer',
                background: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(148,188,227,.16)',
                color: isLight ? '#0f172a' : '#e9edf2',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '13px'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation: Preview (Default, Full Area) · File Info · Package Contents · Specimen */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginTop: '4px',
            background: isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(16,22,29,.6)',
            padding: '3px',
            borderRadius: '10px',
            border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(148,188,227,.12)',
            width: 'fit-content'
          }}
        >
          <button
            onClick={() => setActiveTab('preview')}
            style={{
              padding: '5px 12px',
              borderRadius: '7px',
              border: 0,
              cursor: 'pointer',
              background: activeTab === 'preview'
                ? (isLight ? '#ffffff' : 'rgba(148,188,227,.25)')
                : 'transparent',
              color: activeTab === 'preview'
                ? (isLight ? '#0f172a' : '#ffffff')
                : (isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(233,237,242,.65)'),
              boxShadow: activeTab === 'preview' && isLight ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '10.5px',
              fontWeight: activeTab === 'preview' ? 600 : 400,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.15s, color 0.15s'
            }}
          >
            <span>👁️</span>
            <span>Preview</span>
          </button>

          <button
            onClick={() => setActiveTab('info')}
            style={{
              padding: '5px 12px',
              borderRadius: '7px',
              border: 0,
              cursor: 'pointer',
              background: activeTab === 'info'
                ? (isLight ? '#ffffff' : 'rgba(148,188,227,.25)')
                : 'transparent',
              color: activeTab === 'info'
                ? (isLight ? '#0f172a' : '#ffffff')
                : (isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(233,237,242,.65)'),
              boxShadow: activeTab === 'info' && isLight ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '10.5px',
              fontWeight: activeTab === 'info' ? 600 : 400,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.15s, color 0.15s'
            }}
          >
            <span>📋</span>
            <span>File Info</span>
          </button>

          {isZip && (
            <button
              onClick={() => setActiveTab('files')}
              style={{
                padding: '5px 12px',
                borderRadius: '7px',
                border: 0,
                cursor: 'pointer',
                background: activeTab === 'files'
                  ? (isLight ? '#ffffff' : 'rgba(148,188,227,.25)')
                  : 'transparent',
                color: activeTab === 'files'
                  ? (isLight ? '#0f172a' : '#ffffff')
                  : (isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(233,237,242,.65)'),
                boxShadow: activeTab === 'files' && isLight ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '10.5px',
                fontWeight: activeTab === 'files' ? 600 : 400,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background 0.15s, color 0.15s'
              }}
            >
              <span>📦</span>
              <span>Files</span>
              <span
                style={{
                  fontSize: '9px',
                  background: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(148,188,227,.2)',
                  color: isLight ? '#0f172a' : 'inherit',
                  padding: '1px 5px',
                  borderRadius: '99px'
                }}
              >
                {pack ? pack.list.length : entry.fileCount || 1}
              </span>
            </button>
          )}

          {isFont && (
            <button
              onClick={() => setActiveTab('specimen')}
              style={{
                padding: '5px 12px',
                borderRadius: '7px',
                border: 0,
                cursor: 'pointer',
                background: activeTab === 'specimen'
                  ? (isLight ? '#ffffff' : 'rgba(148,188,227,.25)')
                  : 'transparent',
                color: activeTab === 'specimen'
                  ? (isLight ? '#0f172a' : '#ffffff')
                  : (isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(233,237,242,.65)'),
                boxShadow: activeTab === 'specimen' && isLight ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '10.5px',
                fontWeight: activeTab === 'specimen' ? 600 : 400,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background 0.15s, color 0.15s'
              }}
            >
              <span>🔤</span>
              <span>Specimen</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Panel Content Area */}
      {activeTab === 'preview' && (
        <div
          data-sandbox="1"
          style={{
            flex: 1,
            minHeight: 0,
            padding: '12px 16px 14px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            gap: '10px'
          }}
        >
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <UniversalPreview
              theme={theme}
              entry={entry}
              pack={pack}
              packSel={packSel}
              packDoc={packDoc}
              specimenText={specimenText}
              isStudioMode={isStudioMode}
              onToggleStudioMode={toggleStudioMode}
              motionMultiplier={motionMultiplier}
            />
          </div>

          {/* Navigation Controls in Preview Tab: Previous and Next */}
          <div
            style={{
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <button
              onClick={onPrevInPool}
              title="Navigate to previous asset in current pool / view (Left Arrow)"
              style={{
                flex: 1,
                padding: '9px 16px',
                borderRadius: '11px',
                cursor: 'pointer',
                border: isLight ? '1px solid rgba(15, 23, 42, 0.12)' : '1px solid rgba(148,188,227,.28)',
                background: isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(24,36,50,.85)',
                color: isLight ? '#0f172a' : '#b5d9fd',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background 0.18s, border-color 0.18s, transform 0.15s, box-shadow 0.18s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isLight ? 'rgba(37, 99, 235, 0.08)' : 'rgba(148,188,227,.2)';
                e.currentTarget.style.borderColor = isLight ? '#2563eb' : '#94bce3';
                e.currentTarget.style.boxShadow = isLight ? '0 4px 14px rgba(15, 23, 42, 0.08)' : '0 4px 14px rgba(29,45,61,.3)';
                e.currentTarget.style.transform = 'translateX(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(24,36,50,.85)';
                e.currentTarget.style.borderColor = isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(148,188,227,.28)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <span style={{ fontSize: '16px', lineHeight: 1 }}>‹</span>
              <span>Previous</span>
            </button>

            <button
              onClick={onNextInPool}
              title="Navigate to next asset in current pool / view (Right Arrow)"
              style={{
                flex: 1,
                padding: '9px 16px',
                borderRadius: '11px',
                cursor: 'pointer',
                border: isLight ? '1px solid rgba(15, 23, 42, 0.12)' : '1px solid rgba(148,188,227,.28)',
                background: isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(24,36,50,.85)',
                color: isLight ? '#0f172a' : '#b5d9fd',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background 0.18s, border-color 0.18s, transform 0.15s, box-shadow 0.18s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isLight ? 'rgba(37, 99, 235, 0.08)' : 'rgba(148,188,227,.2)';
                e.currentTarget.style.borderColor = isLight ? '#2563eb' : '#94bce3';
                e.currentTarget.style.boxShadow = isLight ? '0 4px 14px rgba(15, 23, 42, 0.08)' : '0 4px 14px rgba(29,45,61,.3)';
                e.currentTarget.style.transform = 'translateX(2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(24,36,50,.85)';
                e.currentTarget.style.borderColor = isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(148,188,227,.28)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <span>Next</span>
              <span style={{ fontSize: '16px', lineHeight: 1 }}>›</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'info' && (
        <div
          data-scroll="1"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '20px 22px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {/* Metadata Table */}
          <div
            style={{
              borderRadius: '13px',
              border: isLight ? '1px solid rgba(15, 23, 42, 0.1)' : '1px solid rgba(148,188,227,.2)',
              overflow: 'hidden',
              background: isLight ? 'rgba(15, 23, 42, 0.02)' : 'rgba(16,22,29,.4)'
            }}
          >
            <div
              style={{
                padding: '9px 13px',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: isLight ? 'var(--tint-ink, #1d4ed8)' : '#94bce3',
                background: isLight ? 'rgba(37, 99, 235, 0.06)' : 'rgba(148,188,227,.1)',
                borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(148,188,227,.15)'
              }}
            >
              File Properties & Metadata
            </div>
            {metadataList.map((m) => (
              <div
                key={m.k}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '9px 14px',
                  borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.06)' : '1px solid rgba(148,188,227,.08)'
                }}
              >
                <span
                  style={{
                    width: '110px',
                    flex: 'none',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '9.5px',
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    color: isLight ? 'rgba(15, 23, 42, 0.55)' : 'rgba(233,237,242,.45)'
                  }}
                >
                  {m.k}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '11px',
                    color: isLight ? '#0f172a' : 'rgba(233,237,242,.85)',
                    wordBreak: 'break-all'
                  }}
                >
                  {m.v}
                </span>
              </div>
            ))}
          </div>

          {/* Tags & Categories */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '99px',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                background: isLight ? 'var(--tint, #eff6ff)' : 'rgba(148,188,227,.14)',
                color: isLight ? 'var(--tint-ink, #1d4ed8)' : '#b5d9fd',
                border: isLight ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid rgba(148,188,227,.26)'
              }}
            >
              Pool: {entry.cat}
            </span>
            {entry.deps &&
              entry.deps.split(' · ').map((d) => (
                <span
                  key={d}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '99px',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '9.5px',
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    background: isLight ? 'var(--tint, #eff6ff)' : 'rgba(148,188,227,.14)',
                    color: isLight ? 'var(--tint-ink, #1d4ed8)' : '#b5d9fd',
                    border: isLight ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid rgba(148,188,227,.26)'
                  }}
                >
                  {d}
                </span>
              ))}
            {entry.exts &&
              entry.exts.map((x) => (
                <span
                  key={x}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '99px',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '9.5px',
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    background: isLight ? 'var(--tint, #eff6ff)' : 'rgba(148,188,227,.14)',
                    color: isLight ? 'var(--tint-ink, #1d4ed8)' : '#b5d9fd',
                    border: isLight ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid rgba(148,188,227,.26)'
                  }}
                >
                  .{x}
                </span>
              ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
            <button
              onClick={handleCopyOpen}
              style={{
                flex: 1,
                padding: '11px',
                borderRadius: '12px',
                cursor: 'pointer',
                border: isLight ? '1px solid #1d4ed8' : '1px solid #416180',
                color: '#ffffff',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '.05em',
                textTransform: 'uppercase',
                background: isLight ? 'linear-gradient(180deg, #3b82f6, #2563eb)' : 'linear-gradient(180deg, #6b91b6, #5980a6)',
                boxShadow: isLight
                  ? '0 2px 0 #1d4ed8, inset 0 1px 0 rgba(255,255,255,.3)'
                  : '0 2px 0 #2c455d, inset 0 1px 0 rgba(255,255,255,.24)',
                transition: 'transform 0.1s, box-shadow 0.1s'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translateY(2px)';
                e.currentTarget.style.boxShadow = isLight ? '0 0 0 #1d4ed8' : '0 0 0 #2c455d';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = isLight
                  ? '0 2px 0 #1d4ed8, inset 0 1px 0 rgba(255,255,255,.3)'
                  : '0 2px 0 #2c455d, inset 0 1px 0 rgba(255,255,255,.24)';
              }}
            >
              {copied
                ? 'Copied'
                : entry.type === 'code' || (pack && isIn('text', packSel || ''))
                ? 'Copy source'
                : 'Copy path'}
            </button>
            <button
              onClick={handleDownload}
              title="Download asset or package file"
              style={{
                flex: 1,
                padding: '11px 16px',
                borderRadius: '12px',
                cursor: 'pointer',
                border: isLight ? '1px solid rgba(15, 23, 42, 0.16)' : '1px solid rgba(148,188,227,.3)',
                background: isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(148,188,227,.12)',
                color: isLight ? '#0f172a' : '#b5d9fd',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '.05em',
                textTransform: 'uppercase',
                transition: 'background 0.18s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isLight ? 'rgba(15, 23, 42, 0.09)' : 'rgba(148,188,227,.22)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(148,188,227,.12)')}
            >
              Export ↓
            </button>
          </div>
        </div>
      )}

      {activeTab === 'files' && isZip && (
        <div
          data-scroll="1"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '16px 20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {/* Search inside package */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value)}
              placeholder="Search files inside package…"
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '9px',
                border: isLight ? '1px solid rgba(15, 23, 42, 0.14)' : '1px solid rgba(148,188,227,.24)',
                background: isLight ? '#ffffff' : 'rgba(148,188,227,.07)',
                color: isLight ? '#0f172a' : '#e9edf2',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '11px'
              }}
            />
            {fileFilter && (
              <button
                onClick={() => setFileFilter('')}
                style={{
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: 0,
                  cursor: 'pointer',
                  background: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(148,188,227,.15)',
                  color: isLight ? '#0f172a' : '#b5d9fd',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '11px'
                }}
              >
                Clear
              </button>
            )}
          </div>

          <div
            style={{
              borderRadius: '13px',
              border: isLight ? '1px solid rgba(15, 23, 42, 0.1)' : '1px solid rgba(148,188,227,.2)',
              overflow: 'hidden',
              background: isLight ? 'rgba(15, 23, 42, 0.02)' : 'rgba(16,22,29,.4)'
            }}
          >
            <div
              style={{
                padding: '9px 13px',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: isLight ? 'rgba(15, 23, 42, 0.65)' : 'rgba(233,237,242,.5)',
                background: isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(148,188,227,.08)',
                display: 'flex',
                justifyContent: 'space-between'
              }}
            >
              <span>{pack ? `${filteredPackList.length} of ${pack.list.length} files` : 'Files'}</span>
              <span>Click file to preview</span>
            </div>

            <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
              {filteredPackList.map((f) => {
                const lastSlash = f.path.lastIndexOf('/');
                const dir = lastSlash >= 0 ? f.path.slice(0, lastSlash + 1) : '';
                const name = f.path.slice(lastSlash + 1);
                const isSelected = packSel === f.path;

                return (
                  <div
                    key={f.path}
                    onClick={() => {
                      setPackSel(f.path);
                      setActiveTab('preview');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 14px',
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: '11.5px',
                      color: isLight ? '#0f172a' : 'rgba(233,237,242,.88)',
                      cursor: 'pointer',
                      borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.06)' : '1px solid rgba(148,188,227,.06)',
                      background: isSelected
                        ? (isLight ? 'rgba(37, 99, 235, 0.12)' : 'rgba(148,188,227,.22)')
                        : 'transparent',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(148,188,227,.12)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      <span style={{ color: isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(148,188,227,.55)' }}>{dir}</span>
                      <strong style={{ color: isSelected ? (isLight ? '#1d4ed8' : '#ffffff') : (isLight ? '#0f172a' : '#b5d9fd') }}>{name}</strong>
                    </span>
                    <span
                      style={{
                        flex: 'none',
                        color: isLight ? 'rgba(15, 23, 42, 0.55)' : 'rgba(148,188,227,.7)',
                        fontSize: '10.5px'
                      }}
                    >
                      {fmtSize(f.size)}
                    </span>
                    <span
                      style={{
                        fontSize: '9.5px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: isLight ? 'rgba(37, 99, 235, 0.08)' : 'rgba(148,188,227,.15)',
                        color: isLight ? 'var(--tint-ink, #1d4ed8)' : '#b5d9fd'
                      }}
                    >
                      View ›
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'specimen' && isFont && (
        <div
          data-scroll="1"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '20px 22px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: isLight ? 'var(--tint-ink, #1d4ed8)' : '#94bce3'
              }}
            >
              Type Custom Specimen Text
            </div>
            <input
              value={specimenText}
              onChange={(e) => onSpecimenChange(e.target.value)}
              placeholder="Type specimen text…"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '11px',
                border: isLight ? '1px solid rgba(15, 23, 42, 0.14)' : '1px solid rgba(148,188,227,.28)',
                background: isLight ? '#ffffff' : 'rgba(148,188,227,.08)',
                color: isLight ? '#0f172a' : '#e9edf2',
                fontFamily: 'Barlow, sans-serif',
                fontSize: '15px'
              }}
            />
          </div>

          {/* Size Waterfall */}
          <div
            style={{
              borderRadius: '13px',
              border: isLight ? '1px solid rgba(15, 23, 42, 0.1)' : '1px solid rgba(148,188,227,.2)',
              padding: '16px',
              background: isLight ? 'rgba(15, 23, 42, 0.02)' : 'rgba(16,22,29,.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            {[16, 22, 32, 48, 64].map((sz) => (
              <div key={sz} style={{ borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.06)' : '1px solid rgba(148,188,227,.08)', paddingBottom: '10px' }}>
                <div
                  style={{
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '9px',
                    color: isLight ? 'rgba(15, 23, 42, 0.5)' : 'rgba(148,188,227,.6)',
                    marginBottom: '4px'
                  }}
                >
                  {sz}px
                </div>
                <div style={{ fontSize: `${sz}px`, lineHeight: 1.1, wordBreak: 'break-word', color: isLight ? '#0f172a' : 'inherit' }}>
                  {specimenText || 'Archive Specimen Typography'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </>
  );
};
