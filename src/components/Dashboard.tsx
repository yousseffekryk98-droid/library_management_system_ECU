import React, { useState, useEffect } from 'react';
import { translations, Language } from '../translations';
import { 
  Library, 
  Users, 
  AlertCircle, 
  BookMarked,
  ArrowRightCircle,
  Undo2,
  TrendingUp,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../services/supabase-client';

interface DashboardStats {
  totalBooks: number;
  activeBorrowing: number;
  overdue: number;
  activeStudents: number;
}

export default function Dashboard({ 
  lang, 
  onAction 
}: { 
  lang: Language;
  onAction: (tab: 'inventory' | 'borrowing' | 'students') => void;
}) {
  const t = translations[lang];
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Supabase client imported above

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: booksData, error: booksErr, count: booksCount } = await supabase.from('books').select('*', { count: 'exact' });
      const { data: borrowingData, error: borrowErr, count: borrowCount } = await supabase.from('borrowing').select('*', { count: 'exact' }).is('return_date', null);
      const { data: overdueData, error: overdueErr, count: overdueCount } = await supabase.from('borrowing').select('*', { count: 'exact' }).lt('expected_return_date', new Date().toISOString()).is('return_date', null);
      const { data: studentsData, error: studentsErr, count: studentsCount } = await supabase.from('students').select('*', { count: 'exact' });

      setStats({
        totalBooks: (booksCount ?? (booksData || []).length) as number,
        activeBorrowing: (borrowCount ?? (borrowingData || []).length) as number,
        overdue: (overdueCount ?? (overdueData || []).length) as number,
        activeStudents: (studentsCount ?? (studentsData || []).length) as number
      });
    } catch (err) {
      console.error("Failed to fetch stats", err);
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    { 
      label: t.dashboard.totalBooks, 
      value: stats?.totalBooks ?? 0, 
      icon: Library, 
      color: 'bg-blue-50 text-blue-600',
      tab: 'inventory' as const
    },
    { 
      label: t.dashboard.activeBorrowing, 
      value: stats?.activeBorrowing ?? 0, 
      icon: BookMarked, 
      color: 'bg-green-50 text-green-600',
      tab: 'borrowing' as const
    },
    { 
      label: t.dashboard.overdue, 
      value: stats?.overdue ?? 0, 
      icon: AlertCircle, 
      color: stats?.overdue && stats.overdue > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600',
      tab: 'borrowing' as const
    },
    { 
      label: t.dashboard.activeStudents, 
      value: stats?.activeStudents ?? 0, 
      icon: Users, 
      color: 'bg-purple-50 text-purple-600',
      tab: 'students' as const
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">{t.dashboard.welcome}</h1>
          <p className="text-slate-500 mt-1">{t.dashboard.systemHealth}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 justify-end">
            <Clock className="w-3 h-3" />
            Live Status
          </p>
        </div>
      </header>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => onAction(card.tab)}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group"
          >
            <div className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
              <card.icon className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">{card.label}</p>
            <h2 className="text-3xl font-bold text-slate-900 mt-1">
              {loading ? '...' : card.value.toLocaleString()}
            </h2>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
              <TrendingUp className="w-3 h-3" />
              View Details
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onAction('borrowing')}
          className="relative overflow-hidden bg-slate-900 text-white p-8 rounded-3xl group transition-all shadow-xl shadow-slate-200"
        >
          <div className="relative z-10 flex flex-col items-start gap-4">
            <div className="p-4 bg-white/10 rounded-2xl">
              <ArrowRightCircle className="w-8 h-8 text-blue-400" />
            </div>
            <div className="text-left rtl:text-right">
              <h3 className="text-2xl font-bold">{t.dashboard.quickCheckout}</h3>
              <p className="text-slate-400 text-sm mt-1">Process new borrowing request instantly</p>
            </div>
          </div>
          <div className="absolute top-0 right-0 p-12 opacity-10 transition-transform group-hover:translate-x-4 rotate-12">
            <BookMarked className="w-32 h-32" />
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onAction('borrowing')}
          className="relative overflow-hidden bg-white border-2 border-slate-900 text-slate-900 p-8 rounded-3xl group transition-all"
        >
          <div className="relative z-10 flex flex-col items-start gap-4 text-left rtl:text-right">
            <div className="p-4 bg-slate-100 rounded-2xl group-hover:bg-slate-900 group-hover:text-white transition-colors">
              <Undo2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">{t.dashboard.quickReturn}</h3>
              <p className="text-slate-500 text-sm mt-1">Return books back to inventory</p>
            </div>
          </div>
          <div className="absolute top-0 right-0 p-12 opacity-5 transition-transform group-hover:translate-x-4">
            <Library className="w-32 h-32" />
          </div>
        </motion.button>
      </div>
      
      {/* Visual Accent */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center gap-8 shadow-lg shadow-blue-100">
        <div className="flex-1">
          <h4 className="text-xl font-bold">Pro Tip: Scanner Ready</h4>
          <p className="text-blue-100 mt-2 opacity-80 italic">Standard USB Barcode scanners are automatically integrated. Simply focus the input field and scan a book ISBN or Student ID to begin.</p>
        </div>
        <div className="flex -space-x-4 rtl:space-x-reverse">
          {[1,2,3,4].map(i => (
            <div key={i} className="w-12 h-12 rounded-full border-4 border-white bg-blue-100 overflow-hidden">
               <div className="w-full h-full bg-slate-400 opacity-50"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
