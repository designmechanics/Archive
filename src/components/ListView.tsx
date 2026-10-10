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
  const isBlack = theme === 'black';

  // Fallback to 1 column if docked preview panel is taking half the screen
  const effectiveColumns: ListColumns = isPreviewOpen ? 1 : (listColumns || 1);

  // Divide entries into 1, 2, 3, or 4 columns based on effectiveColumns and listOrder
  const columnGroups = useMemo(() => {
    if (effectiveColumns <= 1 || entries.length <= 1) {
      return [entries];
    }
    const count = effectiveColumns;
    const groups: AssetEntry[][] = Array.from({ length: count }, () => []);
    if (listOrder === 'across') {
      entries.forEach((e, i) => {
        groups[i % count].push(e);
      });
    } else {
      const chunkSize = Math.ceil(entries.length / count);
      for (let c = 0; c < count; c++) {
        groups[c] = entries.slice(c * chunkSize, (c + 1) * chunkSize);
      }
    }
    return groups;
  }, [entries, effectiveColumns, listOrder]);

  // Responsive column dimensions based on effective column count and preview mode
  const colSizes = useMemo(() => {
    if (isPreviewOpen) {
      return {
        gap: '7px',
        padding: '5px 8px',
        titleFont: '15px',
        prevWidth: '32px',
        prevHeight: '26px',
        starWidth: '16px',
        assetFlex: '1.4',
        formatWidth: '60px',
        sizeWidth: '52px',
        poolFlex: '0.7',
        sourceWidth: '66px',
        dateWidth: '60px'
      };
    }
    switch (effectiveColumns) {
      case 4:
        return {
          gap: '7px',
          padding: '5px 8px',
          titleFont: '15px',
          prevWidth: '32px',
          prevHeight: '26px',
          starWidth: '16px',
          assetFlex: '1.4',
          formatWidth: '58px',
          sizeWidth: '50px',
          poolFlex: '0.7',
          sourceWidth: '64px',
          dateWidth: '60px'
        };
      case 3:
        return {
          gap: '9px',
          padding: '6px 10px',
          titleFont: '15.5px',
          prevWidth: '35px',
          prevHeight: '28px',
          starWidth: '18px',
          assetFlex: '1.5',
          formatWidth: '66px',
          sizeWidth: '58px',
          poolFlex: '0.75',
          sourceWidth: '74px',
          dateWidth: '68px'
        };
      case 2:
        return {
          gap: '10px',
          padding: '7px 12px',
          titleFont: '16px',
          prevWidth: '38px',
          prevHeight: '30px',
          starWidth: '20px',
          assetFlex: '1.6',
          formatWidth: '76px',
          sizeWidth: '66px',
          poolFlex: '0.85',
          sourceWidth: '86px',
          dateWidth: '76px'
        };
      default:
        return {
          gap: '14px',
          padding: '8px 14px',
          titleFont: '17px',
          prevWidth: '38px',
          prevHeight: '30px',
          starWidth: '20px',
          assetFlex: '1.6',
          formatWidth: '88px',
          sizeWidth: '74px',
          poolFlex: '0.85',
          sourceWidth: '110px',
          dateWidth: '84px'
        };
    }
  }, [effectiveColumns, isPreviewOpen]);

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
      background: isBlack
        ? 'rgba(255, 255, 255, 0.14)'
        : isLight
        ? 'rgba(37, 99, 235, 0.14)'
        : isMid
        ? 'rgba(15, 27, 39, 0.22)'
        : 'rgba(89, 128, 166, 0.32)',
      border: isBlack
        ? '1px solid rgba(255, 255, 255, 0.35)'
        : isLight
        ? '1px solid rgba(37, 99, 235, 0.4)'
        : isMid
        ? '1px solid rgba(15, 27, 39, 0.35)'
        : '1px solid rgba(148, 188, 227, 0.45)',
      color: isBlack ? '#ffffff' : isLight ? '#1d4ed8' : isMid ? '#09131d' : '#b5d9fd',
      fontWeight: 700,
      boxShadow: isBlack
        ? '0 1px 3px rgba(0, 0, 0, 0.6)'
        : isLight
        ? '0 1px 3px rgba(37, 99, 235, 0.12)'
        : '0 1px 3px rgba(0, 0, 0, 0.2)'
    };
  };

  const dirArrow = sortDirection === 'asc' ? '▲' : '▼';

  const renderTableHeader = (colId: string, count?: number) => (
    <div
      key={`hdr-${colId}`}
      data-list-header="1"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 15,
        display: 'flex',
        alignItems: 'center',
        gap: colSizes.gap,
        padding: colSizes.padding,
        marginBottom: '3px',
        borderRadius: '10px',
        borderBottom: isBlack
          ? '1px solid rgba(255, 255, 255, 0.16)'
          : isLight
          ? '1px solid rgba(15, 23, 42, 0.12)'
          : isMid
          ? '1px solid rgba(15, 27, 39, 0.22)'
          : '1px solid rgba(148, 188, 227, 0.22)',
        background: isBlack
          ? 'rgba(0, 0, 0, 0.96)'
          : isLight
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
      <span style={{ width: colSizes.prevWidth, flex: 'none' }}>Prev</span>
      <span style={{ width: colSizes.starWidth, flex: 'none', textAlign: 'center' }}>★</span>

      {/* Asset Title Column Header */}
      <span
        onClick={() => handleHeaderSort(sortOption === 'number' ? 'number' : 'name')}
        style={{
          flex: colSizes.assetFlex,
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
            <span style={{ fontSize: '9px', color: isBlack ? '#ffffff' : isLight ? '#2563eb' : '#38ef7d' }}>
              {dirArrow} {sortDirection.toUpperCase()}
            </span>
          )}
        </span>
      </span>

      {/* Format Column Header */}
      <span
        onClick={() => handleHeaderSort('type')}
        style={{
          width: colSizes.formatWidth,
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
            <span style={{ fontSize: '9px', color: isBlack ? '#ffffff' : isLight ? '#2563eb' : '#38ef7d' }}>
              {dirArrow}
            </span>
          )}
        </span>
      </span>

      {/* Size Column Header */}
      <span
        onClick={() => handleHeaderSort('size')}
        style={{
          width: colSizes.sizeWidth,
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
            <span style={{ fontSize: '9px', color: isBlack ? '#ffffff' : isLight ? '#2563eb' : '#38ef7d' }}>
              {dirArrow}
            </span>
          )}
        </span>
      </span>

      {/* Pool Column Header */}
      <span style={{ flex: colSizes.poolFlex, minWidth: 0 }}>Pool</span>

      {/* Source Column Header */}
      <span style={{ width: colSizes.sourceWidth, flex: 'none' }}>Source</span>

      {/* Date / Added / Mod / Age Column Header */}
      <span
        onClick={() => {
          if (sortOption === 'date_mod') handleHeaderSort('date_mod');
          else if (sortOption === 'age') handleHeaderSort('age');
          else handleHeaderSort('date_created');
        }}
        style={{
          width: colSizes.dateWidth,
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
            <span style={{ fontSize: '9px', color: isBlack ? '#ffffff' : isLight ? '#2563eb' : '#38ef7d' }}>
              {dirArrow}
            </span>
          )}
        </span>
      </span>

      {/* Column pill badge in multi-column mode */}
      {effectiveColumns > 1 && (
        <span
          style={{
            fontSize: '8.5px',
            padding: '1px 5px',
            borderRadius: '4px',
            background: isBlack ? 'rgba(255, 255, 255, 0.12)' : isLight ? 'rgba(37, 99, 235, 0.1)' : 'rgba(148, 188, 227, 0.12)',
            color: isBlack ? '#ffffff' : isLight ? '#2563eb' : '#94bce3',
            flex: 'none',
            letterSpacing: '0.06em'
          }}
          title={`Column ${colId.replace('col', '')} (${count ?? ''} items)`}
        >
          Col {colId.replace('col', '')}
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
          gap: colSizes.gap,
          padding: colSizes.padding,
          borderRadius: '13px',
          background: isBlack
            ? 'rgba(0, 0, 0, 0.72)'
            : isLight
            ? 'rgba(255, 255, 255, 0.72)'
            : 'rgba(23, 32, 44, 0.44)',
          backdropFilter: isLight ? 'contrast(1.18) saturate(1.1) brightness(1.08)' : 'brightness(2.1) contrast(1.28) saturate(1.1)',
          WebkitBackdropFilter: isLight ? 'contrast(1.18) saturate(1.1) brightness(1.08)' : 'brightness(2.1) contrast(1.28) saturate(1.1)',
          border: isBlack
            ? '1px solid rgba(255, 255, 255, 0.12)'
            : isLight
            ? '1px solid rgba(15, 23, 42, 0.08)'
            : '1px solid rgba(233, 237, 242, 0.09)',
          cursor: 'pointer',
          boxShadow: isLight ? '0 2px 8px rgba(15, 23, 42, 0.05)' : '0 2px 8px rgba(0, 0, 0, 0.22)',
          transition: 'background .2s, box-shadow .24s, border-color .2s, transform .24s'
        }}
        onMouseEnter={(el) => {
          el.currentTarget.style.background = isBlack
            ? 'rgba(24, 24, 24, 0.95)'
            : isLight
            ? 'rgba(255, 255, 255, 0.95)'
            : 'rgba(38, 54, 72, 0.72)';
          el.currentTarget.style.boxShadow = isLight ? '0 8px 24px rgba(15, 23, 42, 0.1)' : '0 10px 24px rgba(0, 0, 0, 0.35)';
          el.currentTarget.style.borderColor = isBlack ? 'rgba(255, 255, 255, 0.45)' : isLight ? 'rgba(37, 99, 235, 0.5)' : '#94bce3';
          el.currentTarget.style.transform = 'translateX(4px)';
        }}
        onMouseLeave={(el) => {
          el.currentTarget.style.background = isBlack
            ? 'rgba(0, 0, 0, 0.72)'
            : isLight
            ? 'rgba(255, 255, 255, 0.72)'
            : 'rgba(23, 32, 44, 0.44)';
          el.currentTarget.style.boxShadow = isLight ? '0 2px 8px rgba(15, 23, 42, 0.05)' : '0 2px 8px rgba(0, 0, 0, 0.22)';
          el.currentTarget.style.borderColor = isBlack
            ? 'rgba(255, 255, 255, 0.12)'
            : isLight
            ? 'rgba(15, 23, 42, 0.08)'
            : 'rgba(233, 237, 242, 0.09)';
          el.currentTarget.style.transform = 'translateX(0)';
        }}
      >
        {/* Thumbnail preview badge */}
        <span
          style={{
            width: colSizes.prevWidth,
            height: colSizes.prevHeight,
            flex: 'none',
            borderRadius: '8px',
            border: '1px solid rgba(var(--inkc, 29,31,32), .12)',
            background: e.thumb
              ? `url(${e.thumb}) center/${(e.exts && e.exts.includes('pdf')) ? 'contain #ffffff' : 'cover'} no-repeat`
              : isBlack
                ? 'repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0 3px, rgba(255,255,255,.02) 3px 7px)'
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
            width: colSizes.starWidth,
            flex: 'none',
            textAlign: 'center',
            fontSize: '13px',
            color: isStarred ? (isBlack ? '#ffffff' : accent) : 'rgba(var(--inkc, 29,31,32), .35)',
            cursor: 'pointer'
          }}
          title={isStarred ? 'Unstar' : 'Star'}
        >
          {isStarred ? '★' : '☆'}
        </span>

        {/* Title / Asset */}
        <span
          style={{
            flex: colSizes.assetFlex,
            minWidth: 0,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: isSortAsset ? 700 : 600,
            fontSize: colSizes.titleFont,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: isSortAsset ? (isBlack ? '#ffffff' : isLight ? '#1d4ed8' : isMid ? '#09131d' : '#b5d9fd') : 'inherit',
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
                background: isBlack ? '#262626' : isLight ? '#2563eb' : isMid ? '#09131d' : '#5980a6',
                color: '#ffffff',
                fontWeight: 700,
                flex: 'none'
              }}
            >
              #{extractNumber(e.title) === Number.MAX_SAFE_INTEGER ? '—' : extractNumber(e.title)}
            </span>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</span>
          {!e.thumb && e.thumbNote && (
            // Why there is no preview ("Empty file", "Damaged — file is blank")
            <span
              style={{
                flex: 'none',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontWeight: 400,
                fontSize: '10px',
                opacity: 0.6
              }}
            >
              · {e.thumbNote}
            </span>
          )}
        </span>

        {/* Format */}
        <span
          style={{
            width: colSizes.formatWidth,
            flex: 'none',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '9.5px',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: isBlack
              ? '#ffffff'
              : isSortFormat
              ? (isLight ? '#1d4ed8' : isMid ? '#09131d' : '#38ef7d')
              : isZipArchive(e) && !e.isZipInnerFile
              ? (isLight ? '#15803d' : '#38ef7d')
              : (isLight ? 'var(--tint-ink, #1d4ed8)' : '#416180'),
            fontWeight: isSortFormat || (isZipArchive(e) && !e.isZipInnerFile) ? 700 : 500,
            background: isBlack
              ? (isSortFormat ? 'rgba(255, 255, 255, 0.16)' : 'transparent')
              : isSortFormat
              ? (isLight ? 'rgba(37, 99, 235, 0.12)' : isMid ? 'rgba(15, 27, 39, 0.16)' : 'rgba(148, 188, 227, 0.16)')
              : 'transparent',
            padding: isSortFormat ? '3px 7px' : '0',
            borderRadius: '6px',
            border: isBlack
              ? (isSortFormat ? '1px solid rgba(255, 255, 255, 0.35)' : 'none')
              : isSortFormat
              ? (isLight ? '1px solid rgba(37, 99, 235, 0.28)' : isMid ? '1px solid rgba(15, 27, 39, 0.25)' : '1px solid rgba(148, 188, 227, 0.35)')
              : 'none'
          }}
        >
          {isZipArchive(e) && !e.isZipInnerFile ? `📦 ZIP · ${e.fileCount || ''}` : (KINDS[e.type]?.[0] || e.type)}
        </span>

        {/* Size */}
        <span
          style={{
            width: colSizes.sizeWidth,
            flex: 'none',
            textAlign: 'right',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '10px',
            color: isSortSize
              ? (isBlack ? '#ffffff' : isLight ? '#1d4ed8' : isMid ? '#09131d' : '#b5d9fd')
              : 'rgba(var(--inkc, 29,31,32), .65)',
            fontWeight: isSortSize ? 700 : 400,
            background: isSortSize
              ? (isBlack ? 'rgba(255, 255, 255, 0.16)' : isLight ? 'rgba(37, 99, 235, 0.12)' : isMid ? 'rgba(15, 27, 39, 0.16)' : 'rgba(148, 188, 227, 0.16)')
              : 'transparent',
            padding: isSortSize ? '3px 7px' : '0',
            borderRadius: '6px',
            border: isSortSize
              ? (isBlack ? '1px solid rgba(255, 255, 255, 0.35)' : isLight ? '1px solid rgba(37, 99, 235, 0.28)' : isMid ? '1px solid rgba(15, 27, 39, 0.25)' : '1px solid rgba(148, 188, 227, 0.35)')
              : 'none'
          }}
        >
          {e.size || (e.sizeBytes ? formatBytes(e.sizeBytes) : '—')}
        </span>

        {/* Pool */}
        <span
          style={{
            flex: colSizes.poolFlex,
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
            width: colSizes.sourceWidth,
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
            width: colSizes.dateWidth,
            flex: 'none',
            textAlign: 'right',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '10px',
            color: isSortDate
              ? (isBlack ? '#ffffff' : isLight ? '#1d4ed8' : isMid ? '#09131d' : '#b5d9fd')
              : 'rgba(var(--inkc, 29,31,32), .42)',
            fontWeight: isSortDate ? 700 : 400,
            background: isSortDate
              ? (isBlack ? 'rgba(255, 255, 255, 0.16)' : isLight ? 'rgba(37, 99, 235, 0.12)' : isMid ? 'rgba(15, 27, 39, 0.16)' : 'rgba(148, 188, 227, 0.16)')
              : 'transparent',
            padding: isSortDate ? '3px 7px' : '0',
            borderRadius: '6px',
            border: isSortDate
              ? (isBlack ? '1px solid rgba(255, 255, 255, 0.35)' : isLight ? '1px solid rgba(37, 99, 235, 0.28)' : isMid ? '1px solid rgba(15, 27, 39, 0.25)' : '1px solid rgba(148, 188, 227, 0.35)')
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
        display: effectiveColumns > 1 ? 'grid' : 'flex',
        gridTemplateColumns: effectiveColumns > 1 ? `repeat(${effectiveColumns}, minmax(0, 1fr))` : undefined,
        flexDirection: effectiveColumns === 1 ? 'column' : undefined,
        gap: effectiveColumns >= 3 ? '10px' : (effectiveColumns === 2 ? '14px' : '5px'),
        width: '100%',
        paddingBottom: '80px',
        position: 'relative'
      }}
    >
      {effectiveColumns > 1 ? (
        columnGroups.map((colEntries, colIdx) => {
          const colNum = colIdx + 1;
          return (
            <div
              key={`col-${colNum}`}
              style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 }}
            >
              {renderTableHeader(`col${colNum}`, colEntries.length)}
              {colEntries.length > 0 ? (
                colEntries.map((e) => renderRow(e))
              ) : (
                <div
                  style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '11px',
                    color: isBlack ? 'rgba(255, 255, 255, 0.4)' : isLight ? 'rgba(15, 23, 42, 0.4)' : 'rgba(233, 237, 242, 0.4)',
                    border: isBlack ? '1px dashed rgba(255, 255, 255, 0.15)' : isLight ? '1px dashed rgba(15, 23, 42, 0.15)' : '1px dashed rgba(148, 188, 227, 0.15)',
                    borderRadius: '12px',
                    marginTop: '4px'
                  }}
                >
                  No additional assets
                </div>
              )}
            </div>
          );
        })
      ) : (
        <>
          {renderTableHeader('single', entries.length)}
          {entries.map((e) => renderRow(e))}
        </>
      )}
    </div>
  );
};
