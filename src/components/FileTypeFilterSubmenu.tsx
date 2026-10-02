import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FileTypeCategory,
  FILE_TYPE_CATEGORIES,
  SUPPORTED_FILE_TYPES,
  CATEGORY_COLORS,
  FileTypeFilterConfig
} from '../services/fileTypeFilterService';
import { ThemeMode } from '../types';

interface FileTypeFilterSubmenuProps {
  isOpen: boolean;
  onClose: () => void;
  config: FileTypeFilterConfig;
  onApply: (nextConfig: FileTypeFilterConfig) => void;
  theme?: ThemeMode;
  catalogCounts?: {
    byExt: Record<string, number>;
    otherCount: number;
  };
  anchorPosition?: { top: number; left: number };
}

export const FileTypeFilterSubmenu: React.FC<FileTypeFilterSubmenuProps> = ({
  isOpen,
  onClose,
  config,
  onApply,
  theme = 'dark',
  catalogCounts = { byExt: {}, otherCount: 0 },
  anchorPosition
}) => {
  const isLight = theme === 'light';
  const isBlack = theme === 'black';

  // Local draft state until "Apply" is clicked
  const [draftEnabledTypes, setDraftEnabledTypes] = useState<Record<string, boolean>>(
    () => ({ ...config.enabledTypes })
  );
  const [draftShowOther, setDraftShowOther] = useState<boolean>(config.showOtherTypes);
  const [draftActive, setDraftActive] = useState<boolean>(config.active);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const panelRef = useRef<HTMLDivElement>(null);

  // Sync draft with incoming config when submenu opens
  useEffect(() => {
    if (isOpen) {
      setDraftEnabledTypes({ ...config.enabledTypes });
      setDraftShowOther(config.showOtherTypes);
      setDraftActive(config.active);
      setSearchQuery('');
    }
  }, [isOpen, config]);

  // Keyboard navigation: Escape closes
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered file types by search query and category
  const filteredTypes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return SUPPORTED_FILE_TYPES.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.ext.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, selectedCategory]);

  // Group by category
  const groupedTypes = useMemo(() => {
    const groups: Partial<Record<FileTypeCategory, typeof SUPPORTED_FILE_TYPES>> = {};
    for (const item of filteredTypes) {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category]!.push(item);
    }
    return groups;
  }, [filteredTypes]);

  // Count active types
  const enabledCount = useMemo(() => {
    return Object.values(draftEnabledTypes).filter(Boolean).length;
  }, [draftEnabledTypes]);

  const totalTypesCount = SUPPORTED_FILE_TYPES.length;

  // Toggle individual type
  const handleToggleType = (ext: string) => {
    setDraftEnabledTypes((prev) => ({
      ...prev,
      [ext]: !prev[ext]
    }));
  };

  // Bulk actions
  const handleSelectAll = () => {
    const next: Record<string, boolean> = {};
    for (const item of SUPPORTED_FILE_TYPES) {
      next[item.ext] = true;
    }
    setDraftEnabledTypes(next);
  };

  const handleDeselectAll = () => {
    const next: Record<string, boolean> = {};
    for (const item of SUPPORTED_FILE_TYPES) {
      next[item.ext] = false;
    }
    setDraftEnabledTypes(next);
  };

  const handleResetDefaults = () => {
    const next: Record<string, boolean> = {};
    for (const item of SUPPORTED_FILE_TYPES) {
      next[item.ext] = true;
    }
    setDraftEnabledTypes(next);
    setDraftShowOther(false);
  };

  const handleToggleCategory = (cat: FileTypeCategory) => {
    const itemsInCat = SUPPORTED_FILE_TYPES.filter((t) => t.category === cat);
    const allEnabled = itemsInCat.every((t) => draftEnabledTypes[t.ext]);
    const next = { ...draftEnabledTypes };
    for (const t of itemsInCat) {
      next[t.ext] = !allEnabled;
    }
    setDraftEnabledTypes(next);
  };

  const handleApply = () => {
    // When applying, activate the filter so user's configuration immediately takes effect
    onApply({
      active: true,
      enabledTypes: draftEnabledTypes,
      showOtherTypes: draftShowOther
    });
    onClose();
  };

  if (!isOpen || typeof document === 'undefined') return null;

  // Adaptive styles
  const bg = isBlack ? '#000000' : isLight ? '#ffffff' : '#141d27';
  const border = isBlack ? '1px solid rgba(255, 255, 255, 0.2)' : isLight ? '1px solid rgba(15, 23, 42, 0.14)' : '1px solid rgba(148, 188, 227, 0.26)';
  const textPrimary = isBlack ? '#ffffff' : isLight ? '#0f172a' : '#e9edf2';
  const textSecondary = isBlack ? '#a3a3a3' : isLight ? '#475569' : 'rgba(233, 237, 242, 0.7)';
  const inputBg = isBlack ? '#111111' : isLight ? '#f1f5f9' : '#0d141c';
  const rowHover = isBlack ? 'rgba(255, 255, 255, 0.08)' : isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(148, 188, 227, 0.08)';

  // Positioning: dynamically anchored to the rail menu item and clamped strictly within viewport bounds
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const panelHeight = Math.min(680, vh - 48);

  // Position nicely beside the side menu anchor and clamp within viewport
  const idealTop = anchorPosition ? anchorPosition.top - 24 : 64;
  const styleTop = Math.max(16, Math.min(vh - panelHeight - 16, idealTop));
  const styleLeft = anchorPosition
    ? Math.max(16, Math.min(vw - 440, anchorPosition.left))
    : 264;

  return createPortal(
    <>
      <style>{`
        @keyframes slideOutSubmenuFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideOutSubmenuPop {
          from {
            opacity: 0;
            transform: translateX(-14px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
      `}</style>

      {/* Backdrop overlay for click-outside dismissal */}
      <div
        data-slideout-scrim="1"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: 'rgba(0, 0, 0, 0.32)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          animation: 'slideOutSubmenuFadeIn 0.18s ease-out'
        }}
      />

      {/* Floating Slideout Submenu Panel */}
      <div
        ref={panelRef}
        data-slideout-submenu="1"
        style={{
          position: 'fixed',
          top: `${styleTop}px`,
          left: `${styleLeft}px`,
          width: '420px',
          maxWidth: 'calc(100vw - 32px)',
          height: `${panelHeight}px`,
          maxHeight: 'calc(100vh - 32px)',
          borderRadius: '18px',
          background: bg,
          border: border,
          boxShadow: isBlack
            ? '0 24px 60px rgba(0, 0, 0, 0.95), 0 4px 16px rgba(0, 0, 0, 0.6)'
            : '0 24px 60px rgba(15, 23, 42, 0.4), 0 4px 16px rgba(15, 23, 42, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          overflow: 'hidden',
          animation: 'slideOutSubmenuPop 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: isBlack ? '1px solid rgba(255,255,255,0.12)' : isLight ? '1px solid rgba(15,23,42,0.08)' : '1px solid rgba(148,188,227,0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isBlack ? '#0a0a0a' : isLight ? '#f8fafc' : '#111822',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.16)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px'
              }}
            >
              🏷️
            </div>
            <div>
              <div
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: '17px',
                  fontWeight: 700,
                  letterSpacing: '.03em',
                  textTransform: 'uppercase',
                  color: textPrimary
                }}
              >
                Filter by File Type
              </div>
              <div style={{ fontSize: '11px', color: textSecondary }}>
                Toggle individual supported formats or miscellaneous files
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Close submenu (Esc)"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              border: 0,
              background: 'transparent',
              color: textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              transition: 'background 0.15s, color 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.1)';
              e.currentTarget.style.color = textPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = textSecondary;
            }}
          >
            ✕
          </button>
        </div>

        {/* Search & Bulk Actions Bar */}
        <div
          style={{
            padding: '10px 18px',
            borderBottom: isBlack ? '1px solid rgba(255,255,255,0.08)' : isLight ? '1px solid rgba(15,23,42,0.06)' : '1px solid rgba(148,188,227,0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flexShrink: 0
          }}
        >
          {/* Quick Search */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search format (e.g. vrm, glb, png, mp4, pdf)…"
              style={{
                width: '100%',
                padding: '7px 28px 7px 10px',
                borderRadius: '8px',
                border: isBlack ? '1px solid rgba(255,255,255,0.18)' : isLight ? '1px solid rgba(15,23,42,0.14)' : '1px solid rgba(148,188,227,0.22)',
                background: inputBg,
                color: textPrimary,
                fontFamily: 'Barlow, sans-serif',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 0,
                  color: textSecondary,
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Action Pills */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleSelectAll}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: isLight ? '1px solid rgba(15,23,42,0.12)' : '1px solid rgba(148,188,227,0.22)',
                  background: 'transparent',
                  color: textPrimary,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '10.5px',
                  cursor: 'pointer',
                  transition: 'background 0.12s'
                }}
              >
                Select All
              </button>
              <button
                onClick={handleDeselectAll}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: isLight ? '1px solid rgba(15,23,42,0.12)' : '1px solid rgba(148,188,227,0.22)',
                  background: 'transparent',
                  color: textPrimary,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '10.5px',
                  cursor: 'pointer',
                  transition: 'background 0.12s'
                }}
              >
                Clear
              </button>
              <button
                onClick={handleResetDefaults}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: isLight ? '1px solid rgba(15,23,42,0.12)' : '1px solid rgba(148,188,227,0.22)',
                  background: 'transparent',
                  color: textSecondary,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '10.5px',
                  cursor: 'pointer',
                  transition: 'background 0.12s'
                }}
              >
                Defaults
              </button>
            </div>

            <span
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '10.5px',
                color: enabledCount > 0 ? (isLight ? '#2563eb' : '#38bdf8') : '#f87171'
              }}
            >
              {enabledCount} / {totalTypesCount} active
            </span>
          </div>
        </div>

        {/* Scrollable File Types List */}
        <div
          data-scroll="1"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          {/* Categorized groups */}
          {FILE_TYPE_CATEGORIES.map((cat) => {
            const items = groupedTypes[cat];
            if (!items || items.length === 0) return null;

            const catColor = CATEGORY_COLORS[cat] || '#38bdf8';
            const catActiveCount = items.filter((t) => draftEnabledTypes[t.ext]).length;

            return (
              <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* Category Header Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 2px',
                    borderBottom: `1px solid ${isLight ? 'rgba(15,23,42,0.06)' : 'rgba(148,188,227,0.1)'}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: catColor
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: '13.5px',
                        fontWeight: 700,
                        letterSpacing: '.04em',
                        textTransform: 'uppercase',
                        color: textPrimary
                      }}
                    >
                      {cat}
                    </span>
                    <span
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '10px',
                        color: textSecondary
                      }}
                    >
                      ({catActiveCount}/{items.length})
                    </span>
                  </div>

                  <button
                    onClick={() => handleToggleCategory(cat)}
                    style={{
                      background: 'transparent',
                      border: 0,
                      color: catColor,
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '10px',
                      cursor: 'pointer',
                      padding: '2px 4px'
                    }}
                  >
                    {catActiveCount === items.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>

                {/* Individual File Type Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {items.map((item) => {
                    const isEnabled = !!draftEnabledTypes[item.ext];
                    const count = catalogCounts.byExt[item.ext] || 0;

                    return (
                      <div
                        key={item.ext}
                        onClick={() => handleToggleType(item.ext)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          background: isEnabled ? (isLight ? 'rgba(37,99,235,0.03)' : 'rgba(148,188,227,0.05)') : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.12s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = rowHover;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isEnabled ? (isLight ? 'rgba(37,99,235,0.03)' : 'rgba(148,188,227,0.05)') : 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                          {/* Extension Badge */}
                          <span
                            style={{
                              fontFamily: 'ui-monospace, Menlo, monospace',
                              fontSize: '9.5px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: '5px',
                              background: isEnabled
                                ? (item.color ? `${item.color}22` : 'rgba(56, 189, 248, 0.18)')
                                : (isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.06)'),
                              color: isEnabled ? (item.color || '#38bdf8') : textSecondary,
                              border: isEnabled
                                ? `1px solid ${item.color ? `${item.color}55` : 'rgba(56, 189, 248, 0.4)'}`
                                : '1px solid transparent',
                              minWidth: '38px',
                              textAlign: 'center'
                            }}
                          >
                            .{item.ext}
                          </span>

                          <span
                            style={{
                              fontSize: '12.5px',
                              color: isEnabled ? textPrimary : textSecondary,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {item.label}
                          </span>

                          {count > 0 && (
                            <span
                              style={{
                                fontFamily: 'ui-monospace, monospace',
                                fontSize: '10px',
                                color: isEnabled ? (isLight ? '#2563eb' : '#94bce3') : textSecondary,
                                opacity: 0.8
                              }}
                            >
                              ({count})
                            </span>
                          )}
                        </div>

                        {/* Switch Toggle */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isEnabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleType(item.ext);
                          }}
                          style={{
                            width: '34px',
                            height: '19px',
                            borderRadius: '10px',
                            background: isEnabled
                              ? (isBlack ? '#ffffff' : isLight ? '#16a34a' : '#38ef7d')
                              : (isLight ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.18)'),
                            border: 0,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '2px',
                            cursor: 'pointer',
                            flex: 'none',
                            transition: 'background 0.2s',
                            boxShadow: isEnabled ? '0 0 8px rgba(56,239,125,.35)' : 'none'
                          }}
                        >
                          <span
                            style={{
                              width: '15px',
                              height: '15px',
                              borderRadius: '50%',
                              background: isBlack ? (isEnabled ? '#000000' : '#ffffff') : '#ffffff',
                              boxShadow: '0 1px 2px rgba(0,0,0,.35)',
                              transform: isEnabled ? 'translateX(15px)' : 'translateX(0)',
                              transition: 'transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.2)'
                            }}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* SECTION: "Rest of" (Other / Unknown File Types) */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: isBlack ? '#111111' : isLight ? '#f1f5f9' : '#0d141d',
              border: draftShowOther
                ? '1px solid rgba(56, 239, 125, 0.4)'
                : isBlack
                ? '1px solid rgba(255, 255, 255, 0.14)'
                : '1px solid rgba(148, 188, 227, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginTop: '4px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: draftShowOther ? 'rgba(56, 239, 125, 0.16)' : 'rgba(148, 188, 227, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  flexShrink: 0
                }}
              >
                📦
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: '14.5px',
                      fontWeight: 700,
                      letterSpacing: '.03em',
                      textTransform: 'uppercase',
                      color: textPrimary
                    }}
                  >
                    Rest of Files (Unknown / Other)
                  </span>
                  {catalogCounts.otherCount > 0 && (
                    <span
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '10px',
                        color: draftShowOther ? '#38ef7d' : textSecondary
                      }}
                    >
                      ({catalogCounts.otherCount} in catalog)
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: textSecondary, marginTop: '2px', lineHeight: 1.35 }}>
                  Show miscellaneous files with unclassified or unknown extensions. Default is hidden.
                </div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={draftShowOther}
              onClick={() => setDraftShowOther(!draftShowOther)}
              style={{
                width: '38px',
                height: '21px',
                borderRadius: '12px',
                background: draftShowOther
                  ? (isBlack ? '#ffffff' : isLight ? '#16a34a' : '#38ef7d')
                  : (isLight ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.18)'),
                border: 0,
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
                cursor: 'pointer',
                flex: 'none',
                transition: 'background 0.2s',
                boxShadow: draftShowOther ? '0 0 8px rgba(56,239,125,.4)' : 'none'
              }}
            >
              <span
                style={{
                  width: '17px',
                  height: '17px',
                  borderRadius: '50%',
                  background: isBlack ? (draftShowOther ? '#000000' : '#ffffff') : '#ffffff',
                  boxShadow: '0 1px 2px rgba(0,0,0,.35)',
                  transform: draftShowOther ? 'translateX(17px)' : 'translateX(0)',
                  transition: 'transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.2)'
                }}
              />
            </button>
          </div>
        </div>

        {/* Footer Actions with prominent Apply button */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: isBlack ? '1px solid rgba(255,255,255,0.12)' : isLight ? '1px solid rgba(15,23,42,0.08)' : '1px solid rgba(148,188,227,0.16)',
            background: isBlack ? '#0a0a0a' : isLight ? '#f8fafc' : '#111822',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexShrink: 0
          }}
        >
          <div style={{ fontSize: '11px', color: textSecondary, fontFamily: 'ui-monospace, monospace' }}>
            {draftShowOther ? '✓ Other files included' : '✕ Other files excluded'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: isLight ? '1px solid rgba(15,23,42,0.14)' : '1px solid rgba(148,188,227,0.22)',
                background: 'transparent',
                color: textPrimary,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '13px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '.03em',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleApply}
              style={{
                padding: '7px 18px',
                borderRadius: '8px',
                border: isLight ? '1px solid #2563eb' : '1px solid #38bdf8',
                background: isLight
                  ? 'linear-gradient(180deg, #3b82f6, #2563eb)'
                  : isBlack
                  ? 'linear-gradient(180deg, #333333, #1a1a1a)'
                  : 'linear-gradient(180deg, #38bdf8, #0284c7)',
                color: '#ffffff',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '13.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.05em',
                cursor: 'pointer',
                boxShadow: isLight
                  ? '0 2px 8px rgba(37,99,235,0.35)'
                  : '0 2px 10px rgba(56,189,248,0.35)',
                transition: 'transform 0.1s, opacity 0.15s'
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'translateY(1px)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              Apply Filter
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
