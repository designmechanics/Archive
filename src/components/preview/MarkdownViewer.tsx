import React, { useState, useMemo, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { marked } from 'marked';

interface MarkdownViewerProps {
  content: string;
  name: string;
  motionMultiplier?: number;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  name,
  motionMultiplier = 1
}) => {
  const [viewMode, setViewMode] = useState<'preview' | 'split' | 'raw'>('preview');
  const [showToc, setShowToc] = useState(false);
  const [fontSize, setFontSize] = useState<number>(14);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const tocRef = useRef<HTMLDivElement>(null);

  // Extract table of contents (headings H1-H4)
  const toc = useMemo<TocItem[]>(() => {
    const lines = content.split('\n');
    const items: TocItem[] = [];
    lines.forEach((line) => {
      const match = line.match(/^(#{1,4})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const rawText = match[2].trim();
        // remove inline markdown from heading text for clean TOC
        const cleanText = rawText.replace(/[*_`~[\]]/g, '');
        const id = cleanText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        items.push({ id, text: cleanText, level });
      }
    });
    return items;
  }, [content]);

  // Reading statistics
  const stats = useMemo(() => {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const chars = content.length;
    const lines = content.split('\n').length;
    const readMinutes = Math.max(1, Math.ceil(words / 220));
    return { words, chars, lines, readMinutes };
  }, [content]);

  // Convert markdown to sanitized HTML with slug IDs for TOC jumping
  const htmlContent = useMemo(() => {
    try {
      // Configure marked renderer for header IDs
      const renderer = new marked.Renderer();
      renderer.heading = ({ text, depth }) => {
        const cleanText = text.replace(/<[^>]+>/g, '').trim();
        const slug = cleanText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return `<h${depth} id="${slug}" class="md-heading md-h${depth}">${text}</h${depth}>`;
      };
      
      const parsed = marked.parse(content, {
        renderer,
        gfm: true,
        breaks: true
      }) as string;

      return parsed;
    } catch (err) {
      return `<p style="color:#ef5350">Error rendering markdown: ${String(err)}</p>`;
    }
  }, [content]);

  // Search match count
  const matchCount = useMemo(() => {
    if (!searchTerm.trim()) return 0;
    try {
      const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      return (content.match(regex) || []).length;
    } catch {
      return 0;
    }
  }, [content, searchTerm]);

  // Animate TOC drawer
  useEffect(() => {
    if (!tocRef.current) return;
    if (showToc) {
      gsap.fromTo(
        tocRef.current,
        { x: -18, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.3 * motionMultiplier, ease: 'expo.out' }
      );
    }
  }, [showToc, motionMultiplier]);

  const scrollToHeading = (id: string) => {
    if (!previewContainerRef.current) return;
    const headingEl = previewContainerRef.current.querySelector(`#${id}`);
    if (headingEl) {
      headingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#090e13',
        borderRadius: '14px',
        overflow: 'hidden',
        position: 'relative',
        color: '#e9edf2',
        userSelect: 'text'
      }}
    >
      {/* Markdown Master Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(24,38,54,.95)',
          borderBottom: '1px solid rgba(148,188,227,.18)',
          zIndex: 10,
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        {/* Left: View Mode Pills & Outline Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              display: 'flex',
              background: 'rgba(16,22,29,.8)',
              borderRadius: '8px',
              padding: '2px',
              border: '1px solid rgba(148,188,227,.16)'
            }}
          >
            {(['preview', 'split', 'raw'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                style={{
                  padding: '3px 9px',
                  borderRadius: '6px',
                  border: 0,
                  cursor: 'pointer',
                  background: viewMode === m ? 'rgba(148,188,227,.28)' : 'transparent',
                  color: viewMode === m ? '#b5d9fd' : 'rgba(233,237,242,.65)',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '10px',
                  fontWeight: viewMode === m ? 600 : 400,
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  transition: 'background 0.15s, color 0.15s'
                }}
              >
                {m}
              </button>
            ))}
          </div>

          {toc.length > 0 && (
            <button
              onClick={() => setShowToc(!showToc)}
              style={{
                ...btnStyle,
                background: showToc ? 'rgba(148,188,227,.28)' : 'rgba(148,188,227,.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Toggle Table of Contents"
            >
              <span>📑 TOC</span>
              <span
                style={{
                  fontSize: '9px',
                  background: 'rgba(181,217,253,.25)',
                  color: '#b5d9fd',
                  padding: '1px 5px',
                  borderRadius: '10px'
                }}
              >
                {toc.length}
              </span>
            </button>
          )}

          {/* Font Size controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
            <button
              onClick={() => setFontSize((s) => Math.max(11, s - 1))}
              style={iconBtnStyle}
              title="Decrease Font Size"
            >
              A-
            </button>
            <span
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '10px',
                color: 'rgba(233,237,242,.7)',
                minWidth: '28px',
                textAlign: 'center'
              }}
            >
              {fontSize}px
            </span>
            <button
              onClick={() => setFontSize((s) => Math.min(20, s + 1))}
              style={iconBtnStyle}
              title="Increase Font Size"
            >
              A+
            </button>
          </div>
        </div>

        {/* Right: Search + Copy Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Quick Search */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(16,22,29,.7)',
              borderRadius: '6px',
              border: '1px solid rgba(148,188,227,.18)',
              padding: '1px 7px'
            }}
          >
            <span style={{ fontSize: '10px', color: '#94bce3', marginRight: '4px' }}>🔍</span>
            <input
              type="text"
              placeholder="Find in MD…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'transparent',
                border: 0,
                outline: 'none',
                color: '#e9edf2',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '10px',
                width: '85px'
              }}
            />
            {searchTerm && (
              <span
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '9px',
                  color: matchCount > 0 ? '#4ade80' : '#ef4444',
                  marginLeft: '4px'
                }}
              >
                {matchCount}
              </span>
            )}
          </div>

          <button
            onClick={() => copyToClipboard(content, 'md')}
            style={btnStyle}
            title="Copy Raw Markdown"
          >
            {copied === 'md' ? '✓ Copied' : 'Copy MD'}
          </button>
          <button
            onClick={() => copyToClipboard(htmlContent, 'html')}
            style={btnStyle}
            title="Copy Rendered HTML"
          >
            {copied === 'html' ? '✓ Copied' : 'Copy HTML'}
          </button>
        </div>
      </div>

      {/* Main Container Area with optional TOC sidebar */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {/* Table of Contents Drawer */}
        {showToc && toc.length > 0 && (
          <div
            ref={tocRef}
            style={{
              width: '210px',
              flex: 'none',
              background: '#0d141b',
              borderRight: '1px solid rgba(148,188,227,.15)',
              padding: '12px 10px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              zIndex: 5
            }}
          >
            <div
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '9.5px',
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: '#94bce3',
                marginBottom: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>Outline ({toc.length})</span>
              <button
                onClick={() => setShowToc(false)}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: 'rgba(233,237,242,.5)',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                ✕
              </button>
            </div>
            {toc.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                onClick={() => scrollToHeading(item.id)}
                style={{
                  fontFamily: "'Barlow', system-ui, sans-serif",
                  fontSize: item.level === 1 ? '12px' : '11px',
                  fontWeight: item.level === 1 ? 600 : 400,
                  padding: '4px 6px',
                  paddingLeft: `${(item.level - 1) * 12 + 6}px`,
                  borderRadius: '4px',
                  color: item.level === 1 ? '#b5d9fd' : 'rgba(233,237,242,.75)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  transition: 'background 0.15s, color 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(148,188,227,.12)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = item.level === 1 ? '#b5d9fd' : 'rgba(233,237,242,.75)';
                }}
              >
                {item.text}
              </div>
            ))}
          </div>
        )}

        {/* Markdown Content Area */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* Split Mode: Raw on left */}
          {(viewMode === 'raw' || viewMode === 'split') && (
            <div
              style={{
                flex: viewMode === 'split' ? 0.5 : 1,
                borderRight: viewMode === 'split' ? '1px solid rgba(148,188,227,.15)' : 'none',
                overflow: 'auto',
                padding: '16px 20px',
                background: '#070b0e',
                fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
                fontSize: `${fontSize - 1.5}px`,
                lineHeight: 1.6,
                color: '#94bce3',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {content}
            </div>
          )}

          {/* Rendered View */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div
              ref={previewContainerRef}
              style={{
                flex: viewMode === 'split' ? 0.5 : 1,
                overflow: 'auto',
                padding: '24px 32px',
                background: '#0a1017'
              }}
            >
              <style>{markdownStyles(fontSize)}</style>
              <div
                className="archive-md-body"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Markdown HUD Footer */}
      <div
        style={{
          padding: '6px 14px',
          background: 'rgba(24,38,54,.96)',
          borderTop: '1px solid rgba(148,188,227,.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '10px',
          color: 'rgba(233,237,242,.7)',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ color: '#b5d9fd', fontWeight: 600 }}>{name}</span>
          <span>{stats.lines} lines</span>
          <span>{stats.words} words</span>
          <span>{stats.chars} chars</span>
          <span style={{ color: '#94bce3' }}>~{stats.readMinutes} min read</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(233,237,242,.45)' }}>
          <span>GFM Markdown</span>
          <span style={{ color: 'rgba(148,188,227,.3)' }}>•</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '3px 8px',
  borderRadius: '6px',
  border: '1px solid rgba(148,188,227,.2)',
  background: 'rgba(148,188,227,.1)',
  color: '#b5d9fd',
  fontFamily: 'ui-monospace, Menlo, monospace',
  fontSize: '10.5px',
  cursor: 'pointer',
  transition: 'background 0.15s'
};

const iconBtnStyle: React.CSSProperties = {
  padding: '2px 6px',
  borderRadius: '4px',
  border: '1px solid rgba(148,188,227,.2)',
  background: 'rgba(148,188,227,.08)',
  color: '#94bce3',
  fontFamily: 'ui-monospace, monospace',
  fontSize: '9.5px',
  cursor: 'pointer'
};

// CSS styles injected for the markdown body
function markdownStyles(fontSize: number): string {
  return `
  .archive-md-body {
    font-family: 'Barlow', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: ${fontSize}px;
    line-height: 1.7;
    color: #e2e8f0;
    max-width: 820px;
    margin: 0 auto;
  }
  .archive-md-body h1, .archive-md-body h2, .archive-md-body h3, .archive-md-body h4 {
    font-family: 'Barlow Condensed', sans-serif;
    color: #b5d9fd;
    font-weight: 700;
    line-height: 1.25;
    margin-top: 1.4em;
    margin-bottom: 0.6em;
    border-bottom: 1px solid rgba(148,188,227,.15);
    padding-bottom: 0.25em;
  }
  .archive-md-body h1 { font-size: ${fontSize * 1.8}px; letter-spacing: -0.01em; }
  .archive-md-body h2 { font-size: ${fontSize * 1.45}px; }
  .archive-md-body h3 { font-size: ${fontSize * 1.25}px; }
  .archive-md-body h4 { font-size: ${fontSize * 1.1}px; }
  
  .archive-md-body p {
    margin-top: 0;
    margin-bottom: 1.1em;
    color: rgba(233,237,242,.88);
  }
  .archive-md-body code {
    font-family: ui-monospace, Menlo, Monaco, Consolas, monospace;
    font-size: 0.88em;
    background: rgba(148,188,227,.14);
    color: #94bce3;
    padding: 0.2em 0.4em;
    border-radius: 4px;
    border: 1px solid rgba(148,188,227,.18);
  }
  .archive-md-body pre {
    background: #060a0e;
    border: 1px solid rgba(148,188,227,.22);
    border-radius: 8px;
    padding: 12px 16px;
    overflow-x: auto;
    margin: 1.2em 0;
  }
  .archive-md-body pre code {
    background: transparent;
    padding: 0;
    border: 0;
    font-size: ${fontSize - 2}px;
    color: #d1e2f6;
  }
  .archive-md-body blockquote {
    margin: 1.2em 0;
    padding: 0.5em 1em;
    color: #94bce3;
    border-left: 3.5px solid #5980a6;
    background: rgba(89,128,166,.08);
    border-radius: 0 6px 6px 0;
  }
  .archive-md-body ul, .archive-md-body ol {
    margin: 0.8em 0 1.2em;
    padding-left: 1.6em;
  }
  .archive-md-body li {
    margin: 0.35em 0;
  }
  .archive-md-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.4em 0;
    font-size: ${fontSize - 1}px;
  }
  .archive-md-body th, .archive-md-body td {
    border: 1px solid rgba(148,188,227,.2);
    padding: 8px 12px;
    text-align: left;
  }
  .archive-md-body th {
    background: rgba(148,188,227,.12);
    color: #b5d9fd;
    font-weight: 600;
  }
  .archive-md-body tr:nth-child(even) {
    background: rgba(148,188,227,.04);
  }
  .archive-md-body hr {
    border: 0;
    border-top: 1px solid rgba(148,188,227,.2);
    margin: 2em 0;
  }
  .archive-md-body a {
    color: #60a5fa;
    text-decoration: none;
    border-bottom: 1px dotted rgba(96,165,250,.4);
  }
  .archive-md-body a:hover {
    color: #93c5fd;
    border-bottom-style: solid;
  }
  .archive-md-body img {
    max-width: 100%;
    border-radius: 8px;
    border: 1px solid rgba(148,188,227,.2);
  }
  `;
}
