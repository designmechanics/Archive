import { ThemeMode, WatchedFolder } from '../types';

interface HeaderProps {
  query: string;
  onQueryChange: (q: string) => void;
  totalCount: number;
  filteredCount: number;
  selectedPool: string | null;
  selectedFolder?: WatchedFolder | null;
  onClearFolder?: () => void;
  theme: ThemeMode;
  onThemeChange: (t: ThemeMode) => void;
  onShuffle: () => void;
  onOpenModal: () => void;
  onOpenSettings?: () => void;
  accent: string;
}


export const Header: React.FC<HeaderProps> = ({
  query,
  onQueryChange,
  totalCount,
  filteredCount,
  selectedPool,
  selectedFolder = null,
  onClearFolder,
  theme,
  onThemeChange,
  onShuffle,
  onOpenModal,
  onOpenSettings,
  accent
}) => {

  const themes: { id: ThemeMode; label: string }[] = [
    { id: 'light', label: 'Light' },
    { id: 'mid', label: 'Mid' },
    { id: 'dark', label: 'Dark' }
  ];

  return (
    <header
      style={{
        position: 'relative',
        zIndex: 20,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '14px',
        padding: '18px 26px 14px',
        background: 'var(--bg, #f2f2f3)'
      }}
    >
      {/* Search Input */}
      <div data-intro="1" style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '520px' }}>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={
            totalCount > 0
              ? `Search ${totalCount.toLocaleString()} assets — name, tag, format, author…`
              : 'Search archive — name, tag, format, author…'
          }
          style={{
            width: '100%',
            padding: '11px 16px 11px 40px',
            borderRadius: '13px',
            border: '1px solid rgba(var(--inkc, 29,31,32), .14)',
            background: 'var(--surface, #ffffff)',
            fontFamily: 'Barlow, sans-serif',
            fontSize: '14.5px',
            color: 'var(--ink, #1d1f20)',
            boxShadow: 'inset 0 2px 5px rgba(29,45,61,.07)'
          }}
        />
        <span
          style={{
            position: 'absolute',
            left: '15px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '12px',
            color: 'rgba(var(--inkc, 29,31,32), .4)',
            pointerEvents: 'none'
          }}
        >
          ⌕
        </span>
        {query && (
          <button
            onClick={() => onQueryChange('')}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              border: 0,
              background: 'transparent',
              color: 'rgba(var(--inkc, 29,31,32), .4)',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Result Count Indicator */}
      <div
        data-intro="1"
        style={{
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '10px',
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: 'rgba(var(--inkc, 29,31,32), .5)',
          whiteSpace: 'nowrap'
        }}
      >
        {filteredCount} of {totalCount} shown
        {selectedPool ? ` · Pool: ${selectedPool}` : ''}
        {selectedFolder ? ` · 📁 ${selectedFolder.path}` : ''}
      </div>

      {/* Active Filter Chips */}
      {(selectedPool || selectedFolder) && (
        <div data-intro="1" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {selectedFolder && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 8px',
                borderRadius: '8px',
                background: 'rgba(56,239,125,.12)',
                border: '1px solid rgba(56,239,125,.3)',
                color: '#38ef7d',
                fontSize: '10px',
                fontFamily: 'ui-monospace, Menlo, monospace',
                textTransform: 'uppercase'
              }}
            >
              📁 {selectedFolder.path}
              {onClearFolder && (
                <button
                  onClick={onClearFolder}
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: '#38ef7d',
                    cursor: 'pointer',
                    padding: '0 2px',
                    fontSize: '10px',
                    fontWeight: 700
                  }}
                  title="Remove folder filter"
                >
                  ✕
                </button>
              )}
            </span>
          )}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Theme Switcher */}
      <div
        data-intro="1"
        style={{
          display: 'flex',
          padding: '3px',
          gap: '2px',
          borderRadius: '13px',
          background: 'var(--well, #e3e4e6)',
          border: '1px solid rgba(var(--inkc, 29,31,32), .09)',
          boxShadow: 'inset 0 2px 5px rgba(29,45,61,.09)'
        }}
      >
        {themes.map((t) => {
          const isActive = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onThemeChange(t.id)}
              style={{
                padding: '7px 11px',
                border: 0,
                borderRadius: '10px',
                cursor: 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '13.5px',
                fontWeight: 600,
                letterSpacing: '.05em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                color: isActive ? '#f2f2f3' : 'var(--ink, #1d1f20)',
                background: isActive ? accent : 'transparent',
                transition: 'background 0.2s, color 0.2s'
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Settings & Backups Button */}
      {onOpenSettings && (
        <button
          data-intro="1"
          onClick={onOpenSettings}
          title="Open Settings & Database Backups"
          style={{
            padding: '10px 14px',
            borderRadius: '12px',
            cursor: 'pointer',
            border: '1px solid rgba(var(--inkc, 29,31,32), .14)',
            background: 'var(--surface, #ffffff)',
            color: 'var(--ink, #1d1f20)',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '.05em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 2px rgba(43,43,45,.14)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'transform 0.15s, background 0.18s, border-color 0.18s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--tint, #eef6ff)';
            e.currentTarget.style.borderColor = '#94bce3';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface, #ffffff)';
            e.currentTarget.style.borderColor = 'rgba(var(--inkc, 29,31,32), .14)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translateY(1px)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <span style={{ fontSize: '13px' }}>⚙</span>
          Settings
        </button>
      )}

      {/* Surprise Me Shuffle Button */}
      <button
        data-intro="1"
        onClick={onShuffle}

        title="Shuffle assets"
        style={{
          padding: '10px 15px',
          borderRadius: '12px',
          cursor: 'pointer',
          border: '1px solid rgba(var(--inkc, 29,31,32), .14)',
          background: 'var(--surface, #ffffff)',
          color: 'var(--ink, #1d1f20)',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '14px',
          fontWeight: 600,
          letterSpacing: '.05em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 2px rgba(43,43,45,.14)',
          transition: 'transform 0.15s, background 0.18s, border-color 0.18s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--tint, #eef6ff)';
          e.currentTarget.style.borderColor = '#94bce3';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--surface, #ffffff)';
          e.currentTarget.style.borderColor = 'rgba(var(--inkc, 29,31,32), .14)';
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'translateY(1px)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        Surprise me
      </button>

      {/* Primary Ingest Button */}
      <button
        data-intro="1"
        onClick={onOpenModal}
        style={{
          padding: '10px 16px',
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
          boxShadow: '0 2px 0 #416180, 0 6px 14px rgba(65,97,128,.3), inset 0 1px 0 rgba(255,255,255,.28)',
          transition: 'background 0.2s, transform 0.1s, box-shadow 0.1s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(180deg, #7a9ec1, #597ea3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(180deg, #6b91b6, #5980a6)';
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'translateY(2px)';
          e.currentTarget.style.boxShadow = '0 0 0 #416180, inset 0 1px 0 rgba(255,255,255,.2)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow =
            '0 2px 0 #416180, 0 6px 14px rgba(65,97,128,.3), inset 0 1px 0 rgba(255,255,255,.28)';
        }}
      >
        Ingest
      </button>
    </header>
  );
};
