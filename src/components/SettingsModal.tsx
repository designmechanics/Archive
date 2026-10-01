import React, { useState, useEffect } from 'react';
import { DatabaseStats, DatabaseBackup, api } from '../services/api';
import { ThemeMode, Density, WatchedFolder, Pool } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbStats: DatabaseStats | null;
  onOptimizeDb: () => Promise<void>;
  onClearAll: () => Promise<void>;
  theme: ThemeMode;
  onThemeChange: (t: ThemeMode) => void;
  density: Density;
  onDensityChange: (d: Density) => void;
  folders: WatchedFolder[];
  onRemoveFolder?: (id: string) => Promise<void> | void;
  onAddFolder?: (path: string) => Promise<void> | void;
  onToggleFolder?: (id: string, enabled: boolean) => Promise<void> | void;
  deferFolderIngestion?: boolean;
  onToggleDeferFolderIngestion?: (defer: boolean) => void;
  pools?: Pool[];
  onAddPool?: (pool: { name: string; description?: string; color?: string; sortOrder?: number }) => Promise<void>;
  onEditPool?: (id: string, updates: Partial<Pool>) => Promise<void>;
  onDeletePool?: (id: string, reassignTo?: string) => Promise<void>;
  onReorderPools?: (newPools: Pool[]) => Promise<void>;
  poolCounts?: Record<string, number>;
  motionMultiplier?: number;
  onMotionChange?: (m: number) => void;
}

type SettingsTab = 'database' | 'interface' | 'pools' | 'folders';

