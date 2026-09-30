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


  return (
    <div
      data-modal="1"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(29,45,61,.68)',
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
          background: 'var(--bg, #10161d)',
          color: 'var(--ink, #e9edf2)',
          boxShadow: '0 32px 90px rgba(0,0,0,.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'cardPop 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          border: '1px solid rgba(148,188,227,.18)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '22px 26px 14px',
            borderBottom: '1px solid rgba(148,188,227,.14)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface, #182636)'
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: '#94bce3'
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
                letterSpacing: '.02em'
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
              border: 0,
              cursor: 'pointer',
              background: 'rgba(148,188,227,.12)',
              color: 'var(--ink, #e9edf2)',
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
            background: 'var(--surface, #182636)',
            borderBottom: '1px solid rgba(148,188,227,.14)'
          }}
        >
          <button
            onClick={() => setActiveTab('database')}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 0,
              borderBottom: activeTab === 'database' ? '2px solid #5980a6' : '2px solid transparent',
              color: activeTab === 'database' ? '#b5d9fd' : 'rgba(233,237,242,.6)',
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
              borderBottom: activeTab === 'interface' ? '2px solid #5980a6' : '2px solid transparent',
              color: activeTab === 'interface' ? '#b5d9fd' : 'rgba(233,237,242,.6)',
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
              borderBottom: activeTab === 'pools' ? '2px solid #5980a6' : '2px solid transparent',
              color: activeTab === 'pools' ? '#b5d9fd' : 'rgba(233,237,242,.6)',
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
              borderBottom: activeTab === 'folders' ? '2px solid #5980a6' : '2px solid transparent',
              color: activeTab === 'folders' ? '#b5d9fd' : 'rgba(233,237,242,.6)',
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
                  background: 'rgba(148,188,227,.06)',
                  border: '1px solid rgba(148,188,227,.2)',
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
                        color: '#b5d9fd'
                      }}
                    >
                      Active SQLite Storage Engine
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: '10px',
                      color: 'rgba(233,237,242,.6)'
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
                      background: 'var(--surface, #182636)'
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '9px',
                        color: 'rgba(233,237,242,.4)',
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
                        color: '#94bce3',
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
                      background: 'var(--surface, #182636)'
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '9px',
                        color: 'rgba(233,237,242,.4)',
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
                        color: '#94bce3',
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
                      background: 'var(--surface, #182636)'
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '9px',
                        color: 'rgba(233,237,242,.4)',
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
                        color: '#94bce3',
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
                      background: 'var(--surface, #182636)'
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '9px',
                        color: 'rgba(233,237,242,.4)',
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
                        color: '#38ef7d',
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
                    color: 'rgba(233,237,242,.55)',
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
                  border: '1px solid rgba(148,188,227,.25)',
                  background: 'var(--surface, #182636)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 700,
                        fontSize: '19px',
                        textTransform: 'uppercase',
                        color: '#b5d9fd'
                      }}
                    >
                      Snapshot & Backup Database
                    </div>
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '10.5px',
                        color: 'rgba(233,237,242,.6)',
                        marginTop: '2px'
                      }}
                    >
                      Copies current database into <code style={{ color: '#94bce3' }}>backups/archive_YYYY-MM-DD_HH-mm-ss.db</code>
                    </div>
                  </div>

                  <button
                    onClick={handleCreateBackup}
                    disabled={backingUp}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '12px',
                      border: '1px solid #416180',
                      background: 'linear-gradient(180deg, #6b91b6, #5980a6)',
                      color: '#ffffff',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: '14.5px',
                      fontWeight: 600,
                      letterSpacing: '.05em',
                      textTransform: 'uppercase',
                      cursor: backingUp ? 'wait' : 'pointer',
                      boxShadow: '0 2px 0 #2c455d, 0 4px 12px rgba(65,97,128,.3)',
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
                      background: lastBackupMsg.startsWith('✓') ? 'rgba(56,239,125,.12)' : 'rgba(255,100,100,.12)',
                      border: lastBackupMsg.startsWith('✓') ? '1px solid rgba(56,239,125,.3)' : '1px solid rgba(255,100,100,.3)',
                      color: lastBackupMsg.startsWith('✓') ? '#38ef7d' : '#ff8899',
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
                      color: 'rgba(233,237,242,.55)'
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
                      color: '#94bce3'
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
                      background: 'rgba(148,188,227,.04)',
                      border: '1px dashed rgba(148,188,227,.18)',
                      textAlign: 'center',
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: '11px',
                      color: 'rgba(233,237,242,.4)'
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
                      border: '1px solid rgba(148,188,227,.14)',
                      background: 'var(--surface, #182636)'
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
                          borderBottom: '1px solid rgba(148,188,227,.08)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '13px' }}>📦</span>
                          <div>
                            <div
                              style={{
                                fontFamily: 'ui-monospace, Menlo, monospace',
                                fontSize: '11px',
                                color: 'rgba(233,237,242,.85)'
                              }}
                            >
                              {b.fileName}
                            </div>
                            <div
                              style={{
                                fontFamily: 'ui-monospace, Menlo, monospace',
                                fontSize: '9px',
                                color: 'rgba(233,237,242,.4)'
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
                            color: '#94bce3',
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
                  borderTop: '1px solid rgba(148,188,227,.12)',
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
                    border: '1px solid rgba(148,188,227,.25)',
                    background: 'rgba(148,188,227,.1)',
                    color: '#b5d9fd',
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
                    border: '1px solid rgba(255,100,100,.3)',
                    background: 'rgba(255,80,80,.1)',
                    color: '#ff8899',
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
                    color: '#b5d9fd',
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
                        border: theme === t ? '2px solid #5980a6' : '1px solid rgba(148,188,227,.2)',
                        background: theme === t ? 'rgba(89,128,166,.25)' : 'var(--surface, #182636)',
                        color: theme === t ? '#ffffff' : 'var(--ink, #e9edf2)',
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
                    color: '#b5d9fd',
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
                        border: density === d ? '2px solid #5980a6' : '1px solid rgba(148,188,227,.2)',
                        background: density === d ? 'rgba(89,128,166,.25)' : 'var(--surface, #182636)',
                        color: density === d ? '#ffffff' : 'var(--ink, #e9edf2)',
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
                  background: 'rgba(148,188,227,.06)',
                  border: '1px solid rgba(148,188,227,.14)'
                }}
              >
                <div
                  style={{
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '10px',
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    color: '#94bce3'
                  }}
                >
                  Local Server Endpoint
                </div>
                <div
                  style={{
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '12px',
                    color: 'rgba(233,237,242,.85)',
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
                  background: 'rgba(148,188,227,.07)',
                  border: '1px solid rgba(148,188,227,.22)',
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
                      color: '#b5d9fd',
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
                        background: deferFolderIngestion ? 'rgba(56,239,125,.18)' : 'rgba(255,255,255,.08)',
                        color: deferFolderIngestion ? '#38ef7d' : 'rgba(233,237,242,.5)',
                        border: `1px solid ${deferFolderIngestion ? 'rgba(56,239,125,.4)' : 'rgba(255,255,255,.1)'}`,
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
                      color: 'rgba(233,237,242,.65)',
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
                      background: deferFolderIngestion ? '#38ef7d' : 'rgba(255,255,255,.18)',
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
                    color: '#b5d9fd',
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
                      border: '1px solid rgba(148,188,227,.25)',
                      background: 'var(--surface, #182636)',
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: '11.5px',
                      color: 'var(--ink, #e9edf2)'
                    }}
                  />
                  <button
                    onClick={handleAddFolderSubmit}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      border: '1px solid #416180',
                      background: 'linear-gradient(180deg, #6b91b6, #5980a6)',
                      color: '#ffffff',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: '14px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      cursor: 'pointer'
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
                    color: 'rgba(233,237,242,.5)',
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
                      background: 'rgba(148,188,227,.04)',
                      border: '1px dashed rgba(148,188,227,.18)',
                      textAlign: 'center',
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: '11px',
                      color: 'rgba(233,237,242,.4)'
                    }}
                  >
                    No watched folders configured yet.
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: '12px',
                      border: '1px solid rgba(148,188,227,.14)',
                      background: 'var(--surface, #182636)',
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
                            borderBottom: '1px solid rgba(148,188,227,.08)',
                            opacity: isIngesting ? 0.6 : isEnabled ? 1 : 0.45,
                            background: isIngesting
                              ? 'rgba(250,204,21,.05)'
                              : isEnabled
                              ? 'transparent'
                              : 'rgba(0,0,0,0.15)',
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
                                    ? '#facc15'
                                    : isEnabled
                                    ? 'rgba(233,237,242,.95)'
                                    : 'rgba(233,237,242,.45)',
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
                                    ? '#facc15'
                                    : isEnabled
                                    ? '#94bce3'
                                    : 'rgba(233,237,242,.35)',
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
                                  background: 'rgba(250,204,21,.16)',
                                  border: '1px solid rgba(250,204,21,.35)',
                                  color: '#facc15',
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
                                      background: isEnabled ? 'rgba(56,239,125,.14)' : 'rgba(255,255,255,.06)',
                                      border: isEnabled ? '1px solid rgba(56,239,125,.35)' : '1px solid rgba(255,255,255,.1)',
                                      color: isEnabled ? '#38ef7d' : 'rgba(233,237,242,.45)',
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
                                        background: isEnabled ? '#38ef7d' : 'rgba(255,255,255,.2)',
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
                                      color: '#ff6677',
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
                  background: 'rgba(148,188,227,.06)',
                  border: '1px solid rgba(148,188,227,.2)',
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
                        color: '#b5d9fd',
                        letterSpacing: '.03em'
                      }}
                    >
                      Asset Pools & Classification
                    </div>
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '10.5px',
                        color: 'rgba(233,237,242,.6)',
                        marginTop: '2px'
                      }}
                    >
                      Organize, color-code, and rename your pools. Renaming automatically cascades across your database.
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
                      border: 0,
                      background: isCreatingPool ? 'rgba(148,188,227,.2)' : 'linear-gradient(180deg, #6b91b6, #5980a6)',
                      color: '#ffffff',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: '13.5px',
                      fontWeight: 600,
                      letterSpacing: '.04em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      boxShadow: isCreatingPool ? 'none' : '0 2px 0 #2c455d',
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
                      background: 'rgba(16,22,29,.7)',
                      borderRadius: '8px',
                      border: '1px solid rgba(148,188,227,.2)',
                      padding: '4px 10px'
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#94bce3', marginRight: '6px' }}>🔍</span>
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
                        color: '#e9edf2',
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
                          color: 'rgba(233,237,242,.5)',
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
                      color: 'rgba(233,237,242,.5)',
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
                    background: 'rgba(148,188,227,.1)',
                    border: '1px solid rgba(148,188,227,.35)',
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
                      color: '#b5d9fd'
                    }}
                  >
                    New Asset Pool
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: 'rgba(233,237,242,.6)', textTransform: 'uppercase' }}>
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
                          border: '1px solid rgba(148,188,227,.3)',
                          background: '#0d141b',
                          color: '#e9edf2',
                          fontFamily: 'Barlow, sans-serif',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div style={{ flex: '2 1 300px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: 'rgba(233,237,242,.6)', textTransform: 'uppercase' }}>
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
                          border: '1px solid rgba(148,188,227,.3)',
                          background: '#0d141b',
                          color: '#e9edf2',
                          fontFamily: 'Barlow, sans-serif',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {/* Color Swatch Picker */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: 'rgba(233,237,242,.6)', textTransform: 'uppercase' }}>
                      Theme Accent Color
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {POOL_PRESET_COLORS.map((c) => (
                        <div
                          key={c}
                          onClick={() => setNewPoolColor(c)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: c,
                            cursor: 'pointer',
                            border: newPoolColor === c ? '2.5px solid #ffffff' : '1px solid rgba(0,0,0,.4)',
                            boxShadow: newPoolColor === c ? `0 0 10px ${c}` : 'none',
                            transform: newPoolColor === c ? 'scale(1.15)' : 'scale(1)',
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
                            border: '1px solid rgba(148,188,227,.3)',
                            background: 'transparent',
                            cursor: 'pointer'
                          }}
                        />
                        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: '#94bce3' }}>
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
                        border: '1px solid rgba(148,188,227,.2)',
                        background: 'transparent',
                        color: 'rgba(233,237,242,.7)',
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
                        border: 0,
                        background: 'linear-gradient(180deg, #6b91b6, #5980a6)',
                        color: '#ffffff',
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: isProcessingPool || !newPoolName.trim() ? 'not-allowed' : 'pointer',
                        opacity: isProcessingPool || !newPoolName.trim() ? 0.6 : 1
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
                    background: 'rgba(239,68,68,.12)',
                    border: '1px solid rgba(239,68,68,.35)',
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
                      color: '#f87171'
                    }}
                  >
                    Delete Pool "{deletingPool.name}"?
                  </div>

                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: 'rgba(233,237,242,.85)' }}>
                    {(poolCounts[deletingPool.name] || 0) > 0 ? (
                      <>
                        This pool currently contains{' '}
                        <strong style={{ color: '#b5d9fd' }}>{poolCounts[deletingPool.name]}</strong> assets. Choose a
                        pool to reassign them to:
                      </>
                    ) : (
                      'This pool has no assets and will be removed.'
                    )}
                  </div>

                  {(poolCounts[deletingPool.name] || 0) > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: 'rgba(233,237,242,.6)', textTransform: 'uppercase' }}>
                        Reassign assets to:
                      </span>
                      <select
                        value={reassignTarget}
                        onChange={(e) => setReassignTarget(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: '#0d141b',
                          border: '1px solid rgba(148,188,227,.3)',
                          color: '#e9edf2',
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
                        border: '1px solid rgba(148,188,227,.2)',
                        background: 'transparent',
                        color: '#e9edf2',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  style={{
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '10px',
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    color: 'rgba(233,237,242,.5)',
                    paddingLeft: '4px'
                  }}
                >
                  Configured Pools ({pools.length})
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

                    if (isEditing) {
                      return (
                        <div
                          key={p.id}
                          style={{
                            padding: '14px 16px',
                            borderRadius: '12px',
                            background: 'rgba(148,188,227,.12)',
                            border: '1px solid rgba(148,188,227,.35)',
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
                                color: '#b5d9fd'
                              }}
                            >
                              Edit Pool "{p.name}"
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontFamily: 'ui-monospace, monospace', fontSize: '9.5px', color: 'rgba(233,237,242,.6)', textTransform: 'uppercase' }}>
                                Pool Name
                              </label>
                              <input
                                type="text"
                                value={editPoolName}
                                onChange={(e) => setEditPoolName(e.target.value)}
                                style={{
                                  padding: '7px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(148,188,227,.3)',
                                  background: '#0d141b',
                                  color: '#e9edf2',
                                  fontFamily: 'Barlow, sans-serif',
                                  fontSize: '13px'
                                }}
                              />
                            </div>

                            <div style={{ flex: '2 1 260px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontFamily: 'ui-monospace, monospace', fontSize: '9.5px', color: 'rgba(233,237,242,.6)', textTransform: 'uppercase' }}>
                                Description
                              </label>
                              <input
                                type="text"
                                value={editPoolDesc}
                                onChange={(e) => setEditPoolDesc(e.target.value)}
                                style={{
                                  padding: '7px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(148,188,227,.3)',
                                  background: '#0d141b',
                                  color: '#e9edf2',
                                  fontFamily: 'Barlow, sans-serif',
                                  fontSize: '13px'
                                }}
                              />
                            </div>
                          </div>

                          {/* Color picker */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '9.5px', color: 'rgba(233,237,242,.6)', textTransform: 'uppercase', marginRight: '4px' }}>
                              Color:
                            </span>
                            {POOL_PRESET_COLORS.map((c) => (
                              <div
                                key={c}
                                onClick={() => setEditPoolColor(c)}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  background: c,
                                  cursor: 'pointer',
                                  border: editPoolColor === c ? '2px solid #ffffff' : '1px solid rgba(0,0,0,.4)',
                                  boxShadow: editPoolColor === c ? `0 0 8px ${c}` : 'none',
                                  transform: editPoolColor === c ? 'scale(1.15)' : 'scale(1)',
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
                                border: '1px solid rgba(148,188,227,.3)',
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
                                color: '#94bce3',
                                background: 'rgba(148,188,227,.08)',
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
                                border: '1px solid rgba(148,188,227,.2)',
                                background: 'transparent',
                                color: '#e9edf2',
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
                                border: 0,
                                background: 'linear-gradient(180deg, #6b91b6, #5980a6)',
                                color: '#ffffff',
                                fontFamily: "'Barlow Condensed', sans-serif",
                                fontSize: '12.5px',
                                fontWeight: 600,
                                cursor: isProcessingPool || !editPoolName.trim() ? 'not-allowed' : 'pointer'
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
                          background: 'var(--surface, #182636)',
                          border: '1px solid rgba(148,188,227,.12)',
                          transition: 'border-color 0.15s, background 0.15s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(148,188,227,.28)')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(148,188,227,.12)')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
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
                                  color: '#e9edf2'
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
                                  color: assetCount > 0 ? '#b5d9fd' : 'rgba(233,237,242,.4)',
                                  background: assetCount > 0 ? 'rgba(148,188,227,.18)' : 'rgba(148,188,227,.06)'
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
                                  color: 'rgba(233,237,242,.55)',
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
                              border: '1px solid rgba(148,188,227,.2)',
                              background: 'rgba(148,188,227,.08)',
                              color: '#b5d9fd',
                              fontFamily: 'ui-monospace, monospace',
                              fontSize: '10.5px',
                              cursor: 'pointer',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(148,188,227,.2)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(148,188,227,.08)')}
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
                              border: '1px solid rgba(239,68,68,.2)',
                              background: 'rgba(239,68,68,.08)',
                              color: '#f87171',
                              fontFamily: 'ui-monospace, monospace',
                              fontSize: '10.5px',
                              cursor: 'pointer',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,.22)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,.08)')}
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
            borderTop: '1px solid rgba(148,188,227,.14)',
            background: 'var(--surface, #182636)',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(148,188,227,.2)',
              background: 'transparent',
              color: 'var(--ink, #e9edf2)',
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
