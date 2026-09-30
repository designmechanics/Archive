import React, { useState, useEffect } from 'react';
import { DatabaseStats, DatabaseBackup, api } from '../services/api';
import { ThemeMode, Density, WatchedFolder } from '../types';

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
  motionMultiplier?: number;
  onMotionChange?: (m: number) => void;
}

type SettingsTab = 'database' | 'interface' | 'folders';

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
  onAddFolder
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('database');
  const [backups, setBackups] = useState<DatabaseBackup[]>([]);
  const [backingUp, setBackingUp] = useState(false);
  const [lastBackupMsg, setLastBackupMsg] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState('');

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
                    {folders.map((f) => (
                      <div
                        key={f.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderBottom: '1px solid rgba(148,188,227,.08)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: '#38ef7d',
                              flex: 'none'
                            }}
                          />
                          <span
                            style={{
                              fontFamily: 'ui-monospace, Menlo, monospace',
                              fontSize: '11px',
                              color: 'rgba(233,237,242,.85)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={f.path}
                          >
                            {f.path}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              fontFamily: 'ui-monospace, Menlo, monospace',
                              fontSize: '10px',
                              color: '#94bce3'
                            }}
                          >
                            {f.count} items
                          </span>
                          {onRemoveFolder && (
                            <button
                              onClick={() => onRemoveFolder(f.id)}
                              style={{
                                background: 'transparent',
                                border: 0,
                                color: '#ff6677',
                                cursor: 'pointer',
                                fontFamily: 'ui-monospace, Menlo, monospace',
                                fontSize: '11px'
                              }}
                              title="Remove watched folder"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
