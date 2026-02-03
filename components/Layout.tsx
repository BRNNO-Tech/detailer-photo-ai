import React, { useState, useRef, useEffect } from 'react';

export interface LayoutProps {
  children: React.ReactNode;
  onHome: () => void;
  onSettings: () => void;
  userName: string;
  avatarUrl: string;
  onUserNameChange: (name: string) => void;
  onAvatarChange: (dataUrl: string) => void;
  recentProjectsCount: number;
  defaultServiceName: string;
  captionTone: string;
  usageDisplay?: { projects: string; ai: string };
  onStartDefaultService: () => void;
  onPhotoJob: () => void;
  onVideoLab: () => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  onHome,
  onSettings,
  userName,
  avatarUrl,
  onUserNameChange,
  onAvatarChange,
  recentProjectsCount,
  defaultServiceName,
  captionTone,
  usageDisplay,
  onStartDefaultService,
  onPhotoJob,
  onVideoLab,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const menuFirstFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        avatarButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen) {
      menuFirstFocusRef.current?.focus();
    }
  }, [menuOpen]);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onAvatarChange(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const avatarSrc = avatarUrl || 'https://i.pravatar.cc/100?u=detailpro';
  const summary = `${defaultServiceName} · ${recentProjectsCount} project${recentProjectsCount !== 1 ? 's' : ''}`;
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Inter'] selection:bg-blue-100 selection:text-blue-900">
      <header className="sticky top-0 z-50 glass border-b border-slate-200/60 px-6 py-4 flex justify-between items-center">
        <div
          className="flex items-center gap-2 cursor-pointer group"
          onClick={onHome}
        >
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-200 group-hover:scale-105 transition-transform">
            <span className="text-xl">📸</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-none">
              DetailerPro AI
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Content Studio</p>
          </div>
        </div>
        <div className="relative flex items-center gap-4" ref={menuRef}>
          <button
            onClick={onSettings}
            className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-blue-600"
            title="Settings"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <input
            type="file"
            ref={avatarInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFile}
          />
          <button
            ref={avatarButtonRef}
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden bg-slate-200 flex-shrink-0 hover:ring-2 hover:ring-blue-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Account menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <img src={avatarSrc} alt={userName || 'User'} className="w-full h-full object-cover" />
          </button>
          {menuOpen && (
            <div
              className="absolute top-full right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl z-[60] overflow-hidden animate-fadeIn"
              role="menu"
            >
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-100 flex-shrink-0">
                    <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => onUserNameChange(e.target.value)}
                      placeholder="Display name"
                      className="w-full text-sm font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none py-0.5"
                    />
                    <p className="text-xs text-slate-400 truncate mt-0.5">{summary}</p>
                    {usageDisplay && (
                      <p className="text-[10px] text-slate-500 mt-0.5">{usageDisplay.projects} · {usageDisplay.ai}</p>
                    )}
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Tone: {captionTone}</p>
                  </div>
                </div>
              </div>
              <div className="py-2">
                <button
                  ref={menuFirstFocusRef}
                  type="button"
                  role="menuitem"
                  onClick={() => { onStartDefaultService(); closeMenu(); }}
                  className="w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <span>▶</span> Start {defaultServiceName}
                </button>
                <button type="button" role="menuitem" onClick={() => { onPhotoJob(); closeMenu(); }} className="w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                  <span>📸</span> Photo Job
                </button>
                <button type="button" role="menuitem" onClick={() => { onVideoLab(); closeMenu(); }} className="w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                  <span>🎥</span> Video Lab
                </button>
                <button type="button" role="menuitem" onClick={() => { onHome(); closeMenu(); }} className="w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                  <span>🏠</span> Dashboard
                </button>
              </div>
              <div className="border-t border-slate-100 py-2">
                <button type="button" role="menuitem" onClick={() => avatarInputRef.current?.click()} className="w-full px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                  <span>🖼</span> Change photo
                </button>
              </div>
              <div className="border-t border-slate-100 py-2">
                <button type="button" role="menuitem" onClick={() => { onSettings(); closeMenu(); }} className="w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                  <span>⚙</span> Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 pb-32">
        {children}
      </main>

      <footer className="border-t bg-white px-6 py-8 text-center">
        <p className="text-xs text-slate-400 font-medium tracking-wide">
          &copy; {new Date().getFullYear()} DETAILERPRO AI • CONTENT GENERATION SUITE
        </p>
      </footer>
    </div>
  );
};

export default Layout;
