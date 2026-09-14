'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Search, 
  FileText, 
  Copy, 
  Check, 
  MessageSquare,
  BookOpen,
  Globe,
  Network,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface VaultItem {
  name: string;
  relativePath: string;
  category: string;
  mtime: number;
  size: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  chats: '#22d3ee',
  notes: '#a78bfa',
  goals: '#fbbf24',
  sessions: '#34d399',
  default: '#60a5fa'
};

const CATEGORY_ICONS: Record<string, string> = {
  chats: '💬',
  notes: '📝',
  goals: '🎯',
  sessions: '🔄',
  default: '📄'
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat.toLowerCase()] || CATEGORY_COLORS.default;
}

function getCategoryIcon(cat: string) {
  return CATEGORY_ICONS[cat.toLowerCase()] || CATEGORY_ICONS.default;
}

// ----------------------------------------------------
// Graph View Component
// ----------------------------------------------------
function ForceGraph({ items, onSelectNode }: { items: VaultItem[], onSelectNode: (relPath: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    canvas.width = width;
    canvas.height = height;

    // Initialize nodes
    const nodes = items.map(item => ({
      ...item,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
      vx: 0,
      vy: 0,
      radius: 6 + Math.min(item.size / 2000, 10),
      color: getCategoryColor(item.category)
    }));

    // Create edges between nodes of same category
    const edges: { source: any, target: any }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[i].category === nodes[j].category) {
          // Limit connections to avoid dense clumps
          if (Math.random() > 0.5) continue;
          edges.push({ source: nodes[i], target: nodes[j] });
        }
      }
    }

    let animationFrameId: number;
    let dragNode: any = null;
    let transform = { x: 0, y: 0, k: 1 };
    let isDraggingCanvas = false;
    let lastMouse = { x: 0, y: 0 };

    const simulate = () => {
      // Simple force directed layout
      const alpha = 0.05; // Learning rate/cooling

      // 1. Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) dist = 0.01;
          const force = -200 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      // 2. Attraction (Edges)
      edges.forEach(edge => {
        const dx = edge.target.x - edge.source.x;
        const dy = edge.target.y - edge.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = (dist - 50) * 0.02; // desired distance 50
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        edge.source.vx += fx;
        edge.source.vy += fy;
        edge.target.vx -= fx;
        edge.target.vy -= fy;
      });

      // 3. Center Gravity
      nodes.forEach(node => {
        const dx = width / 2 - node.x;
        const dy = height / 2 - node.y;
        node.vx += dx * 0.005;
        node.vy += dy * 0.005;

        // Apply velocity
        node.vx *= 0.85; // friction
        node.vy *= 0.85;
        if (node !== dragNode) {
          node.x += node.vx * alpha * 10;
          node.y += node.vy * alpha * 10;
        }
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);

      // Draw edges
      ctx.lineWidth = 0.5;
      edges.forEach(edge => {
        ctx.beginPath();
        ctx.moveTo(edge.source.x, edge.source.y);
        ctx.lineTo(edge.target.x, edge.target.y);
        ctx.strokeStyle = edge.source.color + '40'; // 25% opacity
        ctx.stroke();
      });

      // Draw nodes
      nodes.forEach(node => {
        // Glow
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 2.5);
        gradient.addColorStop(0, node.color + '80');
        gradient.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        if (transform.k > 0.5 || node === dragNode || node.radius > 8) {
          ctx.font = '10px monospace';
          ctx.fillStyle = '#cbd5e1';
          const label = node.name.length > 15 ? node.name.substring(0, 12) + '...' : node.name;
          ctx.fillText(label, node.x + node.radius + 4, node.y + 3);
        }
      });

      ctx.restore();
    };

    const loop = () => {
      simulate();
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();

    // Interaction handlers
    const getMousePos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left - transform.x) / transform.k,
        y: (e.clientY - rect.top - transform.y) / transform.k,
        rawX: e.clientX,
        rawY: e.clientY
      };
    };

    const handleMouseDown = (e: MouseEvent) => {
      const pos = getMousePos(e);
      lastMouse = { x: pos.rawX, y: pos.rawY };
      
      let clickedNode = null;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const dx = node.x - pos.x;
        const dy = node.y - pos.y;
        if (dx * dx + dy * dy < (node.radius + 5) * (node.radius + 5)) {
          clickedNode = node;
          break;
        }
      }

      if (clickedNode) {
        dragNode = clickedNode;
      } else {
        isDraggingCanvas = true;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (dragNode) {
        const pos = getMousePos(e);
        dragNode.x = pos.x;
        dragNode.y = pos.y;
        dragNode.vx = 0;
        dragNode.vy = 0;
      } else if (isDraggingCanvas) {
        const dx = e.clientX - lastMouse.x;
        const dy = e.clientY - lastMouse.y;
        transform.x += dx;
        transform.y += dy;
        lastMouse = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (dragNode && !isDraggingCanvas) {
        // Treat as click if barely moved
        onSelectNode(dragNode.relativePath);
      }
      dragNode = null;
      isDraggingCanvas = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      const newScale = Math.max(0.1, Math.min(transform.k * (1 + delta), 5));
      
      // Zoom centered on mouse
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      transform.x = mouseX - (mouseX - transform.x) * (newScale / transform.k);
      transform.y = mouseY - (mouseY - transform.y) * (newScale / transform.k);
      transform.k = newScale;
    };

    const handleResize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width;
      canvas.height = height;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
    };
  }, [items, onSelectNode]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full cursor-grab active:cursor-grabbing bg-black rounded-2xl" 
    />
  );
}

