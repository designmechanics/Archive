import React, { useEffect, useState } from 'react';
import gsap from 'gsap';
import { AssetEntry, ZipPack } from '../types';
import { KINDS, fmtSize, isIn } from '../data/seedData';
import { generatePreviewDoc, getPack, pickDefaultFile, restorePackFromDB } from '../services/zipService';
import { UniversalPreview } from './preview/UniversalPreview';

interface SidePanelProps {
  entry: AssetEntry | null;
  onClose: () => void;
  onNextInPool: () => void;
  specimenText: string;
  onSpecimenChange: (txt: string) => void;
  motionMultiplier: number;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  entry,
  onClose,
  onNextInPool,
  specimenText,
  onSpecimenChange,
  motionMultiplier
}) => {
  const [pack, setPack] = useState<ZipPack | null>(null);
  const [packSel, setPackSel] = useState<string | null>(null);
  const [packDoc, setPackDoc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isStudioMode, setIsStudioMode] = useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Animate studio width changes
  useEffect(() => {
    const p = panelRef.current;
    if (!p) return;
    const targetWidth = isStudioMode ? '820px' : '480px';
    gsap.to(p, {
      width: targetWidth,
      duration: 0.45 * motionMultiplier,
      ease: 'expo.out'
    });
  }, [isStudioMode, motionMultiplier]);


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
        { y: 22, opacity: 0, scale: 0.97 },
        { y: 0, opacity: 1, scale: 1, duration: 0.6 * motionMultiplier, ease: 'expo.out', delay: 0.1 * motionMultiplier }
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
        const def = pickDefaultFile(p);
        setPackSel(def);
      }
    };
    load();

    return () => {
      active = false;
    };
  }, [entry]);

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
          width: isStudioMode ? '820px' : '480px',
          maxWidth: '94vw',
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
  const isZip = entry.type === 'zip' || (pack && pack.list.length > 1);

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
    { k: 'Format', v: KINDS[entry.type]?.[0] || entry.type },
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

  return (
    <div
      ref={panelRef}
      data-panel="1"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: isStudioMode ? '820px' : '480px',
        maxWidth: '94vw',
        zIndex: 40,
        transform: 'translateX(104%)',
        background: 'var(--rail, #1d2d3d)',
        color: '#e9edf2',
        boxShadow: '-20px 0 60px rgba(29,45,61,.42)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          flex: 'none',
          padding: '20px 22px 14px',
          borderBottom: '1px solid rgba(148,188,227,.18)',
          display: 'flex',
          flexDirection: 'column',
          gap: '9px'
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
                color: '#94bce3'
              }}
            >
              {KINDS[entry.type]?.[0]} · {entry.cat}
            </div>
            <div
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
                fontSize: '27px',
                lineHeight: 1.08,
                wordBreak: 'break-word'
              }}
            >
              {entry.title}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setIsStudioMode(!isStudioMode)}
              title={isStudioMode ? 'Collapse to standard dock (480px)' : 'Expand to Studio mode (820px)'}
              style={{
                height: '32px',
                padding: '0 10px',
                border: '1px solid rgba(148,188,227,.2)',
                borderRadius: '11px',
                cursor: 'pointer',
                background: isStudioMode ? 'rgba(148,188,227,.35)' : 'rgba(148,188,227,.14)',
                color: isStudioMode ? '#ffffff' : '#b5d9fd',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>{isStudioMode ? '⇲ Dock' : '⇱ Studio'}</span>
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 'none',
                width: '32px',
                height: '32px',
                border: 0,
                borderRadius: '11px',
                cursor: 'pointer',
                background: 'rgba(148,188,227,.16)',
                color: '#e9edf2',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '13px'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <span
            style={{
              padding: '3px 9px',
              borderRadius: '99px',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '9px',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              background: 'rgba(148,188,227,.14)',
              color: '#b5d9fd',
              border: '1px solid rgba(148,188,227,.26)'
            }}
          >
            {entry.cat}
          </span>
          {entry.deps &&
            entry.deps.split(' · ').map((d) => (
              <span
                key={d}
                style={{
                  padding: '3px 9px',
                  borderRadius: '99px',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '9px',
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  background: 'rgba(148,188,227,.14)',
                  color: '#b5d9fd',
                  border: '1px solid rgba(148,188,227,.26)'
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
                  padding: '3px 9px',
                  borderRadius: '99px',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '9px',
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  background: 'rgba(148,188,227,.14)',
                  color: '#b5d9fd',
                  border: '1px solid rgba(148,188,227,.26)'
                }}
              >
                .{x}
              </span>
            ))}
        </div>
      </div>

      {/* Scrollable Body */}
      <div
        data-scroll="1"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '18px 22px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* Universal Multi-Format Preview Studio */}
        <div data-sandbox="1">
          <UniversalPreview
            entry={entry}
            pack={pack}
            packSel={packSel}
            packDoc={packDoc}
            specimenText={specimenText}
            isStudioMode={isStudioMode}
            onToggleStudioMode={() => setIsStudioMode(!isStudioMode)}
            motionMultiplier={motionMultiplier}
          />
        </div>

        {/* Font Specimen Input */}
        {isFont && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: 'rgba(233,237,242,.5)'
              }}
            >
              Type your own specimen
            </div>
            <input
              value={specimenText}
              onChange={(e) => onSpecimenChange(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 13px',
                borderRadius: '11px',
                border: '1px solid rgba(148,188,227,.28)',
                background: 'rgba(148,188,227,.08)',
                color: '#e9edf2',
                fontFamily: 'Barlow, sans-serif',
                fontSize: '14px'
              }}
            />
          </div>
        )}

        {/* Package File Tree */}
        {isZip && (
          <div style={{ borderRadius: '13px', border: '1px solid rgba(148,188,227,.2)', overflow: 'hidden' }}>
            <div
              style={{
                padding: '9px 13px',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: 'rgba(233,237,242,.5)',
                background: 'rgba(148,188,227,.08)'
              }}
            >
              {pack ? `Package · ${pack.list.length} files · click any to preview` : 'Package contents'}
            </div>
            <div data-scroll="1" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {(pack
                ? pack.list.slice().sort((a, b) => a.path.localeCompare(b.path)).slice(0, 500)
                : [
                    { path: 'index.html', size: 2150 },
                    { path: 'style.css', size: 6553 },
                    { path: 'main.js', size: 12083 },
                    { path: 'vendor/gsap.min.js', size: 72704 },
                    { path: 'assets/cover.png', size: 188416 },
                    { path: 'readme.md', size: 921 }
                  ]
              ).map((f) => {
                const lastSlash = f.path.lastIndexOf('/');
                const dir = lastSlash >= 0 ? f.path.slice(0, lastSlash + 1) : '';
                const name = f.path.slice(lastSlash + 1);
                const isSelected = packSel === f.path;

                return (
                  <div
                    key={f.path}
                    onClick={() => setPackSel(f.path)}
                    style={{
                      display: 'flex',
                      gap: '10px',
                      padding: '6px 13px',
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: '11px',
                      color: 'rgba(233,237,242,.85)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(148,188,227,.22)' : 'transparent',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(148,188,227,.12)';
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
                      <span style={{ color: 'rgba(148,188,227,.6)' }}>{dir}</span>
                      {name}
                    </span>
                    <span style={{ flex: 'none', color: 'rgba(148,188,227,.7)' }}>
                      {fmtSize(f.size)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Metadata Table */}
        <div style={{ borderRadius: '13px', border: '1px solid rgba(148,188,227,.2)', overflow: 'hidden' }}>
          {metadataList.map((m) => (
            <div
              key={m.k}
              style={{
                display: 'flex',
                gap: '12px',
                padding: '8px 13px',
                borderBottom: '1px solid rgba(148,188,227,.1)'
              }}
            >
              <span
                style={{
                  width: '104px',
                  flex: 'none',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '9.5px',
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: 'rgba(233,237,242,.45)'
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
                  color: 'rgba(233,237,242,.85)',
                  wordBreak: 'break-all'
                }}
              >
                {m.v}
              </span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleCopyOpen}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: '12px',
              cursor: 'pointer',
              border: '1px solid #416180',
              color: '#f2f2f3',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              background: 'linear-gradient(180deg, #6b91b6, #5980a6)',
              boxShadow: '0 2px 0 #2c455d, inset 0 1px 0 rgba(255,255,255,.24)',
              transition: 'transform 0.1s, box-shadow 0.1s'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(2px)';
              e.currentTarget.style.boxShadow = '0 0 0 #2c455d';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 0 #2c455d, inset 0 1px 0 rgba(255,255,255,.24)';
            }}
          >
            {copied ? 'Copied' : entry.type === 'code' || (pack && isIn('text', packSel || '')) ? 'Copy source' : 'Copy path'}
          </button>
          <button
            onClick={handleDownload}
            title="Download asset or package file"
            style={{
              padding: '11px 16px',
              borderRadius: '12px',
              cursor: 'pointer',
              border: '1px solid rgba(148,188,227,.3)',
              background: 'rgba(148,188,227,.12)',
              color: '#b5d9fd',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              transition: 'background 0.18s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(148,188,227,.22)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(148,188,227,.12)')}
          >
            Export ↓
          </button>
          <button
            onClick={onNextInPool}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: '12px',
              cursor: 'pointer',
              border: '1px solid rgba(148,188,227,.3)',
              background: 'transparent',
              color: '#b5d9fd',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              transition: 'background 0.18s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(148,188,227,.14)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Next in pool ›
          </button>
        </div>
      </div>
    </div>
  );
};
