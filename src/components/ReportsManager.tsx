import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, BookCopy, Download, RefreshCw, TriangleAlert, UsersRound, WalletCards } from 'lucide-react';
import { supabase } from '../services/supabase-client';
import { Language } from '../translations';

type Loan = { id: number; book_id: number; book_title?: string | null; student_id: string; student_name: string; borrow_date: string; expected_return_date?: string | null; return_date?: string | null };
type Book = { id: number; title: string; category?: string | null; quantity?: number | null; current_borrows?: number | null; author?: string | null };
type Fine = { amount: number; paid_amount: number; status: string };

const copy = {
  en: { title: 'Reports & Analytics', subtitle: 'Live operational insight from the library database.', loans: 'Loans', active: 'Active loans', overdue: 'Overdue', students: 'Borrowers', copies: 'Physical copies', fines: 'Outstanding fines', popular: 'Most borrowed titles', categories: 'Collection by category', export: 'Export loan CSV', refresh: 'Refresh', migration: 'Some v4 analytics are unavailable until migration 002 is applied.', empty: 'No data yet.' },
  ar: { title: 'التقارير والتحليلات', subtitle: 'مؤشرات تشغيلية مباشرة من قاعدة بيانات المكتبة.', loans: 'الإعارات', active: 'إعارات نشطة', overdue: 'متأخرة', students: 'المستعيرون', copies: 'النسخ الفعلية', fines: 'غرامات مستحقة', popular: 'الأكثر استعارة', categories: 'المجموعة حسب التصنيف', export: 'تصدير CSV', refresh: 'تحديث', migration: 'بعض تحليلات الإصدار الرابع تحتاج تشغيل migration 002.', empty: 'لا توجد بيانات بعد.' }
};

export default function ReportsManager({ lang }: { lang: Language }) {
  const t = copy[lang];
  const [books, setBooks] = useState<Book[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState('');

  const load = async () => {
    setLoading(true); setWarning('');
    const [bookRes, loanRes, fineRes] = await Promise.all([
      supabase.from('books').select('id,title,author,category,quantity,current_borrows').order('title'),
      supabase.from('borrowing').select('id,book_id,book_title,student_id,student_name,borrow_date,expected_return_date,return_date').order('borrow_date', { ascending: false }),
      supabase.from('fines').select('amount,paid_amount,status')
    ]);
    if (!bookRes.error) setBooks((bookRes.data || []) as Book[]);
    if (!loanRes.error) setLoans((loanRes.data || []) as Loan[]);
    if (fineRes.error) setWarning(t.migration); else setFines((fineRes.data || []) as Fine[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [lang]);

  const metrics = useMemo(() => {
    const now = Date.now();
    const active = loans.filter(l => !l.return_date);
    const overdue = active.filter(l => l.expected_return_date && new Date(l.expected_return_date).getTime() < now);
    const students = new Set(loans.map(l => l.student_id).filter(Boolean)).size;
    const copies = books.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
    const outstanding = fines.filter(f => f.status === 'unpaid' || f.status === 'partial').reduce((sum, f) => sum + Math.max(Number(f.amount || 0) - Number(f.paid_amount || 0), 0), 0);
    return { active: active.length, overdue: overdue.length, students, copies, outstanding };
  }, [books, loans, fines]);

  const popular = useMemo(() => {
    const counts = new Map<number, { title: string; count: number }>();
    loans.forEach(l => { const prev = counts.get(l.book_id); counts.set(l.book_id, { title: l.book_title || books.find(b => b.id === l.book_id)?.title || `Book #${l.book_id}`, count: (prev?.count || 0) + 1 }); });
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [loans, books]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    books.forEach(b => { const key = (b.category || 'Uncategorized').trim() || 'Uncategorized'; counts.set(key, (counts.get(key) || 0) + Number(b.quantity || 0)); });
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [books]);

  const exportCsv = () => {
    const header = ['Loan ID','Book','Student ID','Student','Borrow Date','Due Date','Return Date'];
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = loans.map(l => [l.id, l.book_title || '', l.student_id, l.student_name, l.borrow_date, l.expected_return_date || '', l.return_date || ''].map(escape).join(','));
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `ecu-library-loans-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const Stat = ({ icon: Icon, label, value, detail }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; detail?: string }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span><Icon className="h-5 w-5 text-blue-600" /></div><p className="text-3xl font-black text-slate-900">{value}</p>{detail && <p className="mt-1 text-xs text-slate-400">{detail}</p>}</div>
  );

  const Bars = ({ rows }: { rows: { name: string; count: number }[] }) => {
    const max = Math.max(...rows.map(r => r.count), 1);
    if (!rows.length) return <p className="py-10 text-center text-sm text-slate-400">{t.empty}</p>;
    return <div className="space-y-4">{rows.map((r, i) => <div key={`${r.name}-${i}`}><div className="mb-1 flex items-center justify-between gap-4 text-xs"><span className="truncate font-semibold text-slate-700">{r.name}</span><span className="font-bold text-slate-500">{r.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max((r.count / max) * 100, 4)}%` }} /></div></div>)}</div>;
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 rounded-2xl bg-slate-950 p-6 text-white md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-3"><BarChart3 className="mt-1 h-6 w-6 text-blue-300"/><div><h3 className="text-xl font-bold">{t.title}</h3><p className="mt-1 text-sm text-slate-300">{t.subtitle}</p></div></div><div className="flex gap-2"><button onClick={load} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>{t.refresh}</button><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold hover:bg-blue-500"><Download className="h-4 w-4"/>{t.export}</button></div></div>
    {warning && <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><TriangleAlert className="h-5 w-5"/>{warning}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Stat icon={BookCopy} label={t.copies} value={metrics.copies}/><Stat icon={BookCopy} label={t.active} value={metrics.active}/><Stat icon={TriangleAlert} label={t.overdue} value={metrics.overdue}/><Stat icon={UsersRound} label={t.students} value={metrics.students}/><Stat icon={WalletCards} label={t.fines} value={`${metrics.outstanding.toFixed(2)} EGP`}/></div>
    <div className="grid gap-6 xl:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h4 className="mb-6 font-bold text-slate-900">{t.popular}</h4><Bars rows={popular.map(r => ({ name: r.title, count: r.count }))}/></section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h4 className="mb-6 font-bold text-slate-900">{t.categories}</h4><Bars rows={categories}/></section></div>
  </div>;
}
