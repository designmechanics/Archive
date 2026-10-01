import React, { useMemo } from 'react';
import { AssetEntry, ListColumns, ListOrder, SortOption, SortDirection, ThemeMode } from '../types';
import { KINDS } from '../data/seedData';
import { isZipArchive } from '../services/zipService';
import {
  extractNumber,
  formatBytes,
  formatDateCompact,
  formatAgeWatermark,
  SORT_CONFIGS
} from '../services/sortService';

interface ListViewProps {
  theme?: ThemeMode;
  entries: AssetEntry[];
  stars: Record<string, boolean>;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
  onSelectEntry: (id: string) => void;
  accent: string;
  onOpenZipContents?: (entry: AssetEntry) => void;
  sortOption?: SortOption;
  sortDirection?: SortDirection;
  onSortChange?: (option: SortOption, direction?: SortDirection) => void;
  listColumns?: ListColumns;
  listOrder?: ListOrder;
  onListColumnsChange?: (cols: ListColumns) => void;
  onListOrderChange?: (order: ListOrder) => void;
  isPreviewOpen?: boolean;
}

export const ListView: React.FC<ListViewProps> = ({
  theme,
  entries,
  stars,
  onToggleStar,
  onSelectEntry,
  accent,
  onOpenZipContents,
  sortOption = 'name',
  sortDirection = 'asc',
  onSortChange,
  listColumns = 1,
  listOrder = 'down',
  onListColumnsChange,
  onListOrderChange,
  isPreviewOpen = false
}) => {
  const isLight = theme === 'light';
  const isMid = theme === 'mid';

  // Fallback to 1 column if docked preview panel is taking half the screen
  const effectiveColumns: ListColumns = isPreviewOpen ? 1 : (listColumns || 1);

  // Divide entries into column 1 and column 2 when dual column is active
  const [col1, col2] = useMemo(() => {
    if (effectiveColumns === 1 || entries.length <= 1) {
      return [entries, []];
    }
    if (listOrder === 'across') {
      const c1: AssetEntry[] = [];
      const c2: AssetEntry[] = [];
      entries.forEach((e, i) => {
        if (i % 2 === 0) c1.push(e);
        else c2.push(e);
      });
      return [c1, c2];
    } else {
      const half = Math.ceil(entries.length / 2);
      return [entries.slice(0, half), entries.slice(half)];
    }
  }, [entries, effectiveColumns, listOrder]);

  const handleHeaderSort = (opt: SortOption) => {
    if (!onSortChange) return;
    if (sortOption === opt) {
      onSortChange(opt, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(opt);
    }
  };

  const isSortAsset = sortOption === 'name' || sortOption === 'number';
  const isSortFormat = sortOption === 'type';
  const isSortSize = sortOption === 'size';
  const isSortDate = sortOption === 'date_created' || sortOption === 'date_mod' || sortOption === 'age';

  const sortBadgeStyle = (active: boolean): React.CSSProperties => {
    if (!active) {
      return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 6px',
        borderRadius: '5px',
        transition: 'all 0.15s'
      };
    }
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 8px',
      borderRadius: '6px',
      background: isLight ? 'rgba(37, 99, 235, 0.14)' : isMid ? 'rgba(15, 27, 39, 0.22)' : 'rgba(89, 128, 166, 0.32)',
      border: isLight ? '1px solid rgba(37, 99, 235, 0.4)' : isMid ? '1px solid rgba(15, 27, 39, 0.35)' : '1px solid rgba(148, 188, 227, 0.45)',
      color: isLight ? '#1d4ed8' : isMid ? '#09131d' : '#b5d9fd',
      fontWeight: 700,
      boxShadow: isLight ? '0 1px 3px rgba(37, 99, 235, 0.12)' : '0 1px 3px rgba(0, 0, 0, 0.2)'
    };
  };

  const dirArrow = sortDirection === 'asc' ? '▲' : '▼';

  const renderTableHeader = (colId: string, count?: number) => (
    <div
      key={`hdr-${colId}`}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 15,
        display: 'flex',
        alignItems: 'center',
        gap: effectiveColumns === 2 ? '10px' : '14px',
        padding: effectiveColumns === 2 ? '7px 12px' : '8px 14px',
        marginBottom: '3px',
        borderRadius: '10px',
        borderBottom: isLight
          ? '1px solid rgba(15, 23, 42, 0.12)'
          : isMid
          ? '1px solid rgba(15, 27, 39, 0.22)'
          : '1px solid rgba(148, 188, 227, 0.22)',
        background: isLight
          ? 'rgba(248, 250, 252, 0.96)'
          : isMid
          ? 'rgba(115, 145, 176, 0.96)'
          : 'rgba(16, 22, 29, 0.96)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: isLight
          ? '0 4px 12px rgba(15, 23, 42, 0.05)'
          : '0 4px 14px rgba(0, 0, 0, 0.35)',
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '9.5px',
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        color: isLight ? 'rgba(15, 23, 42, 0.65)' : isMid ? 'rgba(15, 27, 39, 0.75)' : 'rgba(233, 237, 242, 0.65)'
      }}
    >
      <span style={{ width: '38px', flex: 'none' }}>Prev</span>
      <span style={{ width: '20px', flex: 'none', textAlign: 'center' }}>★</span>

      {/* Asset Title Column Header */}
      <span
        onClick={() => handleHeaderSort(sortOption === 'number' ? 'number' : 'name')}
        style={{
          flex: '1.6',
          minWidth: 0,
          cursor: onSortChange ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center'
        }}
        title={sortOption === 'number' ? 'Sort by Number' : 'Sort by Name (A–Z)'}
      >
        <span style={sortBadgeStyle(isSortAsset)}>
          <span>{sortOption === 'number' ? 'Asset #' : 'Asset'}</span>
          {isSortAsset && (
            <span style={{ fontSize: '9px', color: isLight ? '#2563eb' : '#38ef7d' }}>
              {dirArrow} {sortDirection.toUpperCase()}
            </span>
          )}
        </span>
      </span>

      {/* Format Column Header */}
      <span
        onClick={() => handleHeaderSort('type')}
        style={{
          width: effectiveColumns === 2 ? '76px' : '88px',
          flex: 'none',
          cursor: onSortChange ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center'
        }}
        title="Sort by Format / Type"
      >
        <span style={sortBadgeStyle(isSortFormat)}>
          <span>Format</span>
          {isSortFormat && (
            <span style={{ fontSize: '9px', color: isLight ? '#2563eb' : '#38ef7d' }}>
              {dirArrow}
            </span>
          )}
        </span>
      </span>

      {/* Size Column Header */}
      <span
        onClick={() => handleHeaderSort('size')}
        style={{
          width: effectiveColumns === 2 ? '66px' : '74px',
          flex: 'none',
          textAlign: 'right',
          cursor: onSortChange ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end'
        }}
        title="Sort by File Size"
      >
        <span style={sortBadgeStyle(isSortSize)}>
          <span>Size</span>
          {isSortSize && (
            <span style={{ fontSize: '9px', color: isLight ? '#2563eb' : '#38ef7d' }}>
              {dirArrow}
            </span>
          )}
        </span>
      </span>

      {/* Pool Column Header */}
      <span style={{ flex: '0.85', minWidth: 0 }}>Pool</span>

      {/* Source Column Header */}
      <span style={{ width: effectiveColumns === 2 ? '86px' : '110px', flex: 'none' }}>Source</span>

      {/* Date / Added / Mod / Age Column Header */}
      <span
        onClick={() => {
          if (sortOption === 'date_mod') handleHeaderSort('date_mod');
          else if (sortOption === 'age') handleHeaderSort('age');
          else handleHeaderSort('date_created');
        }}
        style={{
          width: effectiveColumns === 2 ? '76px' : '84px',
          flex: 'none',
          textAlign: 'right',
          cursor: onSortChange ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end'
        }}
        title={`Sort by Date: ${SORT_CONFIGS[sortOption]?.label || 'Date'}`}
      >
        <span style={sortBadgeStyle(isSortDate)}>
          <span>
            {sortOption === 'date_mod' ? 'Mod' : sortOption === 'age' ? 'Age' : 'Added'}
          </span>
          {isSortDate && (
            <span style={{ fontSize: '9px', color: isLight ? '#2563eb' : '#38ef7d' }}>
              {dirArrow}
            </span>
          )}
        </span>
      </span>

      {/* Column pill badge in dual column mode */}
      {effectiveColumns === 2 && (
        <span
          style={{
            fontSize: '8.5px',
            padding: '1px 5px',
            borderRadius: '4px',
            background: isLight ? 'rgba(37, 99, 235, 0.1)' : 'rgba(148, 188, 227, 0.12)',
            color: isLight ? '#2563eb' : '#94bce3',
            flex: 'none',
            letterSpacing: '0.06em'
          }}
          title={colId === 'col1' ? `Column 1 (${count ?? ''} items)` : `Column 2 (${count ?? ''} items)`}
        >
          {colId === 'col1' ? 'Col 1' : 'Col 2'}
        </span>
      )}
    </div>
  );

  const renderRow = (e: AssetEntry) => {
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
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: effectiveColumns === 2 ? '10px' : '14px',
          padding: effectiveColumns === 2 ? '7px 12px' : '9px 14px',
          borderRadius: '13px',
          background: isLight ? 'rgba(255, 255, 255, 0.72)' : 'rgba(23, 32, 44, 0.44)',
          backdropFilter: isLight ? 'contrast(1.18) saturate(1.1) brightness(1.08)' : 'brightness(2.1) contrast(1.28) saturate(1.1)',
          WebkitBackdropFilter: isLight ? 'contrast(1.18) saturate(1.1) brightness(1.08)' : 'brightness(2.1) contrast(1.28) saturate(1.1)',
          border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(233, 237, 242, 0.09)',
          cursor: 'pointer',
          boxShadow: isLight ? '0 2px 8px rgba(15, 23, 42, 0.05)' : '0 2px 8px rgba(0, 0, 0, 0.22)',
          transition: 'background .2s, box-shadow .24s, border-color .2s, transform .24s'
        }}
        onMouseEnter={(el) => {
          el.currentTarget.style.background = isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(38, 54, 72, 0.72)';
          el.currentTarget.style.boxShadow = isLight ? '0 8px 24px rgba(15, 23, 42, 0.1)' : '0 10px 24px rgba(0, 0, 0, 0.35)';
          el.currentTarget.style.borderColor = isLight ? 'rgba(37, 99, 235, 0.5)' : '#94bce3';
          el.currentTarget.style.transform = 'translateX(4px)';
        }}
        onMouseLeave={(el) => {
          el.currentTarget.style.background = isLight ? 'rgba(255, 255, 255, 0.72)' : 'rgba(23, 32, 44, 0.44)';
          el.currentTarget.style.boxShadow = isLight ? '0 2px 8px rgba(15, 23, 42, 0.05)' : '0 2px 8px rgba(0, 0, 0, 0.22)';
          el.currentTarget.style.borderColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(233, 237, 242, 0.09)';
          el.currentTarget.style.transform = 'translateX(0)';
        }}
      >
        {/* Thumbnail preview badge */}
        <span
          style={{
            width: '38px',
            height: '30px',
            flex: 'none',
            borderRadius: '8px',
            border: '1px solid rgba(var(--inkc, 29,31,32), .12)',
            background: e.thumb
              ? `url(${e.thumb}) center/${(e.exts && e.exts.includes('pdf')) ? 'contain #ffffff' : 'cover'} no-repeat`
              : isLight
                ? 'repeating-linear-gradient(135deg, rgba(37,99,235,.10) 0 3px, rgba(37,99,235,.02) 3px 7px)'
                : 'repeating-linear-gradient(135deg, rgba(89,128,166,.18) 0 3px, rgba(89,128,166,.04) 3px 7px)',
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {e.thumb && (e.type === 'video' || (e.exts && ['mp4', 'webm', 'mov', 'm4v'].some((x) => e.exts.includes(x)))) && (
            <span
              style={{
                fontSize: '8px',
                color: '#ffffff',
                background: 'rgba(0,0,0,0.65)',
                borderRadius: '50%',
                width: '14px',
                height: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: '1px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
              }}
            >
              ▶
            </span>
          )}
        </span>

        {/* Star button */}
        <span
          onClick={(ev) => onToggleStar(e.id, ev)}
          style={{
            width: '20px',
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

        {/* Title / Asset */}
        <span
          style={{
            flex: '1.6',
            minWidth: 0,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: isSortAsset ? 700 : 600,
            fontSize: effectiveColumns === 2 ? '16px' : '17px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: isSortAsset ? (isLight ? '#1d4ed8' : isMid ? '#09131d' : '#b5d9fd') : 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {sortOption === 'number' && (
            <span
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '4px',
                background: isLight ? '#2563eb' : isMid ? '#09131d' : '#5980a6',
                color: '#ffffff',
                fontWeight: 700,
                flex: 'none'
              }}
            >
              #{extractNumber(e.title) === Number.MAX_SAFE_INTEGER ? '—' : extractNumber(e.title)}
            </span>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</span>
        </span>

        {/* Format */}
        <span
          style={{
            width: effectiveColumns === 2 ? '76px' : '88px',
            flex: 'none',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '9.5px',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: isSortFormat
              ? (isLight ? '#1d4ed8' : isMid ? '#09131d' : '#38ef7d')
              : isZipArchive(e) && !e.isZipInnerFile
              ? (isLight ? '#15803d' : '#38ef7d')
              : (isLight ? 'var(--tint-ink, #1d4ed8)' : '#416180'),
            fontWeight: isSortFormat || (isZipArchive(e) && !e.isZipInnerFile) ? 700 : 500,
            background: isSortFormat
              ? (isLight ? 'rgba(37, 99, 235, 0.12)' : isMid ? 'rgba(15, 27, 39, 0.16)' : 'rgba(148, 188, 227, 0.16)')
              : 'transparent',
            padding: isSortFormat ? '3px 7px' : '0',
            borderRadius: '6px',
            border: isSortFormat
              ? (isLight ? '1px solid rgba(37, 99, 235, 0.28)' : isMid ? '1px solid rgba(15, 27, 39, 0.25)' : '1px solid rgba(148, 188, 227, 0.35)')
              : 'none'
          }}
        >
          {isZipArchive(e) && !e.isZipInnerFile ? `📦 ZIP · ${e.fileCount || ''}` : (KINDS[e.type]?.[0] || e.type)}
        </span>

        {/* Size */}
        <span
          style={{
            width: effectiveColumns === 2 ? '66px' : '74px',
            flex: 'none',
            textAlign: 'right',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '10px',
            color: isSortSize
              ? (isLight ? '#1d4ed8' : isMid ? '#09131d' : '#b5d9fd')
              : 'rgba(var(--inkc, 29,31,32), .65)',
            fontWeight: isSortSize ? 700 : 400,
            background: isSortSize
              ? (isLight ? 'rgba(37, 99, 235, 0.12)' : isMid ? 'rgba(15, 27, 39, 0.16)' : 'rgba(148, 188, 227, 0.16)')
              : 'transparent',
            padding: isSortSize ? '3px 7px' : '0',
            borderRadius: '6px',
            border: isSortSize
              ? (isLight ? '1px solid rgba(37, 99, 235, 0.28)' : isMid ? '1px solid rgba(15, 27, 39, 0.25)' : '1px solid rgba(148, 188, 227, 0.35)')
              : 'none'
          }}
        >
          {e.size || (e.sizeBytes ? formatBytes(e.sizeBytes) : '—')}
        </span>

        {/* Pool */}
        <span
          style={{
            flex: '0.85',
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
            width: effectiveColumns === 2 ? '86px' : '110px',
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

        {/* Added / Mod / Age Date */}
        <span
          style={{
            width: effectiveColumns === 2 ? '76px' : '84px',
            flex: 'none',
            textAlign: 'right',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '10px',
            color: isSortDate
              ? (isLight ? '#1d4ed8' : isMid ? '#09131d' : '#b5d9fd')
              : 'rgba(var(--inkc, 29,31,32), .42)',
            fontWeight: isSortDate ? 700 : 400,
            background: isSortDate
              ? (isLight ? 'rgba(37, 99, 235, 0.12)' : isMid ? 'rgba(15, 27, 39, 0.16)' : 'rgba(148, 188, 227, 0.16)')
              : 'transparent',
            padding: isSortDate ? '3px 7px' : '0',
            borderRadius: '6px',
            border: isSortDate
              ? (isLight ? '1px solid rgba(37, 99, 235, 0.28)' : isMid ? '1px solid rgba(15, 27, 39, 0.25)' : '1px solid rgba(148, 188, 227, 0.35)')
              : 'none'
          }}
          title={
            sortOption === 'date_mod'
              ? `Modified: ${e.dateModified || e.date}`
              : sortOption === 'age'
              ? `Age: ${formatAgeWatermark(e.dateCreated || e.date)} (${e.dateCreated || e.date})`
              : `Created: ${e.dateCreated || e.date}`
          }
        >
          {sortOption === 'date_mod'
            ? formatDateCompact(e.dateModified || e.date)
            : sortOption === 'age'
            ? formatAgeWatermark(e.dateCreated || e.date)
            : (e.dateCreated || e.date || '—')}
        </span>
      </div>
    );
  };

  return (
    <div
      data-list={effectiveColumns}
      style={{
        display: effectiveColumns === 2 ? 'grid' : 'flex',
        gridTemplateColumns: effectiveColumns === 2 ? 'repeat(2, minmax(0, 1fr))' : undefined,
        flexDirection: effectiveColumns === 1 ? 'column' : undefined,
        gap: effectiveColumns === 2 ? '14px' : '5px',
        width: '100%',
        paddingBottom: '80px',
        position: 'relative'
      }}
    >
      {effectiveColumns === 2 ? (
        <>
          {/* Column 1 Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 }}>
            {renderTableHeader('col1', col1.length)}
            {col1.map((e) => renderRow(e))}
          </div>

          {/* Column 2 Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 }}>
            {renderTableHeader('col2', col2.length)}
            {col2.length > 0 ? (
              col2.map((e) => renderRow(e))
            ) : (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '11px',
                  color: isLight ? 'rgba(15, 23, 42, 0.4)' : 'rgba(233, 237, 242, 0.4)',
                  border: isLight ? '1px dashed rgba(15, 23, 42, 0.15)' : '1px dashed rgba(148, 188, 227, 0.15)',
                  borderRadius: '12px',
                  marginTop: '4px'
                }}
              >
                No additional assets
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {renderTableHeader('single', entries.length)}
          {entries.map((e) => renderRow(e))}
        </>
      )}
    </div>
  );
};
