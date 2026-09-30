import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { AssetEntry, Density, ThemeMode, ViewMode, WatchedFolder, Pool, MaxPerPage, ActiveZipArchive, SortOption, SortDirection } from './types';
import { sortEntries, SORT_CONFIGS } from './services/sortService';
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
  getDatabaseStatus,
  loadPools,
  createPool,
  editPool,
  removePool,
  toggleWatchedFolder
} from './services/db';
import { isEntryInFolder } from './utils/folderUtils';
import { api, DatabaseStats } from './services/api';

import { indexingEngine } from './services/indexingEngine';
import {
  createEntryFromPack,
  createPackFromBlob,
  createPackFromSingleFile,
  extractZipEntries,
  generateInnerZipVideoThumbnail,
  isZipArchive
} from './services/zipService';
import { ensureThumbnailForEntry } from './services/thumbnailService';
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
  const [isStudioMode, setIsStudioMode] = useState(false);
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
  const [selectedFolder, setSelectedFolder] = useState<WatchedFolder | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [accent, setAccent] = useState('#2c455d');
  const [motionMultiplier, setMotionMultiplier] = useState(1);
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [maxPerPage, setMaxPerPage] = useState<MaxPerPage>(() => {
    const saved = localStorage.getItem('archive.maxPerPage');
    if (saved === 'ALL') return 'ALL';
    const parsed = saved ? parseInt(saved, 10) : 64;
    if ([256, 128, 64, 48, 32, 24, 16].includes(parsed)) {
      return parsed as MaxPerPage;
    }
    return 64;
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    const saved = localStorage.getItem('archive.sortOption');
    return (saved as SortOption) || 'name';
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const saved = localStorage.getItem('archive.sortDirection');
    return (saved as SortDirection) || 'asc';
  });

  const handleSortChange = (opt: SortOption, dir?: SortDirection) => {
    setSortOption(opt);
    localStorage.setItem('archive.sortOption', opt);
    if (dir) {
      setSortDirection(dir);
      localStorage.setItem('archive.sortDirection', dir);
    } else {
      const defaultDir = SORT_CONFIGS[opt]?.defaultDirection || 'asc';
      setSortDirection(defaultDir);
      localStorage.setItem('archive.sortDirection', defaultDir);
    }
  };

  const handleToggleSortDirection = () => {
    const nextDir = sortDirection === 'asc' ? 'desc' : 'asc';
    setSortDirection(nextDir);
    localStorage.setItem('archive.sortDirection', nextDir);
  };
  const [deferFolderIngestion, setDeferFolderIngestion] = useState<boolean>(() => {
    const saved = localStorage.getItem('archive.deferFolderIngestion');
    return saved !== 'false';
  });
  const [folderNotification, setFolderNotification] = useState<{
    id: string;
    folderName: string;
    count: number | string;
    folder?: WatchedFolder | null;
  } | null>(null);
  const notificationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Active ZIP archive drill-down view state
  const [activeZipArchive, setActiveZipArchive] = useState<ActiveZipArchive | null>(null);

  // Viewed history for pool fan preview (tracks last items opened/viewed)
  const [viewedHistory, setViewedHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('archive.viewedHistory');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Track viewed items whenever an entry is opened
  useEffect(() => {
    if (!openId) return;
    const targetEntry = activeZipArchive
      ? activeZipArchive.innerEntries.find((e) => e.id === openId)
      : entries.find((e) => e.id === openId);

    const idsToRecord: string[] = [openId];
    if (targetEntry?.isZipInnerFile && (targetEntry.zipParentId || targetEntry.packId)) {
      idsToRecord.push(targetEntry.zipParentId || targetEntry.packId!);
    }

    setViewedHistory((prev) => {
      const filtered = prev.filter((id) => !idsToRecord.includes(id));
      const updated = [...idsToRecord, ...filtered].slice(0, 200);
      localStorage.setItem('archive.viewedHistory', JSON.stringify(updated));
      return updated;
    });
  }, [openId, activeZipArchive, entries]);

  const showFolderNotification = (folderName: string, count: number | string, folder?: WatchedFolder | null) => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    setFolderNotification({
      id: 'notif_' + Date.now(),
      folderName,
      count,
      folder
    });
    notificationTimerRef.current = setTimeout(() => {
      setFolderNotification(null);
    }, 6500);
  };

  const handleToggleDeferFolderIngestion = (val: boolean) => {
    setDeferFolderIngestion(val);
    localStorage.setItem('archive.deferFolderIngestion', String(val));
  };

  const handleOpenZipContents = async (entry: AssetEntry) => {
    try {
      // Record ZIP in viewed history so it is recognized as viewed in its pool
      setViewedHistory((prev) => {
        const updated = [entry.id, ...prev.filter((id) => id !== entry.id)].slice(0, 200);
        localStorage.setItem('archive.viewedHistory', JSON.stringify(updated));
        return updated;
      });

      const inners = await extractZipEntries(entry);
      if (inners.length > 0) {
        setActiveZipArchive({
          parent: entry,
          innerEntries: inners
        });
        setFocusIndex(0);
        setCurrentPage(1);
        setOpenId(null);
        setQuery('');
      } else {
        setOpenId(entry.id);
      }
    } catch (err) {
      console.warn('Failed to extract zip entries:', err);
      setOpenId(entry.id);
    }
  };

  const handleCloseZipContents = () => {
    setActiveZipArchive(null);
    setFocusIndex(0);
    setCurrentPage(1);
  };

  // Progressive background video thumbnail generator for active zip archive
  useEffect(() => {
    if (!activeZipArchive) return;
    const missing = activeZipArchive.innerEntries.filter(
      (e) => !e.thumb && (e.type === 'video' || (e.exts && ['mp4', 'webm', 'mov', 'm4v'].some((x) => e.exts.includes(x))))
    );
    if (missing.length === 0) return;

    let cancelled = false;

    const processMissing = async () => {
      // Process in concurrent batches of 2
      for (let i = 0; i < missing.length; i += 2) {
        if (cancelled) break;
        const batch = missing.slice(i, i + 2);
        await Promise.all(
          batch.map(async (item) => {
            try {
              const thumbUrl = await generateInnerZipVideoThumbnail(item, activeZipArchive.parent);
              if (thumbUrl && !cancelled) {
                setActiveZipArchive((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    innerEntries: prev.innerEntries.map((e) =>
                      e.id === item.id ? { ...e, thumb: thumbUrl } : e
                    )
                  };
                });
              }
            } catch (err) {
              console.warn('Background inner video thumbnail error:', err);
            }
          })
        );
      }
    };

    processMissing();

    return () => {
      cancelled = true;
    };
  }, [activeZipArchive?.parent.id]);

  const dragCounterRef = useRef(0);
  const nativeDirInputRef = useRef<HTMLInputElement>(null);

  // Initialize DB and load saved data
  useEffect(() => {
    const init = async () => {
      const loadedEntries = await loadEntries();
      setEntries(loadedEntries);

      // Auto-heal thumbnails for assets without snapshots (PDFs, videos, images)
      const missing = loadedEntries.filter((e) => !e.thumb);
      if (missing.length > 0) {
        setTimeout(async () => {
          for (const item of missing) {
            try {
              const thumbUrl = await ensureThumbnailForEntry(item);
              if (thumbUrl) {
                setEntries((prev) =>
                  prev.map((x) => (x.id === item.id ? { ...x, thumb: thumbUrl } : x))
                );
              }
            } catch (err) {
              console.warn('Auto-thumbnail error for asset:', item.id, err);
            }
          }
        }, 300);
      }

      const stats = await getDatabaseStatus();
      setDbStats(stats);

      const loadedPools = await loadPools();
      setPools(loadedPools);

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
    root.dataset.theme = theme;
    document.body.dataset.theme = theme;

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
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'Escape') {
        if (openId) setOpenId(null);
        else if (activeZipArchive) handleCloseZipContents();
        else if (modalOpen) setModalOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        return;
      }

      if (openId) {
        if (e.key === 'ArrowRight' || e.key === ']') {
          handleNextInPool();
          return;
        } else if (e.key === 'ArrowLeft' || e.key === '[') {
          handlePrevInPool();
          return;
        }
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

    // If active ZIP archive drill-down view is open:
    if (activeZipArchive) {
      let vis = activeZipArchive.innerEntries;
      if (q) {
        vis = vis.filter((e) => {
          const haystack = (
            e.title +
            ' ' +
            e.cat +
            ' ' +
            (KINDS[e.type]?.[0] || '') +
            ' ' +
            (e.search || '')
          ).toLowerCase();
          return haystack.includes(q);
        });
      }
      if (seed > 0) {
        vis = vis.slice().sort(() => Math.random() - 0.5);
      } else {
        vis = sortEntries(vis, sortOption, sortDirection);
      }
      return vis;
    }

    const disabledFolders = folders.filter((f) => f.enabled === false);
    const ingestingFolders = deferFolderIngestion ? folders.filter((f) => f.isIngesting) : [];

    let vis = entries.filter((e) => {
      // Exclude assets belonging to disabled watched folders
      if (disabledFolders.some((df) => isEntryInFolder(e, df))) {
        return false;
      }
      // Exclude assets belonging to currently ingesting folders when deferFolderIngestion is active
      if (ingestingFolders.some((inf) => isEntryInFolder(e, inf))) {
        return false;
      }
      // Filter by selectedFolder if one is chosen
      if (selectedFolder && !isEntryInFolder(e, selectedFolder)) {
        return false;
      }
      // Filter by selectedPool if one is chosen
      if (selectedPool && e.cat !== selectedPool) {
        return false;
      }

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

    if (seed > 0) {
      vis = vis.slice().sort(() => Math.random() - 0.5);
    } else {
      vis = sortEntries(vis, sortOption, sortDirection);
    }

    return vis;
  }, [entries, query, selectedPool, selectedFolder, folders, seed, deferFolderIngestion, activeZipArchive, sortOption, sortDirection]);

  // Pagination & Max Per Page logic
  const totalPages = useMemo(() => {
    if (maxPerPage === 'ALL') return 1;
    return Math.max(1, Math.ceil(filteredEntries.length / maxPerPage));
  }, [filteredEntries.length, maxPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages]);

  const pagedEntries = useMemo(() => {
    if (maxPerPage === 'ALL') return filteredEntries;
    const start = (currentPage - 1) * maxPerPage;
    return filteredEntries.slice(start, start + maxPerPage);
  }, [filteredEntries, maxPerPage, currentPage]);

  const handleMaxPerPageChange = (val: MaxPerPage) => {
    setMaxPerPage(val);
    setCurrentPage(1);
    setFocusIndex(0);
    localStorage.setItem('archive.maxPerPage', String(val));
  };

  // Per-watched-folder live asset counts
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    folders.forEach((f) => {
      counts[f.id] = entries.filter((e) => isEntryInFolder(e, f)).length;
    });
    return counts;
  }, [entries, folders]);

  // Per-pool counts
  const poolCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (pools.length > 0) {
      pools.forEach((p) => (counts[p.name] = 0));
    } else {
      CATS.forEach((c) => (counts[c] = 0));
    }
    entries.forEach((e) => {
      counts[e.cat] = (counts[e.cat] || 0) + 1;
    });
    return counts;
  }, [entries, pools]);

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

    // Auto-detect root directory name from webkitRelativePath if present
    const firstFile = files[0] as any;
    let topDir: string | undefined;
    let newFolderId: string | undefined;
    if (firstFile?.webkitRelativePath) {
      topDir = firstFile.webkitRelativePath.split('/')[0];
      if (topDir) {
        const tempFolder: WatchedFolder = {
          id: 'f_' + Date.now(),
          path: topDir,
          count: '…',
          enabled: true,
          isIngesting: true,
          ingestStatus: 'scanning'
        };
        setFolders((prev) => [
          tempFolder,
          ...prev.filter((f) => f.path.toLowerCase() !== topDir!.toLowerCase())
        ]);
      }
    }

    const staged: AssetEntry[] = [];

    const newEntries = await indexingEngine.ingestFileList(
      files,
      (entry) => {
        if (!deferFolderIngestion && !topDir) {
          setEntries((prev) => [entry, ...prev]);
        } else {
          staged.push(entry);
        }
      },
      { folderName: topDir, folderId: newFolderId }
    );

    if (topDir) {
      const updatedFolders = await addWatchedFolder(topDir, String(newEntries.length));
      const readyFolders = updatedFolders.map((f) =>
        f.path.toLowerCase() === topDir!.toLowerCase()
          ? { ...f, isIngesting: false, ingestStatus: undefined }
          : f
      );
      setFolders(readyFolders);

      if (deferFolderIngestion || topDir) {
        setEntries((prev) => [...staged, ...prev]);
      }

      const readyFolder = readyFolders.find(
        (f) => f.path.toLowerCase() === topDir!.toLowerCase()
      );
      showFolderNotification(topDir, newEntries.length, readyFolder || null);
    } else if (deferFolderIngestion && staged.length > 0) {
      setEntries((prev) => [...staged, ...prev]);
    }

    if (newEntries.length > 0) {
      setSelectedPool(null);
      setSelectedFolder(null);
      setQuery('');
      setFocusIndex(0);
      setTimeout(() => {
        setOpenId(newEntries[0].id);
      }, 650 * motionMultiplier);
    }
  };

  // Real native folder crawl (File System Access API with OS dialog fallback)
  const handleScanNativeFolder = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        // @ts-ignore
        const dirHandle = await window.showDirectoryPicker();
        const folderName = dirHandle.name;

        // Mark folder as ingesting in state immediately
        setFolders((prev) => {
          const existingIdx = prev.findIndex(
            (f) => f.path.toLowerCase() === folderName.toLowerCase()
          );
          if (existingIdx >= 0) {
            const copy = [...prev];
            copy[existingIdx] = {
              ...copy[existingIdx],
              isIngesting: true,
              ingestStatus: 'scanning'
            };
            return copy;
          } else {
            return [
              {
                id: 'f_' + Date.now(),
                path: folderName,
                count: '…',
                enabled: true,
                isIngesting: true,
                ingestStatus: 'scanning'
              },
              ...prev
            ];
          }
        });

        const staged: AssetEntry[] = [];

        const res = await indexingEngine.scanDirectoryPicker(dirHandle, (entry) => {
          if (!deferFolderIngestion) {
            setEntries((prev) => [entry, ...prev]);
          } else {
            staged.push(entry);
          }
        });

        const updatedFolders = await addWatchedFolder(res.folder.path, res.folder.count);
        const readyFolders = updatedFolders.map((f) =>
          f.path.toLowerCase() === res.folder.path.toLowerCase()
            ? { ...f, isIngesting: false, ingestStatus: undefined }
            : f
        );
        setFolders(readyFolders);

        if (deferFolderIngestion && staged.length > 0) {
          setEntries((prev) => [...staged, ...prev]);
        }

        const readyFolder = readyFolders.find(
          (f) => f.path.toLowerCase() === res.folder.path.toLowerCase()
        );
        showFolderNotification(folderName, res.folder.count, readyFolder || res.folder);
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          // If aborted, clean up any ghosted placeholder that was added
          setFolders((prev) => prev.filter((f) => !f.isIngesting || f.count !== '…'));
          return;
        }
        console.warn('Directory scan via showDirectoryPicker failed, using file dialog:', err);
      }
    }

    // Direct fallback to HTML5 directory picker
    if (nativeDirInputRef.current) {
      nativeDirInputRef.current.click();
    }
  };

  // Add Watched Folder - immediately scan and stage into library
  const handleAddFolder = async (folderPath: string) => {
    const trimmed = folderPath.trim();
    if (!trimmed) return;
    await handleScanDiskFolder(trimmed);
  };

  // Select Watched Folder for Filtering
  const handleSelectFolder = (folder: WatchedFolder | null) => {
    if (activeZipArchive) setActiveZipArchive(null);
    setSelectedFolder(folder);
    setFocusIndex(0);
    setSeed(0);
    setCurrentPage(1);
  };

  // Toggle Watched Folder Enabled/Disabled
  const handleToggleFolderEnabled = async (id: string, enabled: boolean) => {
    const updated = await toggleWatchedFolder(id, enabled);
    setFolders(updated);
    if (!enabled && selectedFolder?.id === id) {
      setSelectedFolder(null);
    }
  };

  // Direct fast Node disk scan into SQLite archive.db
  const handleScanDiskFolder = async (folderPath: string) => {
    const normPath = folderPath.trim();
    if (!normPath) return;

    // Mark or insert folder in folders list with isIngesting: true immediately
    setFolders((prev) => {
      const existingIdx = prev.findIndex(
        (f) => f.path.toLowerCase() === normPath.toLowerCase()
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = {
          ...copy[existingIdx],
          isIngesting: true,
          ingestStatus: 'scanning'
        };
        return copy;
      } else {
        const newFolder: WatchedFolder = {
          id: 'f_' + Date.now(),
          path: normPath,
          count: '…',
          enabled: true,
          isIngesting: true,
          ingestStatus: 'scanning'
        };
        return [newFolder, ...prev];
      }
    });

    indexingEngine.scanDiskFolder(
      normPath,
      async (freshAssets) => {
        const updatedFolders = await getWatchedFolders();
        // Clear isIngesting flag on all returned folders
        const clearedFolders = updatedFolders.map((f) => ({
          ...f,
          isIngesting: false,
          ingestStatus: undefined
        }));
        setFolders(clearedFolders);

        setEntries(freshAssets);
        const stats = await getDatabaseStatus();
        setDbStats(stats);

        const matchedFolder = clearedFolders.find(
          (f) => f.path.toLowerCase() === normPath.toLowerCase()
        );
        const folderBase = normPath.split(/[\\/]/).filter(Boolean).pop() || normPath;
        const count = matchedFolder?.count || freshAssets.length;

        showFolderNotification(folderBase, count, matchedFolder || null);

        // Auto-generate thumbnails for fresh disk assets missing thumbnails
        const missing = freshAssets.filter((e) => !e.thumb);
        for (const item of missing) {
          try {
            const thumbUrl = await ensureThumbnailForEntry(item);
            if (thumbUrl) {
              setEntries((prev) =>
                prev.map((x) => (x.id === item.id ? { ...x, thumb: thumbUrl } : x))
              );
            }
          } catch {}
        }
      },
      (error) => {
        console.warn('Disk scan failed or aborted:', error);
        setFolders((prev) =>
          prev.map((f) =>
            f.path.toLowerCase() === normPath.toLowerCase()
              ? { ...f, isIngesting: false, ingestStatus: 'error' }
              : f
          )
        );
      }
    );
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
    setSelectedFolder(null);
    const stats = await getDatabaseStatus();
    setDbStats(stats);
  };

  // Remove Watched Folder
  const handleRemoveFolder = async (id: string) => {
    if (selectedFolder?.id === id) {
      setSelectedFolder(null);
    }
    const updated = await removeWatchedFolder(id);
    setFolders(updated);
  };

  // Pools Management Handlers
  const handleAddPool = async (newPool: { name: string; description?: string; color?: string; sortOrder?: number }) => {
    const updated = await createPool(newPool);
    setPools(updated);
  };

  const handleEditPool = async (id: string, updates: Partial<Pool>) => {
    const target = pools.find((p) => p.id === id);
    const oldName = target?.name;
    const updated = await editPool(id, updates);
    setPools(updated);

    if (oldName && updates.name && oldName !== updates.name) {
      setEntries((prev) => prev.map((e) => (e.cat === oldName ? { ...e, cat: updates.name! } : e)));
      if (selectedPool === oldName) setSelectedPool(updates.name);
    }
  };

  const handleDeletePool = async (id: string, reassignTo?: string) => {
    const target = pools.find((p) => p.id === id);
    const oldName = target?.name;
    const fallback = reassignTo || 'Uncategorized';
    const updated = await removePool(id, fallback);
    setPools(updated);

    if (oldName) {
      setEntries((prev) => prev.map((e) => (e.cat === oldName ? { ...e, cat: fallback } : e)));
      if (selectedPool === oldName) setSelectedPool(null);
    }
  };



  // Active open entry
  const openEntry = useMemo(() => {
    if (!openId) return null;
    if (activeZipArchive) {
      const inner = activeZipArchive.innerEntries.find((e) => e.id === openId);
      if (inner) return inner;
    }
    return entries.find((e) => e.id === openId) || null;
  }, [entries, openId, activeZipArchive]);

  // Previous in pool handler
  const handlePrevInPool = () => {
    if (!openEntry || filteredEntries.length === 0) return;
    const curIdx = filteredEntries.findIndex((e) => e.id === openEntry.id);
    const prevIdx = (curIdx - 1 + filteredEntries.length) % filteredEntries.length;
    const prevEntry = filteredEntries[prevIdx];
    if (prevEntry) {
      setOpenId(prevEntry.id);
      setFocusIndex(prevIdx);
    }
  };

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
    setSelectedFolder(null);
    setFocusIndex(0);
    setCurrentPage(1);
  };

  const selectedCount = Object.keys(selectedIds).length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        gridTemplateColumns: 'var(--rail-width, 252px) 1fr',
        background: 'var(--bg, #f2f2f3)',
        color: 'var(--ink, #1d1f20)',
        fontFamily: 'Barlow, system-ui, sans-serif',
        fontSize: 'var(--app-font-size, 15px)',
        lineHeight: 1.5,
        overflow: 'hidden'
      }}
    >
      {/* Left Rail */}
      <Rail
        theme={theme}
        totalCount={entries.length}
        poolCounts={poolCounts}
        selectedPool={selectedPool}
        onSelectPool={(p) => {
          if (activeZipArchive) setActiveZipArchive(null);
          setSelectedPool(p);
          setFocusIndex(0);
          setSeed(0);
          setCurrentPage(1);
        }}
        onHoverPool={setHoverPool}
        fanPool={fanPool}
        onToggleFan={(p) => setFanPool((curr) => (curr === p ? null : p))}
        folders={folders}
        selectedFolder={selectedFolder}
        onSelectFolder={handleSelectFolder}
        onToggleFolderEnabled={handleToggleFolderEnabled}
        folderCounts={folderCounts}
        pools={pools}
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
        entries={entries}
        viewedHistory={viewedHistory}
        onSelectEntry={(id) => {
          if (activeZipArchive) {
            const isInner = activeZipArchive.innerEntries.some((e) => e.id === id);
            if (!isInner) {
              setActiveZipArchive(null);
            }
          }
          setOpenId(id);
        }}
        onOpenZipContents={handleOpenZipContents}
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
            setCurrentPage(1);
          }}
          totalCount={activeZipArchive ? activeZipArchive.innerEntries.length : entries.length}
          filteredCount={filteredEntries.length}
          selectedPool={selectedPool}
          selectedFolder={selectedFolder}
          onClearFolder={() => {
            setSelectedFolder(null);
            setCurrentPage(1);
          }}
          theme={theme}
          onThemeChange={setTheme}
          onShuffle={() => {
            setSeed((s) => s + 1);
            setFocusIndex(0);
            setCurrentPage(1);
          }}
          isShuffled={seed > 0}
          onRevertShuffle={() => {
            setSeed(0);
            setFocusIndex(0);
            setCurrentPage(1);
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
          totalVisible={pagedEntries.length}
          totalCount={filteredEntries.length}
          onPrev={() => setFocusIndex((f) => Math.max(0, f - 1))}
          onNext={() => setFocusIndex((f) => Math.min(pagedEntries.length - 1, f + 1))}
          accent={accent}
          maxPerPage={maxPerPage}
          onMaxPerPageChange={handleMaxPerPageChange}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(p) => {
            setCurrentPage(p);
            setFocusIndex(0);
          }}
          sortOption={sortOption}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          onToggleSortDirection={handleToggleSortDirection}
        />

        {/* Archive Contents Active Header / Exit Bar */}
        {activeZipArchive && (
          <div
            data-zip-banner="1"
            style={{
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 24px',
              background: theme === 'light'
                ? 'linear-gradient(90deg, rgba(255, 255, 255, 0.98) 0%, rgba(241, 245, 249, 0.96) 100%)'
                : 'linear-gradient(90deg, rgba(29, 45, 61, 0.96) 0%, rgba(20, 32, 45, 0.94) 100%)',
              borderBottom: theme === 'light'
                ? '1px solid rgba(15, 23, 42, 0.1)'
                : '1px solid rgba(148, 188, 227, 0.35)',
              boxShadow: theme === 'light'
                ? '0 4px 16px rgba(15, 23, 42, 0.06)'
                : '0 4px 20px rgba(0, 0, 0, 0.35)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              zIndex: 15,
              animation: 'slideDownZipBanner 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '11px',
                  background: theme === 'light' ? 'rgba(37, 99, 235, 0.08)' : 'rgba(148, 188, 227, 0.16)',
                  border: theme === 'light' ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid rgba(148, 188, 227, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none',
                  fontSize: '20px'
                }}
              >
                📦
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: '9.5px',
                      letterSpacing: '.14em',
                      textTransform: 'uppercase',
                      color: theme === 'light' ? '#1d4ed8' : '#94bce3',
                      fontWeight: 700
                    }}
                  >
                    Archive Contents
                  </span>
                  <span
                    style={{
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: '9px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: 'rgba(56, 239, 125, 0.16)',
                      border: '1px solid rgba(56, 239, 125, 0.35)',
                      color: theme === 'light' ? '#15803d' : '#38ef7d',
                      fontWeight: 700
                    }}
                  >
                    {activeZipArchive.innerEntries.length} ITEMS
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: '21px',
                    fontWeight: 700,
                    color: theme === 'light' ? '#0f172a' : '#ffffff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.15
                  }}
                  title={activeZipArchive.parent.title}
                >
                  {activeZipArchive.parent.title}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 'none' }}>
              {/* Big Matching UI Close Icon Button */}
              <button
                onClick={handleCloseZipContents}
                title="Close Archive View & Return to Library (Esc)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 102, 119, 0.5)',
                  background: 'linear-gradient(180deg, rgba(255, 102, 119, 0.18), rgba(255, 102, 119, 0.1))',
                  color: '#ff8899',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  boxShadow: '0 2px 14px rgba(255, 102, 119, 0.2)',
                  transition: 'all 0.18s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(180deg, rgba(255, 102, 119, 0.35), rgba(255, 102, 119, 0.2))';
                  e.currentTarget.style.borderColor = '#ff6677';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 18px rgba(255, 102, 119, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(180deg, rgba(255, 102, 119, 0.18), rgba(255, 102, 119, 0.1))';
                  e.currentTarget.style.borderColor = 'rgba(255, 102, 119, 0.5)';
                  e.currentTarget.style.color = '#ff8899';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 14px rgba(255, 102, 119, 0.2)';
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span>Close Archive View</span>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    background: 'rgba(0, 0, 0, 0.35)',
                    color: 'rgba(255, 255, 255, 0.75)',
                    marginLeft: '2px'
                  }}
                >
                  ESC
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Stage / Card Layout Area */}
        <Stage
          theme={theme}
          entries={pagedEntries}
          allEntries={activeZipArchive ? activeZipArchive.innerEntries : entries}
          view={view}
          density={density}
          focusIndex={focusIndex}
          onFocusChange={setFocusIndex}
          onSelectEntry={(id) => setOpenId(id)}
          onOpenZipContents={handleOpenZipContents}
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
          selectedFolder={selectedFolder}
          sortOption={sortOption}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          isPreviewOpen={!!openEntry}
          isStudioMode={isStudioMode}
        />

        {/* Floating Selection Bar */}
        <SelectionBar
          theme={theme}
          selectedCount={selectedCount}
          onClear={() => setSelectedIds({})}
          onThrowToPool={handleThrowToPool}
          motionMultiplier={motionMultiplier}
          pools={pools}
        />
      </section>

      {/* Slide-in Side Panel */}
      <SidePanel
        theme={theme}
        entry={openEntry}
        onClose={() => setOpenId(null)}
        onPrevInPool={handlePrevInPool}
        onNextInPool={handleNextInPool}
        specimenText={specimen}
        onSpecimenChange={setSpecimen}
        motionMultiplier={motionMultiplier}
        onOpenZipContents={handleOpenZipContents}
        isStudioMode={isStudioMode}
        onToggleStudioMode={() => setIsStudioMode((prev) => !prev)}
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
        theme={theme}
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
        onToggleFolder={handleToggleFolderEnabled}
        deferFolderIngestion={deferFolderIngestion}
        onToggleDeferFolderIngestion={handleToggleDeferFolderIngestion}
        pools={pools}
        onAddPool={handleAddPool}
        onEditPool={handleEditPool}
        onDeletePool={handleDeletePool}
        poolCounts={poolCounts}
        motionMultiplier={motionMultiplier}
        onMotionChange={setMotionMultiplier}
      />

      {/* Watched Folder Ready Notification Toast */}
      {folderNotification && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '14px 18px',
            borderRadius: '14px',
            background: 'rgba(15, 23, 42, 0.94)',
            border: '1px solid rgba(56, 239, 125, 0.45)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6), 0 0 24px rgba(56, 239, 125, 0.18)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            maxWidth: '440px',
            animation: 'slideUpNotif 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(56, 239, 125, 0.15)',
              border: '1px solid rgba(56, 239, 125, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none'
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#38ef7d"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              <polyline points="9 13 12 16 17 11"></polyline>
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: '15px',
                  fontWeight: 700,
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  color: '#e9edf2'
                }}
              >
                Watched Folder Available
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: 'rgba(56, 239, 125, 0.18)',
                  border: '1px solid rgba(56, 239, 125, 0.4)',
                  color: '#38ef7d',
                  fontWeight: 700,
                  letterSpacing: '.04em'
                }}
              >
                READY
              </span>
            </div>
            <div
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '11px',
                color: 'rgba(233, 237, 242, 0.7)',
                marginTop: '3px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              title={folderNotification.folderName}
            >
              <strong style={{ color: '#94bce3' }}>{folderNotification.folderName}</strong> is ready ({folderNotification.count} assets indexed)
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 'none' }}>
            <button
              onClick={() => {
                if (folderNotification.folder) {
                  handleSelectFolder(folderNotification.folder);
                } else {
                  const found = folders.find(
                    (f) =>
                      f.path.toLowerCase() === folderNotification.folderName.toLowerCase() ||
                      f.path.toLowerCase().endsWith(folderNotification.folderName.toLowerCase())
                  );
                  if (found) handleSelectFolder(found);
                }
                setFolderNotification(null);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(56, 239, 125, 0.5)',
                background: 'linear-gradient(135deg, #38ef7d, #11998e)',
                color: '#020617',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '.04em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(56, 239, 125, 0.25)'
              }}
            >
              View Folder
            </button>

            <button
              onClick={() => setFolderNotification(null)}
              style={{
                background: 'transparent',
                border: 0,
                color: 'rgba(233, 237, 242, 0.45)',
                cursor: 'pointer',
                padding: '4px 6px',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '14px',
                lineHeight: 1
              }}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Hidden Native OS Directory Picker Input */}
      <input
        ref={nativeDirInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleIngestFiles(e.target.files);
            e.target.value = '';
          }
        }}
        style={{ display: 'none' }}
      />
    </div>
  );
};

