import React, { useState, useEffect, useMemo, Suspense } from 'react';
import gsap from 'gsap';
import { AssetEntry, ZipPack, ThemeMode } from '../../types';
import { getPackBlob } from '../../services/db';
import { detectFormat, PreviewFormat, BINARY_FORMATS } from './types';
import { ImageViewer } from './ImageViewer';
import { VideoViewer } from './VideoViewer';
import { AudioViewer } from './AudioViewer';
import { VectorViewer } from './VectorViewer';
import { MarkdownViewer } from './MarkdownViewer';
import { DocViewer } from './DocViewer';
import { CodeViewer } from './CodeViewer';
import { JsonViewer } from './JsonViewer';
import { CssViewer } from './CssViewer';
import { HtmlViewer } from './HtmlViewer';
import { PdfViewer } from './PdfViewer';

// Heavier viewers (and their libraries) load only when a file of that kind is opened
const ThreeViewer = React.lazy(() => import('./ThreeViewer').then((m) => ({ default: m.ThreeViewer })));
const FontViewer = React.lazy(() => import('./FontViewer'));
const Type1Viewer = React.lazy(() => import('./Type1Viewer'));
const LegacyOfficeViewer = React.lazy(() => import('./LegacyOfficeViewer'));
const BinaryViewer = React.lazy(() => import('./BinaryViewer'));
const BlendViewer = React.lazy(() => import('./BlendViewer'));
const DatabaseViewer = React.lazy(() => import('./DatabaseViewer'));
const PsdViewer = React.lazy(() => import('./PsdViewer'));
const PostscriptViewer = React.lazy(() => import('./PostscriptViewer'));
const RasterViewer = React.lazy(() => import('./RasterViewer'));
const SwfViewer = React.lazy(() => import('./SwfViewer'));
const OfficeViewer = React.lazy(() => import('./OfficeViewer'));

interface UniversalPreviewProps {
  theme?: ThemeMode;
  entry: AssetEntry;
  pack?: ZipPack | null;
  packSel?: string | null;
  packDoc?: string | null;
  specimenText?: string;
  isStudioMode: boolean;
  onToggleStudioMode: () => void;
  motionMultiplier?: number;
}

