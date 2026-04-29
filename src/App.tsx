/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { translations, Language } from './translations';
import { 
  Library, 
  BookMarked, 
  Users, 
  Settings, 
  ChevronRight, 
  LogOut,
  Globe,
  LayoutDashboard,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import BookManager from './components/BookManager';
import BorrowManager from './components/BorrowManager';
import SettingsManager from './components/SettingsManager';
import StudentManager from './components/StudentManager';

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'borrowing' | 'students' | 'settings'>('dashboard');
  const [currentDr, setCurrentDr] = useState('Loading...');
  const [isLocked, setIsLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  
  const CORRECT_PIN = "0000"; // Default PIN as requested
  
  const t = translations[lang];
  const isRtl = lang === 'ar';

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === CORRECT_PIN) {
      setIsLocked(false);
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
      setTimeout(() => setPinError(false), 2000);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.current_dr) setCurrentDr(data.current_dr);
    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  };

  const menuItems = [
    { id: 'dashboard', label: t.tabs.dashboard, icon: LayoutDashboard },
    { id: 'inventory', label: t.tabs.inventory, icon: Library },
    { id: 'borrowing', label: t.tabs.borrowing, icon: BookMarked },
    { id: 'students', label: t.tabs.students, icon: Users },
    { id: 'settings', label: t.tabs.settings, icon: Settings },
  ] as const;

  return (
    <div 
      className={`h-screen w-full bg-[#f0f2f5] font-sans flex overflow-hidden border-[8px] border-[#334155]`} 
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Sidebar - Geometric Theme */}
      <aside className="w-64 bg-[#1e293b] text-white flex flex-col border-r border-[#334155] shrink-0">
        <div className="p-6 bg-[#0f172a] mb-2 border-b border-slate-700">
          <h1 className="text-xl font-bold tracking-tight text-blue-400 uppercase italic">
            AL-MAKTABA
          </h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
            Library Management v3.0
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-1 py-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded text-sm font-medium transition-all ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-700 bg-[#0f172a]/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-500 border-2 border-blue-400 shrink-0 overflow-hidden">
               <div className="w-full h-full bg-gradient-to-br from-slate-400 to-slate-600"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{currentDr}</p>
              <p className="text-[10px] text-slate-400 truncate uppercase tracking-tighter">Chief Librarian</p>
            </div>
          </div>
          <button 
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded text-xs font-bold transition-colors"
          >
            <Globe className="w-3 h-3" />
            <span>{lang === 'ar' ? 'EN / الانجليزية' : 'AR / العربية'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white shrink-0">
          <div className="hidden md:flex items-center bg-slate-100 px-3 py-2 rounded-md w-96 border border-slate-200 focus-within:border-blue-400 focus-within:bg-white transition-all">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input 
              type="text" 
              placeholder={t.inventory.searchPlaceholder}
              className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none px-2"
            />
          </div>
          
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setIsLocked(true)}
               className="flex items-center gap-2 bg-slate-100 text-slate-700 border border-slate-300 p-2 rounded hover:bg-slate-900 hover:text-white transition-all shadow-sm font-bold text-[10px] uppercase"
             >
               <Settings className="w-4 h-4" />
               Lock System
             </button>
             <button className="flex items-center gap-2 text-slate-600 hover:text-red-600 text-xs font-bold uppercase transition-colors">
               <LogOut className="w-4 h-4" />
               {lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}
             </button>
          </div>
        </header>

        {/* Locked Screen Overlay */}
        <AnimatePresence>
          {isLocked && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-slate-900 flex items-center justify-center p-4 backdrop-blur-xl"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white/10 p-12 rounded-[40px] border border-white/20 text-center max-w-sm w-full"
              >
                <div className="w-20 h-20 bg-blue-500 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-2xl shadow-blue-500/20">
                  <Library className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-white text-2xl font-bold mb-2">SYSTEM LOCKED</h2>
                <p className="text-slate-400 text-sm mb-8 italic">Please enter your 4-digit PIN to access the Library Master Pro</p>
                
                <form onSubmit={handleUnlock} className="space-y-4">
                  <input 
                    type="password" 
                    maxLength={4}
                    autoFocus
                    placeholder="****"
                    className={`w-full bg-white/5 border ${pinError ? 'border-red-500' : 'border-white/20'} rounded-2xl py-4 text-center text-3xl font-bold text-white outline-none focus:border-blue-500 transition-all`}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                  />
                  {pinError && <p className="text-red-500 text-xs font-bold uppercase animate-pulse">Incorrect Access Key</p>}
                  <button 
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold transition-all shadow-xl shadow-blue-500/20"
                  >
                    Unlock Session
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Page Container */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#f0f2f5]">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-8 border-b border-slate-200 pb-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-800 tracking-tight">{menuItems.find(i => i.id === activeTab)?.label}</h2>
                <p className="text-slate-500 text-sm mt-1">{t.title} Management Dashboard</p>
              </div>
              <div className="hidden sm:flex gap-2">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded text-xs font-bold uppercase tracking-wider">SECURE SESSION</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold uppercase tracking-wider italic">V3.0.0</span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab + lang}
                initial={{ opacity: 0, x: isRtl ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRtl ? 10 : -10 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {activeTab === 'dashboard' && <Dashboard lang={lang} onAction={(tab) => setActiveTab(tab)} />}
                {activeTab === 'inventory' && <BookManager lang={lang} />}
                {activeTab === 'borrowing' && <BorrowManager lang={lang} />}
                {activeTab === 'students' && <StudentManager lang={lang} />}
                {activeTab === 'settings' && <SettingsManager lang={lang} setLang={setLang} onSettingsUpdate={fetchSettings} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
