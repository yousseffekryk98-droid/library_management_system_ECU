import React, { useEffect, useState } from 'react';
import { translations, Language } from '../translations';
import {
  AlertCircle,
  BarChart3,
  BookMarked,
  CalendarClock,
  CircleDollarSign,
  Library,
  RefreshCw,
  Users
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../services/supabase-client';

type DashboardTab = 'inventory' | 'borrowing' | 'students' | 'operations' | 'fines' | 'reports';

type DashboardStats = {
  titles: number;
  physicalCopies: number;
  activeLoans: number;
  overdueLoans: number;
  activeReservations: number;
  activeStudents: number;
  outstandingFines: number;
};

export default function Dashboard({ lang, onAction }: { lang: Language; onAction: (tab: DashboardTab) => void }) {
  const t = translations[lang];
  const [stats, setStats] = useState<DashboardStats>({ titles: 0, physicalCopies: 0, activeLoans: 0, overdueLoans: 0, activeReservations: 0, activeStudents: 0, outstandingFines: 0 });
  const [loading, setLoading] = useState(true);
  const [v4Ready, setV4Ready] = useState(true);

  const labels = lang === 'ar' ? {
    copies: 'إجمالي النسخ', reservations: 'حجوزات نشطة', fines: 'غرامات مستحقة', refresh: 'تحديث',
    circulation: 'مركز التداول', circulationText: 'متابعة الحجوزات والمتأخرات وحركة الكتب اليومية.',
    reports: 'التقارير والتحليلات', reportsText: 'راجع الاستخدام والأكثر استعارة وحالة المجموعة.',
    finesAction: 'الغرامات والمدفوعات', finesText: 'سجل الغرامات والتحصيل والإعفاءات.',
    migration: 'شغّل migrations 002 و003 لتفعيل كل مؤشرات الإصدار الرابع.', live: 'بيانات مباشرة'
  } : {
    copies: 'Physical copies', reservations: 'Active reservations', fines: 'Outstanding fines', refresh: 'Refresh',
    circulation: 'Circulation Center', circulationText: 'Track reservations, overdue loans and day-to-day movement.',
    reports: 'Reports & Analytics', reportsText: 'Review usage, popular titles and collection health.',
    finesAction: 'Fines & Payments', finesText: 'Manage charges, collections and waivers.',
    migration: 'Run migrations 002 and 003 to enable all v4 dashboard metrics.', live: 'Live database data'
  };

  const fetchStats = async () => {
    setLoading(true);
    const { data: v4Data, error: v4Error } = await supabase.from('library_dashboard_stats').select('*').maybeSingle();
    if (!v4Error && v4Data) {
      setStats({
        titles: Number(v4Data.titles || 0),
        physicalCopies: Number(v4Data.physical_copies || 0),
        activeLoans: Number(v4Data.active_loans || 0),
        overdueLoans: Number(v4Data.overdue_loans || 0),
        activeReservations: Number(v4Data.active_reservations || 0),
        activeStudents: Number(v4Data.active_students || 0),
        outstandingFines: Number(v4Data.outstanding_fines || 0)
      });
      setV4Ready(true);
      setLoading(false);
      return;
    }

    setV4Ready(false);
    const [booksRes, loansRes, overdueRes, studentsRes] = await Promise.all([
      supabase.from('books').select('id,quantity'),
      supabase.from('borrowing').select('id').is('return_date', null),
      supabase.from('borrowing').select('id').is('return_date', null).lt('expected_return_date', new Date().toISOString()),
      supabase.from('students').select('student_id')
    ]);
    const books = booksRes.data || [];
    setStats(prev => ({
      ...prev,
      titles: books.length,
      physicalCopies: books.reduce((sum: number, b: any) => sum + Number(b.quantity || 0), 0),
      activeLoans: (loansRes.data || []).length,
      overdueLoans: (overdueRes.data || []).length,
      activeStudents: (studentsRes.data || []).length
    }));
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  const cards = [
    { label: t.dashboard.totalBooks, value: stats.titles, icon: Library, className: 'bg-blue-50 text-blue-700', tab: 'inventory' as DashboardTab },
    { label: labels.copies, value: stats.physicalCopies, icon: Library, className: 'bg-indigo-50 text-indigo-700', tab: 'inventory' as DashboardTab },
    { label: t.dashboard.activeBorrowing, value: stats.activeLoans, icon: BookMarked, className: 'bg-emerald-50 text-emerald-700', tab: 'borrowing' as DashboardTab },
    { label: t.dashboard.overdue, value: stats.overdueLoans, icon: AlertCircle, className: stats.overdueLoans ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-700', tab: 'operations' as DashboardTab },
    { label: labels.reservations, value: stats.activeReservations, icon: CalendarClock, className: 'bg-amber-50 text-amber-700', tab: 'operations' as DashboardTab },
    { label: t.dashboard.activeStudents, value: stats.activeStudents, icon: Users, className: 'bg-violet-50 text-violet-700', tab: 'students' as DashboardTab },
  ];

  return <div className="space-y-6 pb-10">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-black text-slate-900 sm:text-3xl">{t.dashboard.welcome}</h1><p className="mt-1 text-sm text-slate-500">{t.dashboard.systemHealth} · {labels.live}</p></div>
      <button onClick={fetchStats} className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>{labels.refresh}</button>
    </header>

    {!v4Ready && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">{labels.migration}</div>}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card, i) => <motion.button key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} onClick={() => onAction(card.tab)} className="group rounded-2xl border border-slate-200 bg-white p-5 text-start shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className={`mb-4 grid h-11 w-11 place-items-center rounded-xl ${card.className}`}><card.icon className="h-5 w-5"/></div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{card.label}</p><p className="mt-1 text-3xl font-black text-slate-900">{loading ? '—' : card.value.toLocaleString()}</p></motion.button>)}
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <button onClick={() => onAction('operations')} className="rounded-2xl bg-slate-950 p-6 text-start text-white shadow-sm transition hover:bg-slate-900"><CalendarClock className="mb-5 h-7 w-7 text-blue-300"/><h3 className="text-lg font-bold">{labels.circulation}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{labels.circulationText}</p></button>
      <button onClick={() => onAction('fines')} className="rounded-2xl border border-slate-200 bg-white p-6 text-start shadow-sm transition hover:border-slate-300 hover:shadow-md"><CircleDollarSign className="mb-5 h-7 w-7 text-emerald-600"/><div className="flex items-end justify-between gap-4"><div><h3 className="text-lg font-bold text-slate-900">{labels.finesAction}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{labels.finesText}</p></div>{v4Ready && <span className="whitespace-nowrap text-lg font-black text-rose-600">{stats.outstandingFines.toFixed(2)} EGP</span>}</div></button>
      <button onClick={() => onAction('reports')} className="rounded-2xl border border-slate-200 bg-white p-6 text-start shadow-sm transition hover:border-slate-300 hover:shadow-md"><BarChart3 className="mb-5 h-7 w-7 text-blue-600"/><h3 className="text-lg font-bold text-slate-900">{labels.reports}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{labels.reportsText}</p></button>
    </div>
  </div>;
}