// ----------------------------------------------------
// Main Page Component
// ----------------------------------------------------
export default function VaultExplorerPage() {
  const router = useRouter();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [vaultPath, setVaultPath] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'reader' | 'graph'>('reader');
  
  // Collapsible categories state
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const fetchVault = async () => {
    try {
      const res = await fetch('/api/vault');
      const data = await res.json();
      if (data.ok) {
        setItems(data.items || []);
        setVaultPath(data.vaultPath || '');
        if (data.items.length > 0 && !selectedFile) {
          loadFile(data.items[0].relativePath);
        }
      }
    } catch (e) {
      console.warn('Could not load vault items:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadFile = async (relPath: string) => {
    setSelectedFile(relPath);
    setLoadingContent(true);
    try {
      const res = await fetch(`/api/vault?path=${encodeURIComponent(relPath)}`);
      const data = await res.json();
      if (data.ok) {
        setFileContent(data.content || '');
      }
    } catch (e) {
      console.warn('Could not read file:', e);
    } finally {
      setLoadingContent(false);
    }
  };

  useEffect(() => {
    fetchVault();
  }, []);

  const handleCopyContext = () => {
    if (!fileContent) return;
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredItems = items.filter(
    item =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalSize = items.reduce((acc, item) => acc + item.size, 0);
  const totalCategories = new Set(items.map(i => i.category)).size;

  const groupedItems = useMemo(() => {
    const groups: Record<string, VaultItem[]> = {};
    filteredItems.forEach(item => {
      const cat = item.category || 'default';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [cat]: prev[cat] === false ? true : false
    }));
  };

  const handleNodeSelect = (relPath: string) => {
    setActiveTab('reader');
    loadFile(relPath);
  };

  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col font-sans">
      {/* Header */}
      <header className="px-6 py-4 border-b border-blue-950/60 bg-[#02040a]/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded-xl bg-[#090e1f] border border-blue-900/40 text-gray-400 hover:text-white hover:border-blue-500/50 transition-all"
            title="Return to Mission Control"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-900/40 to-black border border-purple-500/40 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(168,85,247,0.25)]">
              📓
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">Obsidian Memory Vault</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950/70 text-purple-300 border border-purple-800/40 uppercase">
                PERSISTENT CONTEXT
              </span>
            </div>
            <p className="text-xs text-gray-400 truncate max-w-md font-mono">{vaultPath}</p>
          </div>
        </div>

        {/* View Mode Tab Switcher */}
        <div className="flex items-center bg-[#090e1f] rounded-lg p-1 border border-blue-900/40 mx-4">
          <button
            onClick={() => setActiveTab('reader')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'reader' 
                ? 'bg-blue-950/80 text-white shadow-sm' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            📄 Reader
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'graph' 
                ? 'bg-purple-950/80 text-white shadow-sm' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            🕸️ Graph View
          </button>
          <button
            onClick={() => router.push('/globe')}
            className="px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 text-gray-400 hover:text-sky-300 hover:bg-white/5 transition-all"
          >
            🌐 3D Globe
          </button>
        </div>

        {/* Header Right */}
        <div className="flex items-center gap-3">
          {selectedFile && activeTab === 'reader' && (
            <button
              onClick={handleCopyContext}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-700/50 text-purple-300 hover:border-purple-400 text-xs font-mono transition-all"
              title="Copy markdown to clipboard to feed into agent"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Content'}</span>
            </button>
          )}

          <Link
            href="/agents/claude"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Open in Claude</span>
          </Link>
        </div>
      </header>

      {/* Main Split Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Sidebar: Enhanced File List (3 or 4 cols) */}
        <div className="md:col-span-4 flex flex-col gap-4">
          <div className="flex items-center justify-between text-xs font-mono text-gray-400 bg-[#050711] border border-blue-900/30 p-2 rounded-lg">
            <span>{items.length} notes</span>
            <span>{totalCategories} categories</span>
            <span>{(totalSize / 1024 / 1024).toFixed(2)} MB</span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search notes or chats..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#050711] border border-blue-900/50 text-white placeholder-gray-500 text-xs font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex-1 bg-[#050711] border border-blue-950/80 rounded-2xl p-3 overflow-y-auto max-h-[70vh] space-y-3">
            {loading ? (
              <div className="text-center py-8 text-xs font-mono text-gray-500">Scanning vault...</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-xs font-mono text-gray-500">No notes found.</div>
            ) : (
              Object.entries(groupedItems).map(([category, catItems]) => {
                const isExpanded = expandedCategories[category] !== false; // Default true
                return (
                  <div key={category} className="space-y-1">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white py-1 px-1 transition-colors uppercase tracking-wider"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <span className="text-sm">{getCategoryIcon(category)}</span>
                      <span>{category} ({catItems.length})</span>
                    </button>
                    
                    {isExpanded && (
                      <div className="space-y-1 pl-1">
                        {catItems.map((item) => (
                          <button
                            key={item.relativePath}
                            onClick={() => loadFile(item.relativePath)}
                            className={`w-full p-2.5 rounded-xl text-left border transition-all ${
                              selectedFile === item.relativePath
                                ? 'bg-purple-950/60 border-purple-500/70 text-white shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                                : 'bg-[#090e1f] border-blue-950/60 text-gray-300 hover:border-blue-900'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium truncate flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" style={{color: getCategoryColor(item.category)}} />
                                {item.name}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-gray-500 mt-1 flex items-center justify-between">
                              <span>{new Date(item.mtime).toLocaleDateString()}</span>
                              <span>{(item.size / 1024).toFixed(1)} KB</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Pane: Markdown Reader or Graph View (8 cols) */}
        <div className="md:col-span-8 bg-[#050711] border border-blue-900/40 rounded-2xl overflow-hidden flex flex-col h-[75vh]">
          {activeTab === 'reader' ? (
            <div className="flex flex-col h-full p-6">
              <div className="flex items-center justify-between pb-4 border-b border-blue-950/80 mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-bold text-white font-mono">{selectedFile || 'Select a note'}</span>
                </div>
                {selectedFile && (
                  <span className="text-[11px] font-mono text-gray-500">
                    Rendered Markdown
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar text-sm">
                {loadingContent ? (
                  <div className="text-center py-12 text-gray-500 text-xs font-mono">Loading note content...</div>
                ) : fileContent ? (
                  <div className="markdown-body">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        h1: ({children}) => <h1 className="text-xl font-bold text-white mb-3 pb-2 border-b border-blue-900/40">{children}</h1>,
                        h2: ({children}) => <h2 className="text-lg font-bold text-sky-300 mb-2 mt-4">{children}</h2>,
                        h3: ({children}) => <h3 className="text-base font-semibold text-purple-300 mb-2 mt-3">{children}</h3>,
                        p: ({children}) => <p className="text-gray-300 mb-3 leading-relaxed">{children}</p>,
                        a: ({href, children}) => <a href={href} className="text-sky-400 hover:text-sky-300 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                        code: ({className, children, ...props}: any) => {
                          const isInline = !className;
                          return isInline 
                            ? <code className="px-1.5 py-0.5 rounded bg-blue-950/80 text-cyan-300 text-[11px] font-mono border border-blue-900/40" {...props}>{children}</code>
                            : <code className={`block p-4 rounded-xl bg-[#080f24] border border-blue-900/40 text-cyan-200 text-xs font-mono overflow-x-auto mb-3 ${className || ''}`} {...props}>{children}</code>;
                        },
                        pre: ({children}) => <pre className="mb-3">{children}</pre>,
                        ul: ({children}) => <ul className="list-disc list-inside text-gray-300 mb-3 space-y-1">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal list-inside text-gray-300 mb-3 space-y-1">{children}</ol>,
                        li: ({children}) => <li className="text-gray-300">{children}</li>,
                        blockquote: ({children}) => <blockquote className="border-l-4 border-purple-500 pl-4 py-1 mb-3 text-gray-400 italic bg-purple-950/20 rounded-r-lg">{children}</blockquote>,
                        table: ({children}) => <div className="overflow-x-auto mb-3"><table className="w-full text-xs font-mono border border-blue-900/40 rounded-xl overflow-hidden">{children}</table></div>,
                        th: ({children}) => <th className="px-3 py-2 bg-blue-950/60 text-sky-300 text-left border-b border-blue-900/40 font-semibold">{children}</th>,
                        td: ({children}) => <td className="px-3 py-2 text-gray-300 border-b border-blue-950/40">{children}</td>,
                        hr: () => <hr className="border-blue-900/40 my-4" />,
                        strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                        em: ({children}) => <em className="text-purple-300">{children}</em>,
                      }}
                    >
                      {fileContent}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 text-xs font-mono">
                    Select a file from the sidebar to inspect its contents.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full h-full relative">
              <div className="absolute top-4 left-4 z-10 text-xs font-mono text-gray-400 bg-black/50 p-2 rounded-lg border border-white/10 backdrop-blur-sm pointer-events-none">
                <p>Scroll to zoom, drag to pan.</p>
                <p>Click node to read.</p>
              </div>
              <ForceGraph items={items} onSelectNode={handleNodeSelect} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