export const UniversalPreview: React.FC<UniversalPreviewProps> = ({
  theme,
  entry,
  pack,
  packSel,
  packDoc,
  specimenText = 'ARCHIVE TYPOGRAPHY SPECIMEN',
  isStudioMode,
  onToggleStudioMode,
  motionMultiplier = 1
}) => {
  const isLight = theme === 'light';
  const isBlack = theme === 'black';
  // Helper to compute initial format synchronously
  const computeInitialFormat = (): PreviewFormat => {
    if (pack && packSel) {
      const ext = packSel.split('.').pop() || '';
      return detectFormat(ext, packSel) || 'code';
    }
    const titleExt = (entry.title || '').split('.').pop() || '';
    if (titleExt) {
      const titleFmt = detectFormat(titleExt, entry.title);
      if (titleFmt && titleFmt !== 'code') return titleFmt;
    }
    if (entry.exts && entry.exts.length > 0) {
      for (const ext of entry.exts) {
        const fmt = detectFormat(ext, entry.title);
        if (fmt && fmt !== 'code') return fmt;
      }
    }
    switch (entry.type) {
      case 'photo':
        return 'image';
      case 'psd':
        return 'psd';
      case 'ai':
        return 'postscript';
      case 'svg':
      case 'icon':
        return 'vector';
      case 'video':
      case 'prproj':
        return 'video';
      case 'font':
        return 'font';
      case '3d':
        return '3d';
      case 'raw':
        return 'raster';
      case 'swf':
        return 'swf';
      case 'doc':
        return 'office';
      case 'code':
        return 'html';
      default:
        return 'code';
    }
  };

  const detectedFormat = useMemo<PreviewFormat>(computeInitialFormat, [entry, pack, packSel]);
  const [activeFormat, setActiveFormat] = useState<PreviewFormat>(computeInitialFormat);
  const [contentString, setContentString] = useState<string>('');

  // Where the server serves this file from. A file inside a disk-indexed archive is addressed by
  // the archive's path plus the inner path (the inner id is not a database id).
  const fileUrl = useMemo(() => {
    if (entry.isZipInnerFile && entry.filePath && entry.zipInnerPath) {
      return `/api/file?path=${encodeURIComponent(entry.filePath)}&entry=${encodeURIComponent(entry.zipInnerPath)}`;
    }
    return entry.id ? `/api/file?id=${encodeURIComponent(entry.id)}` : '';
  }, [entry]);

  // Query string for the optional Ghostscript renderer (whole files on disk only)
  const serverParams = useMemo(() => {
    if (entry.isZipInnerFile || packSel) return undefined;
    if (entry.filePath) return `path=${encodeURIComponent(entry.filePath)}`;
    return entry.id ? `id=${encodeURIComponent(entry.id)}` : undefined;
  }, [entry, packSel]);

  const initialMediaUrl = fileUrl && BINARY_FORMATS.includes(detectedFormat) ? fileUrl : null;
  const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(initialMediaUrl);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Set activeFormat when detectedFormat changes
  useEffect(() => {
    setActiveFormat(detectedFormat);
  }, [detectedFormat]);

  // Animate format transition
  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0.88, y: 6 },
        { opacity: 1, y: 0, duration: 0.35 * motionMultiplier, ease: 'power2.out' }
      );
    }
  }, [activeFormat, packSel, motionMultiplier]);

  const activeBlobUrlRef = React.useRef<string | null>(null);

  // Clean up blob URL ONLY on component unmount
  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current && activeBlobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, []);

  // Load content or create blob URLs
  useEffect(() => {
    let isCancelled = false;

    const loadContent = async () => {
      setIsLoading(true);

      try {
        let blobToUse: Blob | null = null;

        if (pack && packSel) {
          // If viewing text/code-based formats
          if (
            ['markdown', 'doc', 'code', 'json', 'css', 'html', 'vector'].includes(activeFormat) &&
            typeof pack.text === 'function'
          ) {
            const txt = await pack.text(packSel);
            if (!isCancelled) {
              setContentString(txt);
              setIsLoading(false);
            }
            return;
          }

          // If viewing media/binary formats
          if (typeof pack.blob === 'function') {
            blobToUse = await pack.blob(packSel);
          }
        }

        // Direct rawBlob from pack (for loose files or single packs)
        if (!blobToUse && pack?.rawBlob) {
          blobToUse = pack.rawBlob;
        }

        // Direct fallback from IndexedDB packs/blobs store if pack object wasn't in memory
        if (!blobToUse && entry.packId) {
          const stored = await getPackBlob(entry.packId);
          if (stored?.blob) {
            blobToUse = stored.blob;
          }
        }
        if (!blobToUse && entry.id) {
          const stored = await getPackBlob(entry.id);
          if (stored?.blob) {
            blobToUse = stored.blob;
          }
        }

        // If we have a blob and format is media/pdf
        if (blobToUse && !isCancelled) {
          if (BINARY_FORMATS.includes(activeFormat)) {
            const newUrl = URL.createObjectURL(blobToUse);
            if (activeBlobUrlRef.current && activeBlobUrlRef.current.startsWith('blob:') && activeBlobUrlRef.current !== newUrl) {
              URL.revokeObjectURL(activeBlobUrlRef.current);
            }
            activeBlobUrlRef.current = newUrl;
            setMediaBlobUrl(newUrl);
            setIsLoading(false);
            return;
          } else if (typeof blobToUse.text === 'function') {
            const txt = await blobToUse.text();
            if (!isCancelled) {
              setContentString(txt);
              setIsLoading(false);
            }
            return;
          }
        }

        // Direct fallback: if no in-memory blob, but file is available on server /api/file
        if (!blobToUse && fileUrl && !isCancelled) {
          if (BINARY_FORMATS.includes(activeFormat)) {
            setMediaBlobUrl(fileUrl);
            setIsLoading(false);
            return;
          } else if (['code', 'markdown', 'doc', 'json', 'css', 'html', 'vector'].includes(activeFormat)) {
            try {
              const res = await fetch(fileUrl);
              if (res.ok) {
                const txt = await res.text();
                if (!isCancelled) {
                  setContentString(txt);
                  setIsLoading(false);
                  return;
                }
              }
            } catch {}
          }
        }

        // Fallback for mock/prototype entry without zip pack
        if (!pack && !blobToUse) {
          if (entry.demo) {
            setContentString(entry.demo);
          } else if (entry.type === 'font') {
            setContentString(
              `# Font Specimen: ${entry.title}\n\n` +
              `> Category: ${entry.cat} | Author: ${entry.author} | Added: ${entry.date}\n\n` +
              `## Display Specimen\n\n` +
              `# ${specimenText}\n\n` +
              `## Alphabet\n\n` +
              `ABCDEFGHIJKLMNOPQRSTUVWXYZ\n` +
              `abcdefghijklmnopqrstuvwxyz\n` +
              `0123456789 !@#$%^&*()_+-=[]{}|;':",.<>?/`
            );
          } else {
            setContentString(
              `// Archive Asset: ${entry.title}\n// Category: ${entry.cat}\n// Type: ${entry.type}\n// Size: ${entry.size}\n\n// Dependencies: ${entry.deps || 'none'}`
            );
          }
        }
      } catch (err) {
        console.error('Error loading preview content:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadContent();

    return () => {
      isCancelled = true;
    };
  }, [pack, packSel, entry, activeFormat, specimenText]);

  // List of format badges/alternatives available for this asset
  const availableFormats = useMemo<PreviewFormat[]>(() => {
    const formats: PreviewFormat[] = [detectedFormat];
    
    // Always provide Code as an alternative for text, vector, md, json, css, html
    if (['vector', 'markdown', 'doc', 'json', 'css', 'html'].includes(detectedFormat)) {
      if (!formats.includes('code')) formats.push('code');
    }

    // Markdown can also offer Doc view
    if (detectedFormat === 'markdown' && !formats.includes('doc')) {
      formats.push('doc');
    }

    // HTML can offer HTML Sandbox and Code
    if (detectedFormat === 'html' && !formats.includes('code')) {
      formats.push('code');
    }

    return formats;
  }, [detectedFormat]);

  const activeTitle = packSel ? packSel.split('/').pop() || packSel : entry.title;
  // Extension of the file being shown (inner file of an archive, else the asset itself)
  const activeExt = (
    (packSel ? packSel.split('.').pop() : entry.isZipInnerFile && entry.zipInnerPath ? entry.zipInnerPath.split('.').pop() : entry.title.split('.').pop()) ||
    entry.exts?.[0] ||
    ''
  ).toLowerCase();
  const lazyFallback = (
    <div style={{ margin: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: 11, opacity: 0.7 }}>Loading viewer…</div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        flex: 1,
        minHeight: 0,
        borderRadius: '14px',
        overflow: 'hidden',
        border: isBlack ? '1px solid rgba(255, 255, 255, 0.15)' : isLight ? '1px solid rgba(15, 23, 42, 0.1)' : '1px solid rgba(148,188,227,.22)',
        background: isBlack ? '#000000' : isLight ? '#f8fafc' : '#090e13',
        position: 'relative'
      }}
    >
      {/* Universal Preview Master Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: isBlack ? 'rgba(0, 0, 0, 0.96)' : isLight ? 'rgba(241, 245, 249, 0.96)' : 'rgba(24,36,50,.96)',
          borderBottom: isBlack ? '1px solid rgba(255, 255, 255, 0.12)' : isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(148,188,227,.18)',
          zIndex: 12,
          flexShrink: 0
        }}
      >
        {/* Left: Active File / Format Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '99px',
              background: isBlack ? '#ffffff' : isLight ? '#2563eb' : '#94bce3',
              boxShadow: isBlack ? '0 0 8px rgba(255, 255, 255, 0.6)' : isLight ? '0 0 8px rgba(37, 99, 235, 0.5)' : '0 0 8px rgba(148,188,227,.6)'
            }}
          />
          <span
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: isBlack ? '#ffffff' : isLight ? '#0f172a' : '#b5d9fd',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '220px'
            }}
          >
            {activeTitle}
          </span>

          {/* Format Override Tabs if multiple views apply */}
          {availableFormats.length > 1 && (
            <div
              style={{
                display: 'flex',
                background: isBlack ? '#141414' : isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(16,22,29,.85)',
                borderRadius: '6px',
                padding: '1px',
                border: isBlack ? '1px solid rgba(255, 255, 255, 0.15)' : isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(148,188,227,.15)'
              }}
            >
              {availableFormats.map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setActiveFormat(fmt)}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '5px',
                    border: 0,
                    cursor: 'pointer',
                    background: activeFormat === fmt
                      ? (isBlack ? '#ffffff' : isLight ? '#ffffff' : 'rgba(148,188,227,.28)')
                      : 'transparent',
                    color: activeFormat === fmt
                      ? (isBlack ? '#000000' : isLight ? '#0f172a' : '#b5d9fd')
                      : (isBlack ? 'rgba(255, 255, 255, 0.6)' : isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(233,237,242,.6)'),
                    boxShadow: activeFormat === fmt && isLight ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    letterSpacing: '.06em',
                    fontWeight: activeFormat === fmt ? 600 : 400
                  }}
                >
                  {fmt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Studio Mode Expander Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onToggleStudioMode}
            title={isStudioMode ? 'Collapse to standard dock width (480px)' : 'Expand to Studio Width (820px)'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              borderRadius: '6px',
              border: isBlack ? '1px solid rgba(255, 255, 255, 0.2)' : isLight ? '1px solid rgba(15, 23, 42, 0.12)' : '1px solid rgba(148,188,227,.24)',
              background: isBlack
                ? (isStudioMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)')
                : isStudioMode
                ? (isLight ? 'rgba(37, 99, 235, 0.15)' : 'rgba(148,188,227,.25)')
                : (isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(148,188,227,.1)'),
              color: isBlack
                ? '#ffffff'
                : isStudioMode
                ? (isLight ? '#1d4ed8' : '#ffffff')
                : (isLight ? '#0f172a' : '#b5d9fd'),
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <span>{isStudioMode ? '⇲ Docked' : '⇱ Studio Mode'}</span>
            <span
              style={{
                fontSize: '9px',
                background: isBlack ? 'rgba(255, 255, 255, 0.15)' : isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(181,217,253,.2)',
                color: isBlack ? '#ffffff' : isLight ? '#0f172a' : 'inherit',
                padding: '1px 4px',
                borderRadius: '4px'
              }}
            >
              {isStudioMode ? '88vw' : '56vw'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Specialized Viewport Container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {isLoading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '11px',
              color: isBlack ? '#ffffff' : isLight ? 'var(--tint-ink, #1d4ed8)' : '#94bce3',
              letterSpacing: '.1em',
              textTransform: 'uppercase'
            }}
          >
            Loading preview…
          </div>
        ) : (
          renderViewer()
        )}
      </div>
    </div>
  );

  function renderViewer(): React.ReactNode {
    switch (activeFormat) {
      case 'image':
        return (
          <ImageViewer
            src={mediaBlobUrl || ''}
            name={activeTitle}
            theme={theme}
          />
        );

      case 'video':
        return (
          <VideoViewer
            src={mediaBlobUrl || ''}
            name={activeTitle}
          />
        );

      case 'audio':
        return (
          <AudioViewer
            src={mediaBlobUrl || ''}
            name={activeTitle}
          />
        );

      case 'font':
        return (
          <Suspense fallback={lazyFallback}>
            <FontViewer src={mediaBlobUrl || fileUrl} name={activeTitle} ext={activeExt} />
          </Suspense>
        );

      case 'type1':
        return (
          <Suspense fallback={lazyFallback}>
            <Type1Viewer src={mediaBlobUrl || fileUrl} name={activeTitle} />
          </Suspense>
        );

      case 'legacydoc':
        return (
          <Suspense fallback={lazyFallback}>
            <LegacyOfficeViewer src={mediaBlobUrl || fileUrl} name={activeTitle} ext={activeExt} />
          </Suspense>
        );

      case 'blend':
        return (
          <Suspense fallback={lazyFallback}>
            <BlendViewer src={mediaBlobUrl || fileUrl} name={activeTitle} />
          </Suspense>
        );

      case 'binary':
        return (
          <Suspense fallback={lazyFallback}>
            <BinaryViewer src={mediaBlobUrl || fileUrl} name={activeTitle} />
          </Suspense>
        );

      case 'database':
        return (
          <Suspense fallback={lazyFallback}>
            <DatabaseViewer src={mediaBlobUrl || fileUrl} name={activeTitle} serverParams={serverParams} />
          </Suspense>
        );

      case 'psd':
        return (
          <Suspense fallback={lazyFallback}>
            <PsdViewer src={mediaBlobUrl || fileUrl} name={activeTitle} />
          </Suspense>
        );

      case 'postscript':
        return (
          <Suspense fallback={lazyFallback}>
            <PostscriptViewer
              src={mediaBlobUrl || fileUrl}
              name={activeTitle}
              // Ghostscript is only ever used for EPS files
              serverParams={activeExt === 'eps' ? serverParams : undefined}
            />
          </Suspense>
        );

      case 'raster':
        return (
          <Suspense fallback={lazyFallback}>
            <RasterViewer
              src={mediaBlobUrl || fileUrl}
              name={activeTitle}
              mode={activeExt === 'tif' || activeExt === 'tiff' ? 'tiff' : 'raw'}
            />
          </Suspense>
        );

      case 'swf':
        return (
          <Suspense fallback={lazyFallback}>
            <SwfViewer src={mediaBlobUrl || fileUrl} name={activeTitle} />
          </Suspense>
        );

      case 'office':
        return (
          <Suspense fallback={lazyFallback}>
            <OfficeViewer src={mediaBlobUrl || fileUrl} name={activeTitle} ext={activeExt} />
          </Suspense>
        );

      case '3d':
        return (
          <Suspense fallback={lazyFallback}>
            <ThreeViewer
              src={mediaBlobUrl || fileUrl}
              name={activeTitle}
              ext={activeExt}
              theme={theme}
            />
          </Suspense>
        );

      case 'vector':
        return (
          <VectorViewer
            content={contentString || entry.demo || '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="#94bce3" stroke-width="4" fill="none"/></svg>'}
            name={activeTitle}
          />
        );

      case 'markdown':
        return (
          <MarkdownViewer
            content={contentString || entry.demo || `# ${entry.title}\n\n*No markdown content found.*`}
            name={activeTitle}
            motionMultiplier={motionMultiplier}
          />
        );

      case 'doc':
        return (
          <DocViewer
            content={contentString || entry.demo || entry.title}
            name={activeTitle}
          />
        );

      case 'json':
        return (
          <JsonViewer
            jsonString={contentString || '{}'}
            name={activeTitle}
          />
        );

      case 'css':
        return (
          <CssViewer
            css={contentString || '/* Empty CSS */'}
            name={activeTitle}
          />
        );

      case 'html':
        return (
          <HtmlViewer
            htmlContent={packDoc || contentString || entry.demo || '<h1>Preview</h1>'}
            name={activeTitle}
          />
        );

      case 'pdf':
        return (
          <PdfViewer
            src={mediaBlobUrl || ''}
            name={activeTitle}
          />
        );

      case 'code':
      default:
        return (
          <CodeViewer
            code={contentString || entry.demo || `// ${entry.title}\n// Format: ${entry.type}`}
            name={activeTitle}
            ext={packSel?.split('.').pop() || entry.exts?.[0] || 'txt'}
          />
        );
    }
  }
};
