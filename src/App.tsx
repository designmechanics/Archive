import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { AssetEntry, Density, ThemeMode, ViewMode, WatchedFolder } from './types';
import { CATS, KINDS, THEMES } from './data/seedData';
import {
  addWatchedFolder,
  getSetting,
  getWatchedFolders,
  loadEntries,
  loadDemoEntries,
  removeWatchedFolder,
  saveEntries,
  saveSetting,
  updateEntryCategory,
  clearAllEntries,
  getDatabaseStatus
} from './services/db';
import { api, DatabaseStats } from './services/api';

import { indexingEngine } from './services/indexingEngine';
import {
  createEntryFromPack,
  createPackFromBlob,
  createPackFromSingleFile
} from './services/zipService';
import { Rail } from './components/Rail';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { Stage } from './components/Stage';
import { SidePanel } from './components/SidePanel';
import { SelectionBar } from './components/SelectionBar';
import { IngestModal } from './components/IngestModal';
import { SettingsModal } from './components/SettingsModal';
import { DropOverlay } from './components/DropOverlay';


export const App: React.FC = () => {
  // Primary State
  const [entries, setEntries] = useState<AssetEntry[]>([]);
  const [view, setView] = useState<ViewMode>('grid');
  const [density, setDensity] = useState<Density>(4);
  const [query, setQuery] = useState('');
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [hoverPool, setHoverPool] = useState<string | null>(null);
  const [fanPool, setFanPool] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [stars, setStars] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [isDropVisible, setIsDropVisible] = useState(false);
  const [specimen, setSpecimen] = useState('Handgloves 1234');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [seed, setSeed] = useState(0);
  const [idxPct, setIdxPct] = useState(100);
  const [idxFile, setIdxFile] = useState('Archive ready · No background jobs');
  const [idxStatus, setIdxStatus] = useState<'idle' | 'scanning' | 'indexing' | 'complete' | 'error'>('idle');
  const [folders, setFolders] = useState<WatchedFolder[]>([]);
  const [accent, setAccent] = useState('#2c455d');
  const [motionMultiplier, setMotionMultiplier] = useState(1);
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);

  const dragCounterRef = useRef(0);

  // Initialize DB and load saved data
  useEffect(() => {
    const init = async () => {
      const loadedEntries = await loadEntries();
      setEntries(loadedEntries);

      const stats = await getDatabaseStatus();
      setDbStats(stats);


      const savedTheme = (localStorage.getItem('archive.theme') as ThemeMode) || 'dark';
      setTheme(savedTheme);

      const savedView = (localStorage.getItem('archive.view') as ViewMode) || 'grid';
      setView(savedView);

      const savedStars = await getSetting<Record<string, boolean>>('stars', {});
      setStars(savedStars);

      const loadedFolders = await getWatchedFolders();
      setFolders(loadedFolders);

      // Intro GSAP Animation
      gsap.set('[data-rail="1"]', { x: -260 });
      gsap.to('[data-rail="1"]', { x: 0, duration: 0.75, ease: 'expo.out' });
      gsap.fromTo(
        '[data-intro="1"]',
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.026, ease: 'power3.out', delay: 0.1 }
      );
    };

    init();
  }, []);

  // Theme Application
  useEffect(() => {
    const t = THEMES[theme] || THEMES.dark;
    const root = document.documentElement;
    localStorage.setItem('archive.theme', theme);

    Object.entries(t).forEach(([k, val]) => {
      root.style.setProperty(`--${k}`, val);
    });
    root.style.setProperty('--accent', accent);
    document.body.style.background = t.bg;

    // Random elastic scale pulse on reveal elements
    gsap.fromTo(
      '[data-reveal="1"]',
      { scale: 0.97 },
      {
        scale: 1,
        duration: 0.5 * motionMultiplier,
        ease: 'elastic.out(0.6, 0.6)',
        stagger: { each: 0.008, from: 'random' }
      }
    );
  }, [theme, accent, motionMultiplier]);

  // Connect to Real Indexing Engine
  useEffect(() => {
    return indexingEngine.subscribe((status) => {
      setIdxPct(status.percentage);
      setIdxFile(status.currentFile);
      setIdxStatus(status.status);
    });
  }, []);

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openId) setOpenId(null);
        else if (modalOpen) setModalOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
      }

      const isCarousel = ['coverflow', 'strip', 'radial', 'filmstrip', 'peel'].includes(view);
      if (!isCarousel) return;

      if (e.key === 'ArrowRight') {
        setFocusIndex((f) => Math.min(filteredEntries.length - 1, f + 1));
      } else if (e.key === 'ArrowLeft') {
        setFocusIndex((f) => Math.max(0, f - 1));
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Global Drag & Drop for Ingest
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;
      setIsDropVisible(true);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) {
        setIsDropVisible(false);
        dragCounterRef.current = 0;
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDropVisible(false);
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleIngestFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [entries]);

  // Filtered and sorted entries
  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    let vis = entries.filter((e) => {
      if (selectedPool && e.cat !== selectedPool) return false;
      if (!q) return true;
      const haystack = (
        e.title +
        ' ' +
        e.cat +
        ' ' +
        e.author +
        ' ' +
        e.deps +
        ' ' +
        (KINDS[e.type]?.[0] || '') +
        ' ' +
        (e.search || '')
      ).toLowerCase();
      return haystack.includes(q);
    });

    vis.sort((a, b) => b.date.localeCompare(a.date));

    if (seed > 0) {
      vis = vis.slice().sort(() => Math.random() - 0.5);
    }

    return vis;
  }, [entries, query, selectedPool, seed]);

  // Per-pool counts
  const poolCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CATS.forEach((c) => (counts[c] = 0));
    entries.forEach((e) => {
      counts[e.cat] = (counts[e.cat] || 0) + 1;
    });
    return counts;
  }, [entries]);

  // View switch handler with transition choreography
  const handleViewChange = (newView: ViewMode) => {
    if (newView === view) return;
    localStorage.setItem('archive.view', newView);

    const mid =
      newView === 'radial' || newView === 'filmstrip'
        ? Math.floor(filteredEntries.length / 2)
        : 0;

    const cards = Array.from(document.querySelectorAll('[data-card]')) as HTMLElement[];
    const activeCards = cards.filter((c) => c.style.pointerEvents !== 'none');
    const rows = Array.from(document.querySelectorAll('[data-row]')) as HTMLElement[];

    const switchState = () => {
      setView(newView);
      setFocusIndex(mid);
    };

    if (rows.length > 0) {
      gsap.to(rows, {
        x: 26,
        opacity: 0,
        duration: 0.24 * motionMultiplier,
        stagger: 0.008,
        ease: 'power2.in'
      });
    }

    if (activeCards.length > 0) {
      gsap.to(activeCards, {
        y: '+=54',
        opacity: 0,
        rotateX: -14,
        scale: 0.9,
        duration: 0.3 * motionMultiplier,
        stagger: { each: 0.011 * motionMultiplier, from: 'center' },
        ease: 'power2.in',
        onComplete: switchState
      });
    } else {
      switchState();
    }
  };

  // Star toggle
  const handleToggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStars((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      saveSetting('stars', next);
      return next;
    });
  };

  // Multi-selection toggle
  const handleToggleSelect = (id: string, _e: React.MouseEvent) => {
    setSelectedIds((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  // Throw selection into pool
  const handleThrowToPool = (cat: string) => {
    const ids = Object.keys(selectedIds);
    if (ids.length === 0) return;

    // Get pool target position in rail
    const poolEl = document.querySelector(`[data-pool="${cat}"]`) as HTMLElement;
    const railEl = document.querySelector('[data-rail="1"]') as HTMLElement;
    const stEl = document.querySelector('[data-stage="1"]') as HTMLElement;

    let targetX = -160;
    let targetY = 120;

    if (poolEl && stEl) {
      const a = poolEl.getBoundingClientRect();
      const b = stEl.getBoundingClientRect();
      targetX = a.left - b.left + 8;
      targetY = a.top - b.top + a.height / 2 - 20;
    }

    // Animate selected cards
    ids.forEach((id, i) => {
      const el = document.querySelector(`[data-card="${id}"]`);
      if (el) {
        gsap.to(el, {
          x: targetX,
          y: targetY,
          scale: 0.1,
          rotateZ: -30 + i * 8,
          opacity: 0,
          duration: 0.6 * motionMultiplier,
          ease: 'power3.inOut',
          delay: i * 0.04 * motionMultiplier,
          overwrite: true
        });
      }
    });

    // Pulse pool row in rail
    if (poolEl) {
      gsap.fromTo(
        poolEl,
        { scale: 1 },
        {
          scale: 1.06,
          duration: 0.22,
          yoyo: true,
          repeat: 1,
          ease: 'power2.out',
          delay: 0.5 * motionMultiplier
        }
      );
    }

    // Update state and persistence
    setTimeout(() => {
      setEntries((prev) =>
        prev.map((e) => (ids.includes(e.id) ? { ...e, cat } : e))
      );
      setSelectedIds({});
      ids.forEach((id) => updateEntryCategory(id, cat));
    }, 700 * motionMultiplier + ids.length * 40);
  };

  // Ingestion of files via Real Indexing Engine
  const handleIngestFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setModalOpen(false);

    const newEntries = await indexingEngine.ingestFileList(files, (entry) => {
      setEntries((prev) => [entry, ...prev]);
    });

    if (newEntries.length > 0) {
      setSelectedPool(null);
      setQuery('');
      setFocusIndex(0);
      setTimeout(() => {
        setOpenId(newEntries[0].id);
      }, 650 * motionMultiplier);
    }
  };

  // Real native folder crawl (File System Access API)
  const handleScanNativeFolder = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        // @ts-ignore
        const dirHandle = await window.showDirectoryPicker();
        const res = await indexingEngine.scanDirectoryPicker(dirHandle, (entry) => {
          setEntries((prev) => [entry, ...prev]);
        });
        setFolders((prev) => [res.folder, ...prev]);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Directory scan error:', err);
        }
      }
    }
  };

  // Add Watched Folder
  const handleAddFolder = async (folderPath: string) => {
    const updated = await addWatchedFolder(folderPath, '0');
    setFolders(updated);
  };

  // Direct fast Node disk scan into SQLite archive.db
  const handleScanDiskFolder = async (folderPath: string) => {
    indexingEngine.scanDiskFolder(folderPath, async (freshAssets) => {
      setEntries(freshAssets);
      const stats = await getDatabaseStatus();
      setDbStats(stats);
      const updatedFolders = await getWatchedFolders();
      setFolders(updatedFolders);
    });
  };

  // SQLite Database Optimize (VACUUM and PRAGMA optimize)
  const handleOptimizeDb = async () => {
    const updated = await api.optimizeDatabase();
    if (updated) setDbStats(updated);
  };

  // Clear all assets from SQLite archive.db and state
  const handleClearAll = async () => {
    await clearAllEntries();
    setEntries([]);
    const stats = await getDatabaseStatus();
    setDbStats(stats);
  };

  // Remove Watched Folder
  const handleRemoveFolder = async (id: string) => {
    const updated = await removeWatchedFolder(id);
    setFolders(updated);
  };


  // Active open entry
  const openEntry = useMemo(() => {
    return entries.find((e) => e.id === openId) || null;
  }, [entries, openId]);

  // Next in pool handler
  const handleNextInPool = () => {
    if (!openEntry || filteredEntries.length === 0) return;
    const curIdx = filteredEntries.findIndex((e) => e.id === openEntry.id);
    const nextIdx = (curIdx + 1) % filteredEntries.length;
    const nextEntry = filteredEntries[nextIdx];
    if (nextEntry) {
      setOpenId(nextEntry.id);
      setFocusIndex(nextIdx);
    }
  };

  const handleLoadDemoCatalog = async () => {
    const demos = await loadDemoEntries();
    setEntries(demos);
    setStars({ a1: true, a10: true, a48: true });
    saveSetting('stars', { a1: true, a10: true, a48: true });
  };

  const handleClearFilters = () => {
    setQuery('');
    setSelectedPool(null);
    setFocusIndex(0);
  };

  const selectedCount = Object.keys(selectedIds).length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        gridTemplateColumns: '252px 1fr',
        background: 'var(--bg, #f2f2f3)',
        color: 'var(--ink, #1d1f20)',
        fontFamily: 'Barlow, system-ui, sans-serif',
        fontSize: '15px',
        lineHeight: 1.5,
        overflow: 'hidden'
      }}
    >
      {/* Left Rail */}
      <Rail
        totalCount={entries.length}
        poolCounts={poolCounts}
        selectedPool={selectedPool}
        onSelectPool={(p) => {
          setSelectedPool(p);
          setFocusIndex(0);
          setSeed(0);
        }}
        onHoverPool={setHoverPool}
        fanPool={fanPool}
        onToggleFan={(p) => setFanPool((curr) => (curr === p ? null : p))}
        folders={folders}
        onOpenModal={() => setModalOpen(true)}
        onRemoveFolder={handleRemoveFolder}
        indexPct={idxPct}
        indexFile={idxFile}
        indexStatus={idxStatus}
        dbSize={dbStats?.dbSizeFormatted}
        dbPath={dbStats?.dbPath}
        onOptimizeDb={handleOptimizeDb}
        onClearAll={handleClearAll}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <section
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden'
        }}
      >
        {/* Header Row */}
        <Header
          query={query}
          onQueryChange={(q) => {
            setQuery(q);
            setFocusIndex(0);
            setSeed(0);
          }}
          totalCount={entries.length}
          filteredCount={filteredEntries.length}
          selectedPool={selectedPool}
          theme={theme}
          onThemeChange={setTheme}
          onShuffle={() => {
            setSeed((s) => s + 1);
            setFocusIndex(0);
          }}
          onOpenModal={() => setModalOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          accent={accent}
        />


        {/* Toolbar Row */}
        <Toolbar
          view={view}
          onViewChange={handleViewChange}
          density={density}
          onDensityChange={setDensity}
          focusIndex={focusIndex}
          totalVisible={filteredEntries.length}
          onPrev={() => setFocusIndex((f) => Math.max(0, f - 1))}
          onNext={() => setFocusIndex((f) => Math.min(filteredEntries.length - 1, f + 1))}
          accent={accent}
        />

        {/* Stage / Card Layout Area */}
        <Stage
          entries={filteredEntries}
          allEntries={entries}
          view={view}
          density={density}
          focusIndex={focusIndex}
          onFocusChange={setFocusIndex}
          onSelectEntry={(id) => setOpenId(id)}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          stars={stars}
          onToggleStar={handleToggleStar}
          hoverPool={hoverPool}
          accent={accent}
          motionMultiplier={motionMultiplier}
          onOpenModal={() => setModalOpen(true)}
          onScanNativeFolder={handleScanNativeFolder}
          onLoadDemoCatalog={handleLoadDemoCatalog}
          onClearFilters={handleClearFilters}
          query={query}
          selectedPool={selectedPool}
        />

        {/* Floating Selection Bar */}
        <SelectionBar
          selectedCount={selectedCount}
          onClear={() => setSelectedIds({})}
          onThrowToPool={handleThrowToPool}
          motionMultiplier={motionMultiplier}
        />
      </section>

      {/* Slide-in Side Panel */}
      <SidePanel
        entry={openEntry}
        onClose={() => setOpenId(null)}
        onNextInPool={handleNextInPool}
        specimenText={specimen}
        onSpecimenChange={setSpecimen}
        motionMultiplier={motionMultiplier}
      />

      {/* Fullscreen Drop Overlay */}
      <DropOverlay isVisible={isDropVisible} />

      {/* Ingest Modal */}
      <IngestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onIngestFiles={handleIngestFiles}
        onAddFolder={handleAddFolder}
        onScanNativeFolder={handleScanNativeFolder}
        onScanDiskFolder={handleScanDiskFolder}
      />

      {/* Settings & Backups Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        dbStats={dbStats}
        onOptimizeDb={handleOptimizeDb}
        onClearAll={handleClearAll}
        theme={theme}
        onThemeChange={setTheme}
        density={density}
        onDensityChange={setDensity}
        folders={folders}
        onRemoveFolder={handleRemoveFolder}
        onAddFolder={handleAddFolder}
        motionMultiplier={motionMultiplier}
        onMotionChange={setMotionMultiplier}
      />
    </div>
  );
};

