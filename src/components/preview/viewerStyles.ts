import type { CSSProperties } from 'react';

/** Shared look for the newer viewers (font, PSD, PostScript, office...), matching the existing dark viewers. */
export const viewerColors = {
  bg: '#090e13',
  bar: 'rgba(24,36,50,.92)',
  line: 'rgba(148,188,227,.14)',
  ink: '#e9edf2',
  dim: 'rgba(233,237,242,.6)',
  accent: '#b5d9fd',
  well: 'rgba(148,188,227,.08)'
};

export const viewerRoot: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  background: viewerColors.bg,
  color: viewerColors.ink,
  borderRadius: '14px',
  overflow: 'hidden',
  position: 'relative'
};

export const viewerBar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexWrap: 'wrap',
  padding: '8px 12px',
  background: viewerColors.bar,
  borderBottom: `1px solid ${viewerColors.line}`
};

export const viewerBtn = (active = false): CSSProperties => ({
  padding: '4px 10px',
  borderRadius: '8px',
  border: `1px solid ${viewerColors.line}`,
  background: active ? 'rgba(148,188,227,.25)' : 'transparent',
  color: viewerColors.ink,
  fontFamily: 'ui-monospace, Menlo, monospace',
  fontSize: '10.5px',
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  cursor: 'pointer'
});

export const viewerMono: CSSProperties = {
  fontFamily: 'ui-monospace, Menlo, monospace',
  fontSize: '11px',
  color: viewerColors.dim
};

export const viewerMessage: CSSProperties = {
  margin: 'auto',
  padding: '24px',
  textAlign: 'center',
  fontFamily: 'ui-monospace, Menlo, monospace',
  fontSize: '12px',
  color: viewerColors.dim,
  lineHeight: 1.6
};
