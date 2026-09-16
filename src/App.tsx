/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { translations, Language } from './translations';
import {
  BarChart3,
  BookMarked,
  ClipboardList,
  Globe,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  ShieldCheck,
  Users,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Dashboard from './components/Dashboard';
import BookManager from './components/BookManager';
import BorrowManager from './components/BorrowManager';
import SettingsManager from './components/SettingsManager';
import StudentManager from './components/StudentManager';
import OperationsManager from './components/OperationsManager';
import ReportsManager from './components/ReportsManager';
import FinesManager from './components/FinesManager';
import LoginForm from './components/LoginForm';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './services/supabase-client';

type Tab = 'dashboard' | 'inventory' | 'borrowing' | 'students' | 'operations' | 'fines' | 'reports' | 'settings';

type StaffProfile = {
  display_name?: string | null;
  role?: 'admin' | 'librarian' | 'assistant' | 'viewer' | null;
};

function AuthenticatedApp() {
  const { session, signOut, loading } = useAuth();
  const [lang, setLang] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem('lang');
      return stored === 'en' || stored === 'ar' ? stored : 'ar';
    } catch {
      return 'ar';
    }
  });
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [currentDr, setCurrentDr] = useState('Library Staff');
  const [staff, setStaff] = useState<StaffProfile>({ role: 'librarian' });

  const t = translations[lang];
  const isRtl = lang === 'ar';

  const setLangAndStore = (value: Language) => {
    try { localStorage.setItem('lang', value); } catch { /* storage may be unavailable */ }
    setLang(value);
  };

  const fetchIdentity = async () => {
    if (!session?.user) return;
    const [{ data: settingData }, { data: profileData }] = await Promise.all([
      supabase.from('settings').select('value').eq('key', 'current_dr').maybeSingle(),
      supabase.from('staff_profiles').select('display_name,role').eq('user_id', session.user.id).maybeSingle()
    ]);
    if (profileData) setStaff(profileData as StaffProfile);
    if (profileData?.display_name) setCurrentDr(profileData.display_name);
    else if (settingData?.value) setCurrentDr(settingData.value);
    else setCurrentDr(session.user.email || 'Library Staff');
  };

  useEffect(() => { if (session) fetchIdentity(); }, [session?.user?.id]);

  const labels = {
    operations: lang === 'ar' ? 'مركز التداول' : 'Circulation',
    fines: lang === 'ar' ? 'الغرامات' : 'Fines & Payments',
    reports: lang === 'ar' ? 'التقارير' : 'Reports',
    secure: lang === 'ar' ? 'جلسة موثقة' : 'Authenticated session',
    system: lang === 'ar' ? 'نظام إدارة مكتبة ECU' : 'ECU Library Management System'
  };

  const menuItems = [
    { id: 'dashboard' as const, label: t.tabs.dashboard, icon: LayoutDashboard },
    { id: 'inventory' as const, label: t.tabs.inventory, icon: Library },
    { id: 'borrowing' as const, label: t.tabs.borrowing, icon: BookMarked },
    { id: 'students' as const, label: t.tabs.students, icon: Users },
    { id: 'operations' as const, label: labels.operations, icon: ClipboardList },
    { id: 'fines' as const, label: labels.fines, icon: ReceiptText },
    { id: 'reports' as const, label: labels.reports, icon: BarChart3 },
    { id: 'settings' as const, label: t.tabs.settings, icon: Settings },
  ];

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950"><div className="text-center"><div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"/><p className="text-sm text-slate-300">Loading secure session...</p></div></div>;
  }

  if (!session) return <LoginForm onLoginSuccess={() => {}} lang={lang} />;

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside className={`${mobile ? 'h-full w-[86vw] max-w-80' : 'hidden h-screen w-72 lg:flex'} flex-col border-e border-slate-800 bg-slate-950 text-white`}>
      <div className="flex h-20 items-center justify-between border-b border-slate-800 px-5">
        <div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600"><Library className="h-5 w-5"/></div><div><h1 className="text-sm font-black tracking-wide">ECU LIBRARY</h1><p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Management Pro v4</p></div></div>
        {mobile && <button onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5"/></button>}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {menuItems.map(item => <button key={item.id} onClick={() => selectTab(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`}><item.icon className="h-5 w-5 shrink-0"/><span className="truncate">{item.label}</span></button>)}
      </nav>
      <div className="border-t border-slate-800 p-4">
        <div className="mb-3 rounded-xl bg-slate-900 p-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-800 text-sm font-black text-blue-300">{(currentDr || session.user.email || 'L').charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-xs font-bold">{currentDr}</p><p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-slate-400">{staff.role || 'librarian'}</p></div></div></div>
        <div className="grid grid-cols-2 gap-2"><button onClick={() => setLangAndStore(lang === 'ar' ? 'en' : 'ar')} className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"><Globe className="h-4 w-4"/>{lang === 'ar' ? 'EN' : 'AR'}</button><button onClick={signOut} className="flex items-center justify-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20"><LogOut className="h-4 w-4"/>{lang === 'ar' ? 'خروج' : 'Logout'}</button></div>
      </div>
    </aside>
  );

  return <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-100 text-slate-900 lg:flex">
    <Sidebar />
    <AnimatePresence>{mobileNavOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileNavOpen(false)}><motion.div initial={{ x: isRtl ? 320 : -320 }} animate={{ x: 0 }} exit={{ x: isRtl ? 320 : -320 }} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className={`absolute inset-y-0 ${isRtl ? 'right-0' : 'left-0'}`} onClick={e => e.stopPropagation()}><Sidebar mobile/></motion.div></motion.div>}</AnimatePresence>

    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3"><button onClick={() => setMobileNavOpen(true)} className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden"><Menu className="h-5 w-5"/></button><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{menuItems.find(item => item.id === activeTab)?.label}</p><p className="hidden truncate text-xs text-slate-500 sm:block">{labels.system}</p></div></div>
          <div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 sm:flex"><ShieldCheck className="h-4 w-4"/>{labels.secure}</div><button onClick={() => setLangAndStore(lang === 'ar' ? 'en' : 'ar')} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"><Globe className="h-5 w-5"/></button></div>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-[1500px]">
        <AnimatePresence mode="wait"><motion.div key={`${activeTab}-${lang}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
          {activeTab === 'dashboard' && <Dashboard lang={lang} onAction={tab => selectTab(tab as Tab)} />}
          {activeTab === 'inventory' && <BookManager lang={lang}/>} 
          {activeTab === 'borrowing' && <BorrowManager lang={lang}/>} 
          {activeTab === 'students' && <StudentManager lang={lang}/>} 
          {activeTab === 'operations' && <OperationsManager lang={lang}/>} 
          {activeTab === 'fines' && <FinesManager lang={lang}/>} 
          {activeTab === 'reports' && <ReportsManager lang={lang}/>} 
          {activeTab === 'settings' && <SettingsManager lang={lang} setLang={setLangAndStore} onSettingsUpdate={fetchIdentity}/>} 
        </motion.div></AnimatePresence>
      </div></div>
    </main>
  </div>;
}

export default function App() {
  return <AuthProvider><AuthenticatedApp /></AuthProvider>;
}