const POOL_PRESET_COLORS = [
  '#94bce3', // Steel blue (Archive signature)
  '#60a5fa', // Blue
  '#38bdf8', // Sky
  '#2dd4bf', // Teal
  '#4ade80', // Mint / green
  '#a3e635', // Lime
  '#facc15', // Amber / gold
  '#fb923c', // Orange
  '#f87171', // Coral / red
  '#f472b6', // Rose / pink
  '#c084fc', // Purple
  '#a78bfa', // Lavender
  '#94a3b8'  // Slate
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  dbStats,
  onOptimizeDb,
  onClearAll,
  theme,
  onThemeChange,
  density,
  onDensityChange,
  folders,
  onRemoveFolder,
  onAddFolder,
  onToggleFolder,
  deferFolderIngestion = true,
  onToggleDeferFolderIngestion,
  pools = [],
  onAddPool,
  onEditPool,
  onDeletePool,
  onReorderPools,
  poolCounts = {}
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('database');
  const [backups, setBackups] = useState<DatabaseBackup[]>([]);
  const [backingUp, setBackingUp] = useState(false);
  const [lastBackupMsg, setLastBackupMsg] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState('');

  // Pools Management State
  const [isCreatingPool, setIsCreatingPool] = useState(false);
  const [newPoolName, setNewPoolName] = useState('');
  const [newPoolColor, setNewPoolColor] = useState('#94bce3');
  const [newPoolDesc, setNewPoolDesc] = useState('');
  const [poolError, setPoolError] = useState<string | null>(null);
  const [poolSearch, setPoolSearch] = useState('');
  const [poolSuccessMsg, setPoolSuccessMsg] = useState<string | null>(null);

  // Edit Pool State
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [editPoolName, setEditPoolName] = useState('');
  const [editPoolColor, setEditPoolColor] = useState('#94bce3');
  const [editPoolDesc, setEditPoolDesc] = useState('');

  // Delete Pool State
  const [deletingPool, setDeletingPool] = useState<Pool | null>(null);
  const [reassignTarget, setReassignTarget] = useState<string>('Uncategorized');
  const [isProcessingPool, setIsProcessingPool] = useState(false);


  // Fetch backups whenever modal opens or database tab is selected
  useEffect(() => {
    if (isOpen) {
      loadBackups();
    }
  }, [isOpen]);

  const loadBackups = async () => {
    const list = await api.listBackups();
    setBackups(list);
  };

  if (!isOpen) return null;

  const handleCreateBackup = async () => {
    setBackingUp(true);
    setLastBackupMsg(null);
    try {
      const backup = await api.createBackup();
      if (backup) {
        setLastBackupMsg(`✓ Backup saved: ${backup.fileName} (${backup.sizeFormatted})`);
        await loadBackups();
      } else {
        setLastBackupMsg('Failed to create backup.');
      }
    } catch (err) {
      setLastBackupMsg('Error during backup.');
    } finally {
      setBackingUp(false);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      await onOptimizeDb();
    } finally {
      setOptimizing(false);
    }
  };

  const handleAddFolderSubmit = () => {
    if (newFolderPath.trim() && onAddFolder) {
      onAddFolder(newFolderPath.trim());
      setNewFolderPath('');
    }
  };

  const handleCreatePool = async () => {
    if (!newPoolName.trim()) {
      setPoolError('Pool name cannot be empty.');
      return;
    }
    const cleanName = newPoolName.trim();
    if (pools.some((p) => p.name.toLowerCase() === cleanName.toLowerCase())) {
      setPoolError(`A pool named "${cleanName}" already exists.`);
      return;
    }

    setPoolError(null);
    setIsProcessingPool(true);
    try {
      if (onAddPool) {
        await onAddPool({
          name: cleanName,
          color: newPoolColor,
          description: newPoolDesc.trim()
        });
      }
      setNewPoolName('');
      setNewPoolDesc('');
      setIsCreatingPool(false);
      setPoolSuccessMsg(`✓ Created pool "${cleanName}"`);
      setTimeout(() => setPoolSuccessMsg(null), 3000);
    } catch (err: any) {
      setPoolError(err.message || 'Failed to create pool.');
    } finally {
      setIsProcessingPool(false);
    }
  };

  const startEditPool = (pool: Pool) => {
    setEditingPoolId(pool.id);
    setEditPoolName(pool.name);
    setEditPoolColor(pool.color || '#94bce3');
    setEditPoolDesc(pool.description || '');
    setPoolError(null);
  };

  const handleSaveEditPool = async () => {
    if (!editingPoolId) return;
    if (!editPoolName.trim()) {
      setPoolError('Pool name cannot be empty.');
      return;
    }
    const cleanName = editPoolName.trim();
    const isDuplicate = pools.some(
      (p) => p.id !== editingPoolId && p.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (isDuplicate) {
      setPoolError(`Another pool named "${cleanName}" already exists.`);
      return;
    }

    setPoolError(null);
    setIsProcessingPool(true);
    try {
      if (onEditPool) {
        await onEditPool(editingPoolId, {
          name: cleanName,
          color: editPoolColor,
          description: editPoolDesc.trim()
        });
      }
      setEditingPoolId(null);
      setPoolSuccessMsg(`✓ Updated pool "${cleanName}"`);
      setTimeout(() => setPoolSuccessMsg(null), 3000);
    } catch (err: any) {
      setPoolError(err.message || 'Failed to update pool.');
    } finally {
      setIsProcessingPool(false);
    }
  };

  const handleDeletePoolConfirm = async () => {
    if (!deletingPool) return;
    setIsProcessingPool(true);
    try {
      if (onDeletePool) {
        await onDeletePool(deletingPool.id, reassignTarget);
      }
      const deletedName = deletingPool.name;
      setDeletingPool(null);
      setPoolSuccessMsg(`✓ Deleted pool "${deletedName}"`);
      setTimeout(() => setPoolSuccessMsg(null), 3000);
    } catch (err: any) {
      setPoolError(err.message || 'Failed to delete pool.');
    } finally {
      setIsProcessingPool(false);
    }
  };

  // Reorder & Sort pools handlers
  const handleMovePool = async (id: string, direction: 'up' | 'down') => {
    if (isProcessingPool || !onReorderPools) return;
    const currentIndex = pools.findIndex((p) => p.id === id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= pools.length) return;

    setIsProcessingPool(true);
    setPoolError(null);
    try {
      const newPools = [...pools];
      const [moved] = newPools.splice(currentIndex, 1);
      newPools.splice(targetIndex, 0, moved);
      await onReorderPools(newPools);
    } catch (err: any) {
      setPoolError(err.message || 'Failed to reorder pools.');
    } finally {
      setIsProcessingPool(false);
    }
  };

  const handleSortPools = async (type: 'az' | 'za' | 'count' | 'default') => {
    if (isProcessingPool || !onReorderPools || pools.length === 0) return;

    setIsProcessingPool(true);
    setPoolError(null);
    try {
      let sorted = [...pools];
      if (type === 'az') {
        sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      } else if (type === 'za') {
        sorted.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }));
      } else if (type === 'count') {
        sorted.sort((a, b) => {
          const countA = poolCounts[a.name] || 0;
          const countB = poolCounts[b.name] || 0;
          if (countB !== countA) return countB - countA;
          return a.name.localeCompare(b.name);
        });
      } else if (type === 'default') {
        const defaultOrder = [
          'Effects',
          'Buttons',
          'Loaders',
          'Backgrounds',
          'Transitions',
          'Typography',
          'Layouts',
          'Scroll',
          'Physics',
          'Shaders',
          'Routines/utils',
          'Experiments'
        ];
        sorted.sort((a, b) => {
          const idxA = defaultOrder.indexOf(a.name);
          const idxB = defaultOrder.indexOf(b.name);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.name.localeCompare(b.name);
        });
      }

      await onReorderPools(sorted);
      const label =
        type === 'az'
          ? 'Alphabetical A → Z'
          : type === 'za'
          ? 'Reverse Z → A'
          : type === 'count'
          ? 'By Asset Count'
          : 'Default Order';
      setPoolSuccessMsg(`✓ Reordered pools (${label})`);
      setTimeout(() => setPoolSuccessMsg(null), 3000);
    } catch (err: any) {
      setPoolError(err.message || 'Failed to sort pools.');
    } finally {
      setIsProcessingPool(false);
    }
  };


  const isLight = theme === 'light';
  const isMid = theme === 'mid';
  const isDark = !isLight && !isMid;

  // Adaptive theme color tokens for razor-sharp legibility across Dark, Mid, and Light modes
  const c = {
    // Backdrop & Modal shell
    backdropBg: isLight ? 'rgba(15, 23, 42, 0.45)' : isMid ? 'rgba(15, 27, 39, 0.55)' : 'rgba(8, 14, 22, 0.72)',
    modalBg: isLight ? '#ffffff' : isMid ? '#6c8ea8' : '#121a24',
    modalBorder: isLight ? '1px solid rgba(15, 23, 42, 0.12)' : isMid ? '1px solid rgba(15, 27, 39, 0.22)' : '1px solid rgba(148, 188, 227, 0.18)',
    headerBg: isLight ? '#f8fafc' : isMid ? '#5e809e' : '#182636',
    tabBarBg: isLight ? '#f1f5f9' : isMid ? '#537492' : '#15212f',
    footerBg: isLight ? '#f8fafc' : isMid ? '#5e809e' : '#182636',
    border: isLight ? 'rgba(15, 23, 42, 0.10)' : isMid ? 'rgba(15, 27, 39, 0.18)' : 'rgba(148, 188, 227, 0.16)',
    borderSubtle: isLight ? 'rgba(15, 23, 42, 0.06)' : isMid ? 'rgba(15, 27, 39, 0.12)' : 'rgba(148, 188, 227, 0.10)',
    borderFocus: isLight ? '#2563eb' : isMid ? '#102e4d' : '#5980a6',

    // Cards & surfaces within tabs
    cardBg: isLight ? '#f8fafc' : isMid ? 'rgba(255, 255, 255, 0.22)' : 'rgba(148, 188, 227, 0.06)',
    cardBorder: isLight ? 'rgba(15, 23, 42, 0.09)' : isMid ? 'rgba(15, 27, 39, 0.18)' : 'rgba(148, 188, 227, 0.20)',
    innerCardBg: isLight ? '#ffffff' : isMid ? 'rgba(255, 255, 255, 0.42)' : 'rgba(16, 26, 37, 0.85)',
    innerCardBorder: isLight ? 'rgba(15, 23, 42, 0.08)' : isMid ? 'rgba(15, 27, 39, 0.15)' : 'rgba(148, 188, 227, 0.14)',

    // Text colors
    textPrimary: isLight ? '#0f172a' : isMid ? '#09131d' : '#e9edf2',
    textSecondary: isLight ? '#334155' : isMid ? '#16293d' : 'rgba(233, 237, 242, 0.75)',
    textMuted: isLight ? '#64748b' : isMid ? '#29435c' : 'rgba(233, 237, 242, 0.45)',
    textAccent: isLight ? '#1d4ed8' : isMid ? '#0a2e58' : '#94bce3',
    textHeaderHighlight: isLight ? '#1e40af' : isMid ? '#051d38' : '#b5d9fd',

    // Inputs
    inputBg: isLight ? '#ffffff' : isMid ? '#f0f5fa' : '#0d141b',
    inputBorder: isLight ? 'rgba(15, 23, 42, 0.16)' : isMid ? 'rgba(11, 23, 36, 0.25)' : 'rgba(148, 188, 227, 0.25)',
    inputText: isLight ? '#0f172a' : isMid ? '#0b1724' : '#e9edf2',
    inputPlaceholder: isLight ? '#94a3b8' : isMid ? '#64748b' : 'rgba(233, 237, 242, 0.35)',

    // Secondary buttons
    btnSecBg: isLight ? 'rgba(15, 23, 42, 0.06)' : isMid ? 'rgba(11, 23, 36, 0.10)' : 'rgba(148, 188, 227, 0.10)',
    btnSecBorder: isLight ? 'rgba(15, 23, 42, 0.12)' : isMid ? 'rgba(11, 23, 36, 0.20)' : 'rgba(148, 188, 227, 0.22)',
    btnSecText: isLight ? '#0f172a' : isMid ? '#0b1724' : '#b5d9fd',

    // Tabs
    tabActiveText: isLight ? '#1d4ed8' : isMid ? '#051d38' : '#b5d9fd',
    tabActiveBorder: isLight ? '#2563eb' : isMid ? '#051d38' : '#5980a6',
    tabInactiveText: isLight ? '#64748b' : isMid ? '#29435c' : 'rgba(233, 237, 242, 0.60)',

    // Primary action button style
    btnPriBorder: isLight ? '1px solid #2563eb' : isMid ? '1px solid #1e3a5f' : '1px solid #416180',
    btnPriBg: isLight
      ? 'linear-gradient(180deg, #3b82f6, #2563eb)'
      : isMid
      ? 'linear-gradient(180deg, #2a4e76, #1d3958)'
      : 'linear-gradient(180deg, #6b91b6, #5980a6)',
    btnPriShadow: isLight
      ? '0 2px 0 #1d4ed8, 0 4px 12px rgba(37,99,235,.25)'
      : isMid
      ? '0 2px 0 #13253b, 0 4px 12px rgba(15,27,39,.3)'
      : '0 2px 0 #2c455d, 0 4px 12px rgba(65,97,128,.3)'
  };

  return (
    <div
      data-modal="1"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: c.backdropBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.22s ease'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '680px',
          maxWidth: '92vw',
          maxHeight: '88vh',
          borderRadius: '22px',
          background: c.modalBg,
          color: c.textPrimary,
          boxShadow: isLight
            ? '0 24px 70px rgba(15, 23, 42, 0.18), 0 4px 14px rgba(15, 23, 42, 0.08)'
            : isMid
            ? '0 30px 80px rgba(15, 27, 39, 0.35), 0 4px 16px rgba(15, 27, 39, 0.2)'
            : '0 32px 90px rgba(0, 0, 0, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'cardPop 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          border: c.modalBorder
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '22px 26px 14px',
            borderBottom: `1px solid ${c.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: c.headerBg
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: c.textAccent
              }}
            >
              Control Center
            </div>
            <div
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
                fontSize: '26px',
                textTransform: 'uppercase',
                letterSpacing: '.02em',
                color: c.textPrimary
              }}
            >
              Settings & Storage
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              border: `1px solid ${c.borderSubtle}`,
              cursor: 'pointer',
              background: c.btnSecBg,
              color: c.textPrimary,
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '13px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            padding: '8px 26px 0',
            gap: '8px',
            background: c.tabBarBg,
            borderBottom: `1px solid ${c.border}`
          }}
        >
          <button
            onClick={() => setActiveTab('database')}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 0,
              borderBottom: activeTab === 'database' ? `2px solid ${c.tabActiveBorder}` : '2px solid transparent',
              color: activeTab === 'database' ? c.tabActiveText : c.tabInactiveText,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '15px',
              fontWeight: 600,
              letterSpacing: '.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s'
            }}
          >
            💾 Database & Backups
          </button>

          <button
            onClick={() => setActiveTab('interface')}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 0,
              borderBottom: activeTab === 'interface' ? `2px solid ${c.tabActiveBorder}` : '2px solid transparent',
              color: activeTab === 'interface' ? c.tabActiveText : c.tabInactiveText,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '15px',
              fontWeight: 600,
              letterSpacing: '.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s'
            }}
          >
            ⚙️ Interface & Appearance
          </button>

          <button
            onClick={() => setActiveTab('pools')}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 0,
              borderBottom: activeTab === 'pools' ? `2px solid ${c.tabActiveBorder}` : '2px solid transparent',
              color: activeTab === 'pools' ? c.tabActiveText : c.tabInactiveText,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '15px',
              fontWeight: 600,
              letterSpacing: '.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s'
            }}
          >
            🌊 Pools ({pools.length})
          </button>

          <button
            onClick={() => setActiveTab('folders')}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 0,
              borderBottom: activeTab === 'folders' ? `2px solid ${c.tabActiveBorder}` : '2px solid transparent',
              color: activeTab === 'folders' ? c.tabActiveText : c.tabInactiveText,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '15px',
              fontWeight: 600,
              letterSpacing: '.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s'
            }}
          >
            📁 Watched Folders ({folders.length})
          </button>
        </div>

        {/* Tab Content Area */}
        <div style={{ padding: '24px 26px', overflowY: 'auto', flex: 1 }}>
          {/* TAB 1: DATABASE & BACKUPS */}
          {activeTab === 'database' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* SQLite Health Card */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '16px',
                  background: c.cardBg,
                  border: `1px solid ${c.cardBorder}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#38ef7d',
                        boxShadow: '0 0 8px rgba(56,239,125,.7)'
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: '18px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '.03em',
                        color: c.textHeaderHighlight
                      }}
                    >
                      Active SQLite Storage Engine
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: '10px',
                      color: c.textMuted
                    }}
                  >
                    SQLite v{dbStats?.sqliteVersion || '3.53'} (WAL Mode)
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '10px',
                    marginTop: '4px'
                  }}
                >
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: c.innerCardBg,
                      border: `1px solid ${c.innerCardBorder}`
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '9px',
                        color: c.textMuted,
                        textTransform: 'uppercase'
                      }}
                    >
                      Database Size
                    </div>
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: c.textAccent,
                        marginTop: '2px'
                      }}
                    >
                      {dbStats?.dbSizeFormatted || '0 B'}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: c.innerCardBg,
                      border: `1px solid ${c.innerCardBorder}`
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '9px',
                        color: c.textMuted,
                        textTransform: 'uppercase'
                      }}
                    >
                      Total Assets
                    </div>
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: c.textAccent,
                        marginTop: '2px'
                      }}
                    >
                      {dbStats?.assetCount ?? 0}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: c.innerCardBg,
                      border: `1px solid ${c.innerCardBorder}`
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '9px',
                        color: c.textMuted,
                        textTransform: 'uppercase'
                      }}
                    >
                      Inner Files
                    </div>
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: c.textAccent,
                        marginTop: '2px'
                      }}
                    >
                      {dbStats?.innerFileCount ?? 0}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: c.innerCardBg,
                      border: `1px solid ${c.innerCardBorder}`
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '9px',
                        color: c.textMuted,
                        textTransform: 'uppercase'
                      }}
                    >
                      Search Engine
                    </div>
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: isLight ? '#16a34a' : isMid ? '#104528' : '#38ef7d',
                        marginTop: '2px'
                      }}
                    >
                      FTS5 Active
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '10.5px',
                    color: c.textMuted,
                    marginTop: '2px'
                  }}
                >
                  File Path: {dbStats?.dbPath || 'D:\\Archive\\archive.db'}
                </div>
              </div>

              {/* One-Click Backup Section */}
              <div
                style={{
                  padding: '18px 20px',
                  borderRadius: '16px',
                  border: `1px solid ${c.cardBorder}`,
                  background: c.cardBg,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 700,
                        fontSize: '19px',
                        textTransform: 'uppercase',
                        color: c.textHeaderHighlight
                      }}
                    >
                      Snapshot & Backup Database
                    </div>
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '10.5px',
                        color: c.textSecondary,
                        marginTop: '2px'
                      }}
                    >
                      Copies current database into <code style={{ color: c.textAccent, background: isLight ? 'rgba(15,23,42,0.06)' : isMid ? 'rgba(11,23,36,0.12)' : 'rgba(0,0,0,0.3)', padding: '2px 5px', borderRadius: '4px' }}>backups/archive_YYYY-MM-DD_HH-mm-ss.db</code>
                    </div>
                  </div>

                  <button
                    onClick={handleCreateBackup}
                    disabled={backingUp}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '12px',
                      border: c.btnPriBorder,
                      background: c.btnPriBg,
                      color: '#ffffff',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: '14.5px',
                      fontWeight: 600,
                      letterSpacing: '.05em',
                      textTransform: 'uppercase',
                      cursor: backingUp ? 'wait' : 'pointer',
                      boxShadow: c.btnPriShadow,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {backingUp ? 'Creating Snapshot…' : '+ Backup Database Now'}
                  </button>
                </div>

                {lastBackupMsg && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: lastBackupMsg.startsWith('✓')
                        ? (isLight ? 'rgba(34,197,94,0.12)' : isMid ? 'rgba(34,197,94,0.18)' : 'rgba(56,239,125,.12)')
                        : (isLight ? 'rgba(239,68,68,0.12)' : isMid ? 'rgba(239,68,68,0.18)' : 'rgba(255,100,100,.12)'),
                      border: lastBackupMsg.startsWith('✓')
                        ? `1px solid ${isLight ? 'rgba(34,197,94,0.3)' : isMid ? 'rgba(34,197,94,0.4)' : 'rgba(56,239,125,.3)'}`
                        : `1px solid ${isLight ? 'rgba(239,68,68,0.3)' : isMid ? 'rgba(239,68,68,0.4)' : 'rgba(255,100,100,.3)'}`,
                      color: lastBackupMsg.startsWith('✓')
                        ? (isLight ? '#15803d' : isMid ? '#052e16' : '#38ef7d')
                        : (isLight ? '#dc2626' : isMid ? '#7f1d1d' : '#ff8899'),
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: '11px'
                    }}
                  >
                    {lastBackupMsg}
                  </div>
                )}
              </div>

              {/* Backups List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div
                    style={{
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: '10.5px',
                      letterSpacing: '.1em',
                      textTransform: 'uppercase',
                      color: c.textMuted
                    }}
                  >
                    Stored Backups in /backups ({backups.length})
                  </div>
                  <button
                    onClick={loadBackups}
                    style={{
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: '10px',
                      color: c.textAccent
                    }}
                  >
                    ↻ Refresh
                  </button>
                </div>

                {backups.length === 0 ? (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: c.cardBg,
                      border: `1px dashed ${c.cardBorder}`,
                      textAlign: 'center',
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: '11px',
                      color: c.textMuted
                    }}
                  >
                    No backups created yet. Click "+ Backup Database Now" to create your first snapshot.
                  </div>
                ) : (
                  <div
                    style={{
                      maxHeight: '190px',
                      overflowY: 'auto',
                      borderRadius: '12px',
                      border: `1px solid ${c.innerCardBorder}`,
                      background: c.innerCardBg
                    }}
                  >
                    {backups.map((b) => (
                      <div
                        key={b.fileName}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '9px 14px',
                          borderBottom: `1px solid ${c.borderSubtle}`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '13px' }}>📦</span>
                          <div>
                            <div
                              style={{
                                fontFamily: 'ui-monospace, Menlo, monospace',
                                fontSize: '11px',
                                color: c.textPrimary
                              }}
                            >
                              {b.fileName}
                            </div>
                            <div
                              style={{
                                fontFamily: 'ui-monospace, Menlo, monospace',
                                fontSize: '9px',
                                color: c.textMuted
                              }}
                            >
                              {b.dateFormatted}
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            fontFamily: 'ui-monospace, Menlo, monospace',
                            fontSize: '10.5px',
                            color: c.textAccent,
                            fontWeight: 600
                          }}
                        >
                          {b.sizeFormatted}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Maintenance Tools */}
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  borderTop: `1px solid ${c.border}`,
                  paddingTop: '14px'
                }}
              >
                <button
                  onClick={handleOptimize}
                  disabled={optimizing}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: `1px solid ${c.btnSecBorder}`,
                    background: c.btnSecBg,
                    color: c.btnSecText,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: '13.5px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    cursor: optimizing ? 'wait' : 'pointer'
                  }}
                >
                  {optimizing ? 'Optimizing…' : 'Vacuum & Optimize Database'}
                </button>

                <button
                  onClick={() => {
                    if (window.confirm('Clear all assets from archive.db? This cannot be undone unless you have a backup.')) {
                      onClearAll();
                    }
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: `1px solid ${isLight ? 'rgba(239,68,68,0.25)' : isMid ? 'rgba(239,68,68,0.35)' : 'rgba(255,100,100,.3)'}`,
                    background: isLight ? 'rgba(239,68,68,0.08)' : isMid ? 'rgba(239,68,68,0.14)' : 'rgba(255,80,80,.1)',
                    color: isLight ? '#dc2626' : isMid ? '#7f1d1d' : '#ff8899',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: '13.5px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  Clear All Assets
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: INTERFACE & THEME */}
          {activeTab === 'interface' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <div>
                <div
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: '18px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: c.textHeaderHighlight,
                    marginBottom: '8px'
                  }}
                >
                  Color Theme
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {(['dark', 'mid', 'light'] as ThemeMode[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => onThemeChange(t)}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '12px',
                        border: theme === t ? `2px solid ${c.borderFocus}` : `1px solid ${c.cardBorder}`,
                        background: theme === t ? (isLight ? '#eff6ff' : isMid ? 'rgba(11,23,36,0.22)' : 'rgba(89,128,166,.25)') : c.innerCardBg,
                        color: theme === t ? (isLight ? '#1d4ed8' : isMid ? '#09131d' : '#ffffff') : c.textPrimary,
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: '15px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        cursor: 'pointer'
                      }}
                    >
                      {t === 'dark' ? 'Dark (Default)' : t === 'mid' ? 'Mid' : 'Light'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: '18px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: c.textHeaderHighlight,
                    marginBottom: '8px'
                  }}
                >
                  Default Grid Density (Cards per row)
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {([2, 3, 4, 5, 6, 8] as Density[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => onDensityChange(d)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '10px',
                        border: density === d ? `2px solid ${c.borderFocus}` : `1px solid ${c.cardBorder}`,
                        background: density === d ? (isLight ? '#eff6ff' : isMid ? 'rgba(11,23,36,0.22)' : 'rgba(89,128,166,.25)') : c.innerCardBg,
                        color: density === d ? (isLight ? '#1d4ed8' : isMid ? '#09131d' : '#ffffff') : c.textPrimary,
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: c.cardBg,
                  border: `1px solid ${c.cardBorder}`
                }}
              >
                <div
                  style={{
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '10px',
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    color: c.textAccent
                  }}
                >
                  Local Server Endpoint
                </div>
                <div
                  style={{
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '12px',
                    color: c.textPrimary,
                    marginTop: '4px'
                  }}
                >
                  http://127.0.0.1:6080/ (Port 6080)
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WATCHED FOLDERS */}
          {activeTab === 'folders' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Ingestion Mode Toggle Card */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: c.cardBg,
                  border: `1px solid ${c.cardBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: '16px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: c.textHeaderHighlight,
                      marginBottom: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>Stage Ingestion (Hold Until Complete)</span>
                    <span
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '9px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: deferFolderIngestion
                          ? (isLight ? 'rgba(34,197,94,0.12)' : isMid ? 'rgba(34,197,94,0.18)' : 'rgba(56,239,125,.18)')
                          : (isLight ? 'rgba(15,23,42,0.06)' : isMid ? 'rgba(11,23,36,0.12)' : 'rgba(255,255,255,.08)'),
                        color: deferFolderIngestion
                          ? (isLight ? '#15803d' : isMid ? '#052e16' : '#38ef7d')
                          : c.textMuted,
                        border: deferFolderIngestion
                          ? `1px solid ${isLight ? 'rgba(34,197,94,0.35)' : isMid ? 'rgba(34,197,94,0.45)' : 'rgba(56,239,125,.4)'}`
                          : `1px solid ${c.border}`,
                        letterSpacing: '.06em'
                      }}
                    >
                      {deferFolderIngestion ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: 'Barlow, sans-serif',
                      fontSize: '12px',
                      color: c.textSecondary,
                      lineHeight: 1.4
                    }}
                  >
                    When enabled, newly indexed watched folder assets remain hidden while ingesting and are staged in the background. The watched folder displays as ghosted until indexing is 100% complete, then unlocks and pops up a ready notification.
                  </div>
                </div>

                {onToggleDeferFolderIngestion && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={deferFolderIngestion}
                    onClick={() => onToggleDeferFolderIngestion(!deferFolderIngestion)}
                    style={{
                      width: '42px',
                      height: '24px',
                      borderRadius: '12px',
                      background: deferFolderIngestion
                        ? (isLight ? '#16a34a' : isMid ? '#103322' : '#38ef7d')
                        : (isLight ? 'rgba(15,23,42,0.18)' : isMid ? 'rgba(11,23,36,0.25)' : 'rgba(255,255,255,.18)'),
                      border: 0,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px',
                      cursor: 'pointer',
                      flex: 'none',
                      transition: 'background 0.2s',
                      boxShadow: deferFolderIngestion ? '0 0 10px rgba(56,239,125,.4)' : 'none'
                    }}
                  >
                    <span
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        boxShadow: '0 1px 3px rgba(0,0,0,.35)',
                        transform: deferFolderIngestion ? 'translateX(18px)' : 'translateX(0)',
                        transition: 'transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.2)'
                      }}
                    />
                  </button>
                )}
              </div>

              <div>
                <div
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: '18px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: c.textHeaderHighlight,
                    marginBottom: '4px'
                  }}
                >
                  Add Watched Directory
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={newFolderPath}
                    onChange={(e) => setNewFolderPath(e.target.value)}
                    placeholder="e.g. D:\Archive\ClientAssets"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: `1px solid ${c.inputBorder}`,
                      background: c.inputBg,
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: '11.5px',
                      color: c.inputText
                    }}
                  />
                  <button
                    onClick={handleAddFolderSubmit}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      border: c.btnPriBorder,
                      background: c.btnPriBg,
                      color: '#ffffff',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: '14px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      boxShadow: c.btnPriShadow
                    }}
                  >
                    Add Folder
                  </button>
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '10px',
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    color: c.textMuted,
                    marginBottom: '8px'
                  }}
                >
                  Active Watched Folders ({folders.length})
                </div>

                {folders.length === 0 ? (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: c.cardBg,
                      border: `1px dashed ${c.cardBorder}`,
                      textAlign: 'center',
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: '11px',
                      color: c.textMuted
                    }}
                  >
                    No watched folders configured yet.
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: '12px',
                      border: `1px solid ${c.innerCardBorder}`,
                      background: c.innerCardBg,
                      overflow: 'hidden'
                    }}
                  >
                    {folders.map((f) => {
                      const isEnabled = f.enabled !== false;
                      const isIngesting = !!f.isIngesting;
                      return (
                        <div
                          key={f.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            borderBottom: `1px solid ${c.borderSubtle}`,
                            opacity: isIngesting ? 0.6 : isEnabled ? 1 : 0.45,
                            background: isIngesting
                              ? (isLight ? 'rgba(234,179,8,0.08)' : isMid ? 'rgba(234,179,8,0.12)' : 'rgba(250,204,21,.05)')
                              : isEnabled
                              ? 'transparent'
                              : (isLight ? 'rgba(15,23,42,0.03)' : isMid ? 'rgba(11,23,36,0.08)' : 'rgba(0,0,0,0.15)'),
                            animation: isIngesting ? 'idxpulse 1.6s ease-in-out infinite' : 'none',
                            transition: 'opacity 0.2s, background 0.2s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: isIngesting ? '#facc15' : isEnabled ? '#38ef7d' : '#6b7280',
                                boxShadow: isIngesting
                                  ? '0 0 8px rgba(250,204,21,.8)'
                                  : isEnabled
                                  ? '0 0 6px rgba(56,239,125,.7)'
                                  : 'none',
                                animation: isIngesting
                                  ? 'idxpulse 0.9s ease-in-out infinite'
                                  : isEnabled
                                  ? 'idxpulse 2.4s ease-in-out infinite'
                                  : 'none',
                                flex: 'none'
                              }}
                            />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontFamily: 'ui-monospace, Menlo, monospace',
                                  fontSize: '11px',
                                  color: isIngesting
                                    ? (isLight ? '#b45309' : '#facc15')
                                    : isEnabled
                                    ? c.textPrimary
                                    : c.textMuted,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  textDecoration: isEnabled || isIngesting ? 'none' : 'line-through'
                                }}
                                title={f.path}
                              >
                                {f.path}
                              </div>
                              <div
                                style={{
                                  fontFamily: 'ui-monospace, Menlo, monospace',
                                  fontSize: '9px',
                                  color: isIngesting
                                    ? (isLight ? '#b45309' : '#facc15')
                                    : isEnabled
                                    ? c.textAccent
                                    : c.textMuted,
                                  marginTop: '2px'
                                }}
                              >
                                {isIngesting
                                  ? '⏳ Indexing in progress · Staged until complete'
                                  : `${f.count} items ${isEnabled ? '· Watching' : '· Disabled (hidden)'}`}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 'none' }}>
                            {isIngesting ? (
                              <span
                                style={{
                                  fontFamily: 'ui-monospace, Menlo, monospace',
                                  fontSize: '9px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  background: isLight ? 'rgba(234,179,8,0.14)' : 'rgba(250,204,21,.16)',
                                  border: `1px solid ${isLight ? 'rgba(234,179,8,0.35)' : 'rgba(250,204,21,.35)'}`,
                                  color: isLight ? '#b45309' : '#facc15',
                                  fontWeight: 700,
                                  textTransform: 'uppercase'
                                }}
                              >
                                Ghosted · Staged
                              </span>
                            ) : (
                              <>
                                {/* Enable/Disable Toggle button */}
                                {onToggleFolder && (
                                  <button
                                    onClick={() => onToggleFolder(f.id, !isEnabled)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '5px 12px',
                                      borderRadius: '20px',
                                      background: isEnabled
                                        ? (isLight ? 'rgba(34,197,94,0.12)' : isMid ? 'rgba(34,197,94,0.18)' : 'rgba(56,239,125,.14)')
                                        : (isLight ? 'rgba(15,23,42,0.06)' : isMid ? 'rgba(11,23,36,0.12)' : 'rgba(255,255,255,.06)'),
                                      border: isEnabled
                                        ? `1px solid ${isLight ? 'rgba(34,197,94,0.35)' : isMid ? 'rgba(34,197,94,0.45)' : 'rgba(56,239,125,.35)'}`
                                        : `1px solid ${c.border}`,
                                      color: isEnabled
                                        ? (isLight ? '#15803d' : isMid ? '#052e16' : '#38ef7d')
                                        : c.textMuted,
                                      cursor: 'pointer',
                                      fontSize: '10px',
                                      fontFamily: 'ui-monospace, Menlo, monospace',
                                      fontWeight: 600,
                                      letterSpacing: '.06em',
                                      textTransform: 'uppercase',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: '18px',
                                        height: '10px',
                                        borderRadius: '6px',
                                        background: isEnabled ? '#38ef7d' : (isLight ? 'rgba(15,23,42,0.25)' : 'rgba(255,255,255,.2)'),
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '1px',
                                        justifyContent: isEnabled ? 'flex-end' : 'flex-start'
                                      }}
                                    >
                                      <span
                                        style={{
                                          width: '8px',
                                          height: '8px',
                                          borderRadius: '50%',
                                          background: '#ffffff'
                                        }}
                                      />
                                    </span>
                                    {isEnabled ? 'Active' : 'Disabled'}
                                  </button>
                                )}

                                {onRemoveFolder && (
                                  <button
                                    onClick={() => onRemoveFolder(f.id)}
                                    style={{
                                      background: 'transparent',
                                      border: 0,
                                      color: isLight ? '#dc2626' : isMid ? '#7f1d1d' : '#ff6677',
                                      cursor: 'pointer',
                                      fontFamily: 'ui-monospace, Menlo, monospace',
                                      fontSize: '13px',
                                      padding: '4px'
                                    }}
                                    title="Remove watched folder"
                                  >
                                    ✕
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: POOLS MANAGER */}
          {activeTab === 'pools' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Notifications */}
              {poolSuccessMsg && (
                <div
                  style={{
                    padding: '10px 16px',
                    borderRadius: '12px',
                    background: 'rgba(56,239,125,.12)',
                    border: '1px solid rgba(56,239,125,.3)',
                    color: '#4ade80',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '11.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>✓</span>
                  <span>{poolSuccessMsg}</span>
                </div>
              )}

              {poolError && (
                <div
                  style={{
                    padding: '10px 16px',
                    borderRadius: '12px',
                    background: 'rgba(239,68,68,.14)',
                    border: '1px solid rgba(239,68,68,.35)',
                    color: '#f87171',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '11.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>⚠️ {poolError}</span>
                  <button
                    onClick={() => setPoolError(null)}
                    style={{ background: 'transparent', border: 0, color: '#f87171', cursor: 'pointer', fontSize: '13px' }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Pool Header Bar & Actions */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '16px',
                  background: c.cardBg,
                  border: `1px solid ${c.cardBorder}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: '19px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: c.textHeaderHighlight,
                        letterSpacing: '.03em'
                      }}
                    >
                      Asset Pools & Classification
                    </div>
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '10.5px',
                        color: c.textSecondary,
                        marginTop: '2px'
                      }}
                    >
                      The default pools are an example starter template. Rename, recolor, add, or delete pools to match your workflow — renames automatically cascade across your database.
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsCreatingPool(!isCreatingPool);
                      setEditingPoolId(null);
                      setDeletingPool(null);
                      setPoolError(null);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '10px',
                      border: isCreatingPool ? `1px solid ${c.border}` : c.btnPriBorder,
                      background: isCreatingPool ? c.btnSecBg : c.btnPriBg,
                      color: isCreatingPool ? c.textPrimary : '#ffffff',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: '13.5px',
                      fontWeight: 600,
                      letterSpacing: '.04em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      boxShadow: isCreatingPool ? 'none' : c.btnPriShadow,
                      transition: 'all 0.15s'
                    }}
                  >
                    {isCreatingPool ? '✕ Cancel' : '+ Add New Pool'}
                  </button>
                </div>

                {/* Search / Filter input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      background: c.inputBg,
                      borderRadius: '8px',
                      border: `1px solid ${c.inputBorder}`,
                      padding: '4px 10px'
                    }}
                  >
                    <span style={{ fontSize: '11px', color: c.textAccent, marginRight: '6px' }}>🔍</span>
                    <input
                      type="text"
                      placeholder="Filter pools by name or description…"
                      value={poolSearch}
                      onChange={(e) => setPoolSearch(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 0,
                        outline: 'none',
                        color: c.inputText,
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '11.5px'
                      }}
                    />
                    {poolSearch && (
                      <button
                        onClick={() => setPoolSearch('')}
                        style={{
                          background: 'transparent',
                          border: 0,
                          color: c.textMuted,
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <span
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '10px',
                      color: c.textMuted,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {pools.length} total pools
                  </span>
                </div>
              </div>

              {/* CREATE POOL EXPANDABLE FORM */}
              {isCreatingPool && (
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: '16px',
                    background: c.cardBg,
                    border: `1px solid ${c.cardBorder}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    animation: 'fadeIn 0.2s ease'
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: '16px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: c.textHeaderHighlight
                    }}
                  >
                    New Asset Pool
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: c.textMuted, textTransform: 'uppercase' }}>
                        Pool Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 3D Models, Vector Sets, Audio FX"
                        value={newPoolName}
                        onChange={(e) => setNewPoolName(e.target.value)}
                        style={{
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: `1px solid ${c.inputBorder}`,
                          background: c.inputBg,
                          color: c.inputText,
                          fontFamily: 'Barlow, sans-serif',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div style={{ flex: '2 1 300px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: c.textMuted, textTransform: 'uppercase' }}>
                        Description (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. GLTF meshes, photogrammetry, character rigs"
                        value={newPoolDesc}
                        onChange={(e) => setNewPoolDesc(e.target.value)}
                        style={{
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: `1px solid ${c.inputBorder}`,
                          background: c.inputBg,
                          color: c.inputText,
                          fontFamily: 'Barlow, sans-serif',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {/* Color Swatch Picker */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: c.textMuted, textTransform: 'uppercase' }}>
                      Theme Accent Color
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {POOL_PRESET_COLORS.map((colorVal) => (
                        <div
                          key={colorVal}
                          onClick={() => setNewPoolColor(colorVal)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: colorVal,
                            cursor: 'pointer',
                            border: newPoolColor === colorVal ? `2.5px solid ${isLight ? '#0f172a' : '#ffffff'}` : '1px solid rgba(0,0,0,.3)',
                            boxShadow: newPoolColor === colorVal ? `0 0 10px ${colorVal}` : 'none',
                            transform: newPoolColor === colorVal ? 'scale(1.15)' : 'scale(1)',
                            transition: 'all 0.15s'
                          }}
                        />
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
                        <input
                          type="color"
                          value={newPoolColor}
                          onChange={(e) => setNewPoolColor(e.target.value)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: `1px solid ${c.inputBorder}`,
                            background: 'transparent',
                            cursor: 'pointer'
                          }}
                        />
                        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: c.textAccent }}>
                          {newPoolColor}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Submit / Cancel Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                    <button
                      onClick={() => setIsCreatingPool(false)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: `1px solid ${c.border}`,
                        background: 'transparent',
                        color: c.textSecondary,
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreatePool}
                      disabled={isProcessingPool || !newPoolName.trim()}
                      style={{
                        padding: '7px 16px',
                        borderRadius: '8px',
                        border: c.btnPriBorder,
                        background: c.btnPriBg,
                        color: '#ffffff',
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: isProcessingPool || !newPoolName.trim() ? 'not-allowed' : 'pointer',
                        opacity: isProcessingPool || !newPoolName.trim() ? 0.6 : 1,
                        boxShadow: c.btnPriShadow
                      }}
                    >
                      {isProcessingPool ? 'Creating…' : 'Create Pool'}
                    </button>
                  </div>
                </div>
              )}

              {/* DELETE CONFIRMATION DIALOG */}
              {deletingPool && (
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: '16px',
                    background: isLight ? 'rgba(239,68,68,0.08)' : isMid ? 'rgba(239,68,68,0.14)' : 'rgba(239,68,68,.12)',
                    border: `1px solid ${isLight ? 'rgba(239,68,68,0.3)' : isMid ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,.35)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    animation: 'fadeIn 0.2s ease'
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: '17px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: isLight ? '#dc2626' : isMid ? '#7f1d1d' : '#f87171'
                    }}
                  >
                    Delete Pool "{deletingPool.name}"?
                  </div>

                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: c.textPrimary }}>
                    {(poolCounts[deletingPool.name] || 0) > 0 ? (
                      <>
                        This pool currently contains{' '}
                        <strong style={{ color: c.textAccent }}>{poolCounts[deletingPool.name]}</strong> assets. Choose a
                        pool to reassign them to:
                      </>
                    ) : (
                      'This pool has no assets and will be removed.'
                    )}
                  </div>

                  {(poolCounts[deletingPool.name] || 0) > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: c.textMuted, textTransform: 'uppercase' }}>
                        Reassign assets to:
                      </span>
                      <select
                        value={reassignTarget}
                        onChange={(e) => setReassignTarget(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: c.inputBg,
                          border: `1px solid ${c.inputBorder}`,
                          color: c.inputText,
                          fontFamily: 'Barlow, sans-serif',
                          fontSize: '13px'
                        }}
                      >
                        <option value="Uncategorized">Uncategorized</option>
                        {pools
                          .filter((p) => p.id !== deletingPool.id)
                          .map((p) => (
                            <option key={p.id} value={p.name}>
                              {p.name} ({poolCounts[p.name] || 0} assets)
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      onClick={() => setDeletingPool(null)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: `1px solid ${c.border}`,
                        background: 'transparent',
                        color: c.textPrimary,
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeletePoolConfirm}
                      disabled={isProcessingPool}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '8px',
                        border: 0,
                        background: '#dc2626',
                        color: '#ffffff',
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: isProcessingPool ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isProcessingPool ? 'Deleting…' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              )}

              {/* POOLS LIST */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    padding: '2px 4px'
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: '10.5px',
                      letterSpacing: '.12em',
                      textTransform: 'uppercase',
                      color: c.textMuted,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>Configured Pools ({pools.length})</span>
                    {poolSearch && (
                      <span style={{ color: c.textAccent, textTransform: 'none' }}>
                        • showing {pools.filter((p) => p.name.toLowerCase().includes(poolSearch.toLowerCase()) || (p.description || '').toLowerCase().includes(poolSearch.toLowerCase())).length}
                      </span>
                    )}
                  </div>

                  {onReorderPools && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontFamily: 'ui-monospace, monospace',
                          fontSize: '9.5px',
                          color: c.textMuted,
                          textTransform: 'uppercase',
                          marginRight: '2px'
                        }}
                      >
                        Quick Sort:
                      </span>
                      <button
                        onClick={() => handleSortPools('az')}
                        disabled={isProcessingPool}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${c.btnSecBorder}`,
                          background: c.btnSecBg,
                          color: c.btnSecText,
                          fontFamily: 'ui-monospace, monospace',
                          fontSize: '10px',
                          cursor: isProcessingPool ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          transition: 'all 0.15s'
                        }}
                        title="Sort pools alphabetically (A → Z)"
                      >
                        <span>🔤</span>
                        <span>A → Z</span>
                      </button>
                      <button
                        onClick={() => handleSortPools('za')}
                        disabled={isProcessingPool}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${c.btnSecBorder}`,
                          background: c.btnSecBg,
                          color: c.btnSecText,
                          fontFamily: 'ui-monospace, monospace',
                          fontSize: '10px',
                          cursor: isProcessingPool ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s'
                        }}
                        title="Sort pools reverse alphabetically (Z → A)"
                      >
                        <span>Z → A</span>
                      </button>
                      <button
                        onClick={() => handleSortPools('count')}
                        disabled={isProcessingPool}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${c.btnSecBorder}`,
                          background: c.btnSecBg,
                          color: c.btnSecText,
                          fontFamily: 'ui-monospace, monospace',
                          fontSize: '10px',
                          cursor: isProcessingPool ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          transition: 'all 0.15s'
                        }}
                        title="Sort pools by number of assets (highest count first)"
                      >
                        <span>📊</span>
                        <span>By Count</span>
                      </button>
                      <button
                        onClick={() => handleSortPools('default')}
                        disabled={isProcessingPool}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${c.btnSecBorder}`,
                          background: c.btnSecBg,
                          color: c.btnSecText,
                          fontFamily: 'ui-monospace, monospace',
                          fontSize: '10px',
                          cursor: isProcessingPool ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          transition: 'all 0.15s'
                        }}
                        title="Reset to default 12 starter pools order"
                      >
                        <span>↺</span>
                        <span>Reset</span>
                      </button>
                    </div>
                  )}
                </div>

                {pools
                  .filter(
                    (p) =>
                      p.name.toLowerCase().includes(poolSearch.toLowerCase()) ||
                      (p.description || '').toLowerCase().includes(poolSearch.toLowerCase())
                  )
                  .map((p) => {
                    const isEditing = editingPoolId === p.id;
                    const assetCount = poolCounts[p.name] || 0;
                    const masterIndex = pools.findIndex((item) => item.id === p.id);
                    const isFirst = masterIndex === 0;
                    const isLast = masterIndex === pools.length - 1;

                    if (isEditing) {
                      return (
                        <div
                          key={p.id}
                          style={{
                            padding: '14px 16px',
                            borderRadius: '12px',
                            background: c.cardBg,
                            border: `1px solid ${c.cardBorder}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: editPoolColor,
                                flex: 'none',
                                boxShadow: `0 0 8px ${editPoolColor}`
                              }}
                            />
                            <span
                              style={{
                                fontFamily: "'Barlow Condensed', sans-serif",
                                fontSize: '16px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: c.textHeaderHighlight
                              }}
                            >
                              Edit Pool "{p.name}"
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontFamily: 'ui-monospace, monospace', fontSize: '9.5px', color: c.textMuted, textTransform: 'uppercase' }}>
                                Pool Name
                              </label>
                              <input
                                type="text"
                                value={editPoolName}
                                onChange={(e) => setEditPoolName(e.target.value)}
                                style={{
                                  padding: '7px 10px',
                                  borderRadius: '6px',
                                  border: `1px solid ${c.inputBorder}`,
                                  background: c.inputBg,
                                  color: c.inputText,
                                  fontFamily: 'Barlow, sans-serif',
                                  fontSize: '13px'
                                }}
                              />
                            </div>

                            <div style={{ flex: '2 1 260px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontFamily: 'ui-monospace, monospace', fontSize: '9.5px', color: c.textMuted, textTransform: 'uppercase' }}>
                                Description
                              </label>
                              <input
                                type="text"
                                value={editPoolDesc}
                                onChange={(e) => setEditPoolDesc(e.target.value)}
                                style={{
                                  padding: '7px 10px',
                                  borderRadius: '6px',
                                  border: `1px solid ${c.inputBorder}`,
                                  background: c.inputBg,
                                  color: c.inputText,
                                  fontFamily: 'Barlow, sans-serif',
                                  fontSize: '13px'
                                }}
                              />
                            </div>
                          </div>

                          {/* Color picker */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '9.5px', color: c.textMuted, textTransform: 'uppercase', marginRight: '4px' }}>
                              Color:
                            </span>
                            {POOL_PRESET_COLORS.map((colorVal) => (
                              <div
                                key={colorVal}
                                onClick={() => setEditPoolColor(colorVal)}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  background: colorVal,
                                  cursor: 'pointer',
                                  border: editPoolColor === colorVal ? `2px solid ${isLight ? '#0f172a' : '#ffffff'}` : '1px solid rgba(0,0,0,.4)',
                                  boxShadow: editPoolColor === colorVal ? `0 0 8px ${colorVal}` : 'none',
                                  transform: editPoolColor === colorVal ? 'scale(1.15)' : 'scale(1)',
                                  transition: 'all 0.15s'
                                }}
                              />
                            ))}
                            <input
                              type="color"
                              value={editPoolColor}
                              onChange={(e) => setEditPoolColor(e.target.value)}
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '4px',
                                border: `1px solid ${c.inputBorder}`,
                                background: 'transparent',
                                cursor: 'pointer',
                                marginLeft: '4px'
                              }}
                            />
                          </div>

                          {assetCount > 0 && editPoolName.trim() !== p.name && (
                            <div
                              style={{
                                fontFamily: 'ui-monospace, monospace',
                                fontSize: '10.5px',
                                color: c.textAccent,
                                background: isLight ? 'rgba(37,99,235,0.08)' : isMid ? 'rgba(11,23,36,0.12)' : 'rgba(148,188,227,.08)',
                                padding: '6px 10px',
                                borderRadius: '6px'
                              }}
                            >
                              ℹ️ Renaming will automatically update all {assetCount} assets currently assigned to "{p.name}".
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              onClick={() => setEditingPoolId(null)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                border: `1px solid ${c.border}`,
                                background: 'transparent',
                                color: c.textPrimary,
                                fontFamily: "'Barlow Condensed', sans-serif",
                                fontSize: '12.5px',
                                cursor: 'pointer'
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveEditPool}
                              disabled={isProcessingPool || !editPoolName.trim()}
                              style={{
                                padding: '5px 14px',
                                borderRadius: '6px',
                                border: c.btnPriBorder,
                                background: c.btnPriBg,
                                color: '#ffffff',
                                fontFamily: "'Barlow Condensed', sans-serif",
                                fontSize: '12.5px',
                                fontWeight: 600,
                                cursor: isProcessingPool || !editPoolName.trim() ? 'not-allowed' : 'pointer',
                                boxShadow: c.btnPriShadow
                              }}
                            >
                              {isProcessingPool ? 'Saving…' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: c.innerCardBg,
                          border: `1px solid ${c.innerCardBorder}`,
                          transition: 'border-color 0.15s, background 0.15s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.borderFocus)}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = c.innerCardBorder)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          {/* Order Index & Move Up/Down Controls */}
                          {onReorderPools && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 'none' }}>
                              <span
                                style={{
                                  fontFamily: 'ui-monospace, Menlo, monospace',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  color: c.textMuted,
                                  minWidth: '24px',
                                  textAlign: 'center',
                                  padding: '2px 4px',
                                  borderRadius: '5px',
                                  background: isLight ? 'rgba(15,23,42,0.05)' : isMid ? 'rgba(11,23,36,0.12)' : 'rgba(148,188,227,0.08)',
                                  border: `1px solid ${c.innerCardBorder}`
                                }}
                                title={`Position #${masterIndex + 1} of ${pools.length}`}
                              >
                                #{masterIndex + 1}
                              </span>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMovePool(p.id, 'up');
                                  }}
                                  disabled={isFirst || isProcessingPool}
                                  style={{
                                    width: '20px',
                                    height: '14px',
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '3px',
                                    border: `1px solid ${c.btnSecBorder}`,
                                    background: isFirst ? 'transparent' : c.btnSecBg,
                                    color: isFirst ? (isLight ? 'rgba(15,23,42,0.2)' : 'rgba(255,255,255,0.2)') : c.btnSecText,
                                    opacity: isFirst ? 0.35 : 1,
                                    cursor: isFirst || isProcessingPool ? 'not-allowed' : 'pointer',
                                    fontSize: '8px',
                                    lineHeight: 1,
                                    transition: 'all 0.15s'
                                  }}
                                  title={isFirst ? 'Already at top' : `Move "${p.name}" up`}
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMovePool(p.id, 'down');
                                  }}
                                  disabled={isLast || isProcessingPool}
                                  style={{
                                    width: '20px',
                                    height: '14px',
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '3px',
                                    border: `1px solid ${c.btnSecBorder}`,
                                    background: isLast ? 'transparent' : c.btnSecBg,
                                    color: isLast ? (isLight ? 'rgba(15,23,42,0.2)' : 'rgba(255,255,255,0.2)') : c.btnSecText,
                                    opacity: isLast ? 0.35 : 1,
                                    cursor: isLast || isProcessingPool ? 'not-allowed' : 'pointer',
                                    fontSize: '8px',
                                    lineHeight: 1,
                                    transition: 'all 0.15s'
                                  }}
                                  title={isLast ? 'Already at bottom' : `Move "${p.name}" down`}
                                >
                                  ▼
                                </button>
                              </div>
                            </div>
                          )}

                          <span
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: p.color || '#94bce3',
                              boxShadow: `0 0 8px ${p.color || '#94bce3'}`,
                              flex: 'none'
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                style={{
                                  fontFamily: "'Barlow Condensed', sans-serif",
                                  fontSize: '16.5px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '.03em',
                                  color: c.textPrimary
                                }}
                              >
                                {p.name}
                              </span>
                              <span
                                style={{
                                  padding: '2px 7px',
                                  borderRadius: '99px',
                                  fontFamily: 'ui-monospace, monospace',
                                  fontSize: '9.5px',
                                  color: assetCount > 0 ? c.textAccent : c.textMuted,
                                  background: assetCount > 0
                                    ? (isLight ? 'rgba(37,99,235,0.10)' : isMid ? 'rgba(11,23,36,0.15)' : 'rgba(148,188,227,.18)')
                                    : (isLight ? 'rgba(15,23,42,0.05)' : isMid ? 'rgba(11,23,36,0.08)' : 'rgba(148,188,227,.06)')
                                }}
                              >
                                {assetCount} {assetCount === 1 ? 'asset' : 'assets'}
                              </span>
                            </div>
                            {p.description && (
                              <div
                                style={{
                                  fontFamily: 'ui-monospace, Menlo, monospace',
                                  fontSize: '10.5px',
                                  color: c.textSecondary,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '380px'
                                }}
                              >
                                {p.description}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 'none' }}>
                          <button
                            onClick={() => startEditPool(p)}
                            style={{
                              padding: '4px 9px',
                              borderRadius: '6px',
                              border: `1px solid ${c.btnSecBorder}`,
                              background: c.btnSecBg,
                              color: c.btnSecText,
                              fontFamily: 'ui-monospace, monospace',
                              fontSize: '10.5px',
                              cursor: 'pointer',
                              transition: 'background 0.15s'
                            }}
                            title="Edit pool name, color, and description"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setDeletingPool(p);
                              setReassignTarget('Uncategorized');
                              setPoolError(null);
                            }}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: `1px solid ${isLight ? 'rgba(239,68,68,0.2)' : isMid ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,.2)'}`,
                              background: isLight ? 'rgba(239,68,68,0.06)' : isMid ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,.08)',
                              color: isLight ? '#dc2626' : isMid ? '#7f1d1d' : '#f87171',
                              fontFamily: 'ui-monospace, monospace',
                              fontSize: '10.5px',
                              cursor: 'pointer',
                              transition: 'background 0.15s'
                            }}
                            title="Delete pool"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 26px',
            borderTop: `1px solid ${c.border}`,
            background: c.footerBg,
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: `1px solid ${c.btnSecBorder}`,
              background: c.btnSecBg,
              color: c.textPrimary,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '14px',
              fontWeight: 600,
              textTransform: 'uppercase',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
