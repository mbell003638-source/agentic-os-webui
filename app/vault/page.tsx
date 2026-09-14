'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FolderSync, 
  ArrowLeft, 
  Search, 
  FileText, 
  Calendar, 
  Copy, 
  Check, 
  ExternalLink,
  MessageSquare,
  Sparkles,
  BookOpen,
  Globe
} from 'lucide-react';

interface VaultItem {
  name: string;
  relativePath: string;
  category: string;
  mtime: number;
  size: number;
}

export default function VaultExplorerPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [vaultPath, setVaultPath] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [copied, setCopied] = useState(false);

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

        {/* Header Right */}
        <div className="flex items-center gap-3">
          <Link
            href="/globe"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-900/60 to-purple-900/60 border border-purple-500/50 text-purple-200 hover:border-sky-400 hover:text-white text-xs font-semibold shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all"
            title="Launch 3D Obsidian Vault & Hive Mind Globe"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span>3D Vault Globe</span>
          </Link>

          {selectedFile && (
            <button
              onClick={handleCopyContext}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-700/50 text-purple-300 hover:border-purple-400 text-xs font-mono transition-all"
              title="Copy markdown to clipboard to feed into agent"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Prompt Context'}</span>
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
        {/* Left Sidebar: File List (4 cols) */}
        <div className="md:col-span-4 flex flex-col gap-4">
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

          <div className="flex-1 bg-[#050711] border border-blue-950/80 rounded-2xl p-3 overflow-y-auto max-h-[70vh] space-y-1.5">
            {loading ? (
              <div className="text-center py-8 text-xs font-mono text-gray-500">Scanning vault...</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-xs font-mono text-gray-500">No notes found.</div>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={item.relativePath}
                  onClick={() => loadFile(item.relativePath)}
                  className={`w-full p-2.5 rounded-xl text-left border transition-all ${
                    selectedFile === item.relativePath
                      ? 'bg-purple-950/60 border-purple-500/70 text-white shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                      : 'bg-[#090e1f] border-blue-950/60 text-gray-300 hover:border-blue-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                      {item.name}
                    </span>
                    <span className="text-[9px] font-mono text-gray-500 uppercase">
                      {item.category}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-gray-500 mt-1 flex items-center justify-between">
                    <span>{new Date(item.mtime).toLocaleDateString()}</span>
                    <span>{(item.size / 1024).toFixed(1)} KB</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Pane: Markdown Content Viewer (8 cols) */}
        <div className="md:col-span-8 bg-[#050711] border border-blue-900/40 rounded-2xl p-6 flex flex-col max-h-[75vh] overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-blue-950/80 mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-bold text-white font-mono">{selectedFile || 'Select a note'}</span>
            </div>
            {selectedFile && (
              <span className="text-[11px] font-mono text-gray-500">
                Markdown Source
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-2 font-mono text-xs leading-relaxed text-gray-300 select-text whitespace-pre-wrap">
            {loadingContent ? (
              <div className="text-center py-12 text-gray-500">Loading note content...</div>
            ) : fileContent ? (
              fileContent
            ) : (
              <div className="text-center py-12 text-gray-500">
                Select a file from the sidebar to inspect its contents.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
