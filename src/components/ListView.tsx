import React from 'react';
import { AssetEntry } from '../types';
import { KINDS } from '../data/seedData';
import { isZipArchive } from '../services/zipService';

interface ListViewProps {
  entries: AssetEntry[];
  stars: Record<string, boolean>;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
  onSelectEntry: (id: string) => void;
  accent: string;
  onOpenZipContents?: (entry: AssetEntry) => void;
}

export const ListView: React.FC<ListViewProps> = ({
  entries,
  stars,
  onToggleStar,
  onSelectEntry,
  accent,
  onOpenZipContents
}) => {
  return (
    <div
      data-list="1"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        width: '100%',
        paddingBottom: '80px'
      }}
    >
      {/* Table Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '6px 14px 8px',
          borderBottom: '1px solid rgba(var(--inkc, 29,31,32), .16)',
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '9.5px',
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: 'rgba(var(--inkc, 29,31,32), .6)'
        }}
      >
        <span style={{ width: '40px', flex: 'none' }}>Prev</span>
        <span style={{ width: '22px', flex: 'none', textAlign: 'center' }}>★</span>
        <span style={{ flex: '1.6', minWidth: 0 }}>Asset</span>
        <span style={{ width: '96px', flex: 'none' }}>Format</span>
        <span style={{ flex: '1', minWidth: 0 }}>Pool</span>
        <span style={{ width: '120px', flex: 'none' }}>Source</span>
        <span style={{ width: '78px', flex: 'none', textAlign: 'right' }}>Added</span>
      </div>

      {/* Table Rows */}
      {entries.map((e) => {
        const isStarred = !!stars[e.id];
        return (
          <div
            key={e.id}
            data-row={e.id}
            onClick={() => {
              if (isZipArchive(e) && !e.isZipInnerFile && onOpenZipContents) {
                onOpenZipContents(e);
              } else {
                onSelectEntry(e.id);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '9px 14px',
              borderRadius: '13px',
              background: 'var(--surface, #ffffff)',
              border: '1px solid rgba(var(--inkc, 29,31,32), .1)',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(43,43,45,.1)',
              transition: 'box-shadow .24s, border-color .2s, transform .24s'
            }}
            onMouseEnter={(el) => {
              el.currentTarget.style.boxShadow = '0 10px 22px rgba(43,43,45,.14)';
              el.currentTarget.style.borderColor = '#94bce3';
              el.currentTarget.style.transform = 'translateX(3px)';
            }}
            onMouseLeave={(el) => {
              el.currentTarget.style.boxShadow = '0 1px 2px rgba(43,43,45,.1)';
              el.currentTarget.style.borderColor = 'rgba(var(--inkc, 29,31,32), .1)';
              el.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            {/* Thumbnail preview badge */}
            <span
              style={{
                width: '40px',
                height: '32px',
                flex: 'none',
                borderRadius: '8px',
                border: '1px solid rgba(var(--inkc, 29,31,32), .12)',
                background: e.thumb
                  ? `url(${e.thumb}) center/${(e.exts && e.exts.includes('pdf')) ? 'contain #ffffff' : 'cover'} no-repeat`
                  : 'repeating-linear-gradient(135deg, rgba(89,128,166,.18) 0 3px, rgba(89,128,166,.04) 3px 7px)'
              }}
            />

            {/* Star button */}
            <span
              onClick={(ev) => onToggleStar(e.id, ev)}
              style={{
                width: '22px',
                flex: 'none',
                textAlign: 'center',
                fontSize: '13px',
                color: isStarred ? accent : 'rgba(var(--inkc, 29,31,32), .35)',
                cursor: 'pointer'
              }}
              title={isStarred ? 'Unstar' : 'Star'}
            >
              {isStarred ? '★' : '☆'}
            </span>

            {/* Title */}
            <span
              style={{
                flex: '1.6',
                minWidth: 0,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 600,
                fontSize: '17px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {e.title}
            </span>

            {/* Format */}
            <span
              style={{
                width: '96px',
                flex: 'none',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: isZipArchive(e) && !e.isZipInnerFile ? '#38ef7d' : '#416180',
                fontWeight: isZipArchive(e) && !e.isZipInnerFile ? 700 : 400
              }}
            >
              {isZipArchive(e) && !e.isZipInnerFile ? `📦 ZIP · ${e.fileCount || ''}` : (KINDS[e.type]?.[0] || e.type)}
            </span>

            {/* Pool */}
            <span
              style={{
                flex: '1',
                minWidth: 0,
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '10px',
                color: 'rgba(var(--inkc, 29,31,32), .5)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {e.cat}
            </span>

            {/* Source / Author */}
            <span
              style={{
                width: '120px',
                flex: 'none',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '10px',
                color: 'rgba(var(--inkc, 29,31,32), .5)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {e.author}
            </span>

            {/* Added Date */}
            <span
              style={{
                width: '78px',
                flex: 'none',
                textAlign: 'right',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '10px',
                color: 'rgba(var(--inkc, 29,31,32), .42)'
              }}
            >
              {e.date}
            </span>
          </div>
        );
      })}
    </div>
  );
};
