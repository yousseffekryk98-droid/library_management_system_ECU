import React, { useEffect, useState } from 'react';
import { Bell, BookHeart, BookOpen, CalendarClock, CircleDollarSign, Globe, Library, LogOut, Search, UserRound } from 'lucide-react';
import { Language } from '../translations';
import { supabase } from '../services/supabase-client';

type CatalogBook = { id: number; title: string; author?: string; category?: string; language?: string; publication_year?: number; isbn?: string; available_copies: number; total_tracked_copies: number; location?: string; is_reference_only?: boolean };
type Loan = { id: number; book_id: number; book_title?: string; borrow_date?: string; expected_return_date?: string; return_date?: string; renewed_count?: number };
type Reservation = { id: number; book_id: number; status: string; queue_position?: number; reserved_at: string; expires_at?: string; books?: { title?: string; author?: string } };
type Fine = { id: number; type: string; amount: number; paid_amount: number; status: string; reason?: string; due_date?: string };
type Notice = { id: number; title: string; body: string; status: string; channel: string; created_at: string };
type Summary = { student_id: string; student_name: string; email?: string; faculty_name?: string; department?: string; academic_year?: string; status: string; borrow_limit: number; active_loans: number; active_reservations: number; outstanding_fines: number };

type PortalTab = 'catalog' | 'loans' | 'holds' | 'fines' | 'notices' | 'account';

export default function PatronPortal({ lang, setLang, signOut }: { lang: Language; setLang: (l: Language) => void; signOut: () => Promise<void> }) {
  const ar = lang === 'ar';
  const [tab, setTab] = useState<PortalTab>('catalog');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [catalog, setCatalog] = useState<CatalogBook[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const load = async () => {
    const [{ data: s }, { data: c }, { data: l }, { data: r }, { data: f }, { data: n }] = await Promise.all([
      supabase.from('patron_my_account_summary').select('*').maybeSingle(),
      supabase.from('patron_catalog').select('*').order('title').limit(1200),
      supabase.from('borrowing').select('*').order('borrow_date', { ascending: false }).limit(200),
      supabase.from('reservations').select('*, books(title,author)').order('reserved_at', { ascending: false }).limit(100),
      supabase.from('fines').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('library_notices').select('*').order('created_at', { ascending: false }).limit(100)
    ]);
    setSummary((s as Summary | null) || null);
    setCatalog((c || []) as CatalogBook[]);
    setLoans((l || []) as Loan[]);
    setReservations((r || []) as Reservation[]);
    setFines((f || []) as Fine[]);
    setNotices((n || []) as Notice[]);
  };

  useEffect(() => { load(); }, []);

  const reserve = async (bookId: number) => {
    const { error } = await supabase.rpc('create_my_reservation', { book_id_in: bookId });
    if (error) return alert(error.message);
    setTab('holds');
    load();
  };

  const cancelHold = async (id: number) => {
    const { error } = await supabase.rpc('cancel_my_reservation', { reservation_id_in: id });
    if (error) return alert(error.message);
    load();
  };

  const readNotice = async (id: number) => {
    const { error } = await supabase.rpc('mark_my_notice_read', { notice_id_in: id });
    if (error) return alert(error.message);
    load();
  };

  const categories = Array.from(new Set(catalog.map(b => b.category).filter(Boolean) as string[])).sort();
  const filteredBooks = catalog.filter(book => {
    const q = search.toLowerCase();
    const match = !q || book.title.toLowerCase().includes(q) || (book.author || '').toLowerCase().includes(q) || (book.isbn || '').toLowerCase().includes(q);
    return match && (category === 'all' || book.category === category);
  });
  const activeLoans = loans.filter(l => !l.return_date);
  const overdueIds = new Set(activeLoans.filter(l => l.expected_return_date && new Date(l.expected_return_date).getTime() < Date.now()).map(l => l.id));

  const nav = [
    { id: 'catalog' as const, label: ar ? 'الفهرس' : 'Catalog', icon: Library },
    { id: 'loans' as const, label: ar ? 'استعاراتي' : 'My loans', icon: BookOpen },
    { id: 'holds' as const, label: ar ? 'حجوزاتي' : 'Reservations', icon: CalendarClock },
    { id: 'fines' as const, label: ar ? 'الغرامات' : 'Fines', icon: CircleDollarSign },
    { id: 'notices' as const, label: ar ? 'الإشعارات' : 'Notices', icon: Bell },
    { id: 'account' as const, label: ar ? 'حسابي' : 'Account', icon: UserRound },
  ];

  return <div dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-100">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3 sm:px-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><Library className="h-5 w-5"/></div><div><p className="font-black">ECU Library</p><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{ar ? 'بوابة الطالب' : 'Student Portal'}</p></div></div><div className="flex items-center gap-2"><button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="rounded-lg border border-slate-200 p-2"><Globe className="h-4 w-4"/></button><button onClick={signOut} className="rounded-lg bg-rose-50 p-2 text-rose-600"><LogOut className="h-4 w-4"/></button></div></div></header>

    <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl bg-slate-950 p-4 text-white"><p className="text-xs font-bold uppercase text-slate-400">{ar ? 'مرحباً' : 'Welcome'}</p><p className="mt-1 truncate text-lg font-black">{summary?.student_name || 'Student'}</p><p className="text-xs text-slate-400">{summary?.student_id}</p></div><div className="rounded-2xl bg-blue-50 p-4"><BookOpen className="mb-2 h-5 w-5 text-blue-600"/><p className="text-xs font-bold text-blue-700">{ar ? 'استعارات نشطة' : 'Active loans'}</p><p className="text-2xl font-black text-blue-950">{summary?.active_loans || 0}</p></div><div className="rounded-2xl bg-violet-50 p-4"><BookHeart className="mb-2 h-5 w-5 text-violet-600"/><p className="text-xs font-bold text-violet-700">{ar ? 'حجوزات نشطة' : 'Active holds'}</p><p className="text-2xl font-black text-violet-950">{summary?.active_reservations || 0}</p></div><div className="rounded-2xl bg-amber-50 p-4"><CircleDollarSign className="mb-2 h-5 w-5 text-amber-600"/><p className="text-xs font-bold text-amber-700">{ar ? 'مبلغ مستحق' : 'Outstanding fines'}</p><p className="text-2xl font-black text-amber-950">{Number(summary?.outstanding_fines || 0).toLocaleString()} EGP</p></div></div>

      <nav className="mb-6 flex gap-2 overflow-x-auto pb-1">{nav.map(item => <button key={item.id} onClick={() => setTab(item.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black ${tab === item.id ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}><item.icon className="h-4 w-4"/>{item.label}</button>)}</nav>

      {tab === 'catalog' && <div className="space-y-4"><div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_240px]"><div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input className="input ps-9" placeholder={ar ? 'ابحث بالعنوان أو المؤلف أو ISBN' : 'Search title, author or ISBN'} value={search} onChange={e => setSearch(e.target.value)}/></div><select className="input" value={category} onChange={e => setCategory(e.target.value)}><option value="all">{ar ? 'كل التصنيفات' : 'All categories'}</option>{categories.map(c => <option key={c}>{c}</option>)}</select></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredBooks.map(book => <article key={book.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex-1"><div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="font-black leading-snug">{book.title}</h2><p className="mt-1 text-sm text-slate-500">{book.author || '—'}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${Number(book.available_copies) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{Number(book.available_copies)} {ar ? 'متاح' : 'available'}</span></div><div className="space-y-1 text-xs text-slate-500"><p>{book.category || 'General'} · {book.language || '—'} {book.publication_year ? `· ${book.publication_year}` : ''}</p><p>{book.location || (ar ? 'اسأل موظف المكتبة' : 'Ask library staff')}</p>{book.is_reference_only && <p className="font-bold text-amber-700">{ar ? 'للاطلاع داخل المكتبة فقط' : 'Reference use only'}</p>}</div></div><button disabled={book.is_reference_only} onClick={() => reserve(book.id)} className="btn-secondary mt-4 w-full disabled:opacity-40"><BookHeart className="h-4 w-4"/>{ar ? 'حجز الكتاب' : 'Reserve title'}</button></article>)}</div></div>}

      {tab === 'loans' && <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-black">{ar ? 'سجل الاستعارات' : 'Loan history'}</h2></div><div className="divide-y divide-slate-100">{loans.map(loan => <div key={loan.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{loan.book_title || `Book #${loan.book_id}`}</p><p className="text-xs text-slate-500">{loan.borrow_date ? new Date(loan.borrow_date).toLocaleDateString() : '—'} → {loan.expected_return_date ? new Date(loan.expected_return_date).toLocaleDateString() : '—'}</p></div><span className={`w-fit rounded-full px-2 py-1 text-[10px] font-black uppercase ${loan.return_date ? 'bg-slate-100 text-slate-600' : overdueIds.has(loan.id) ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>{loan.return_date ? (ar ? 'تم الإرجاع' : 'Returned') : overdueIds.has(loan.id) ? (ar ? 'متأخر' : 'Overdue') : (ar ? 'نشط' : 'Active')}</span></div>)}</div></div>}

      {tab === 'holds' && <div className="grid gap-4 md:grid-cols-2">{reservations.map(r => <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{r.books?.title || `Book #${r.book_id}`}</p><p className="text-xs text-slate-500">{r.books?.author || '—'}</p></div><span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-black uppercase text-violet-700">{r.status}</span></div><p className="mt-3 text-xs text-slate-500">{ar ? 'ترتيب الانتظار' : 'Queue position'}: {r.queue_position || '—'}</p>{['waiting','ready'].includes(r.status) && <button onClick={() => cancelHold(r.id)} className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">{ar ? 'إلغاء الحجز' : 'Cancel reservation'}</button>}</div>)}</div>}

      {tab === 'fines' && <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="divide-y divide-slate-100">{fines.map(f => <div key={f.id} className="flex items-center justify-between gap-4 p-5"><div><p className="font-bold capitalize">{f.type}</p><p className="text-xs text-slate-500">{f.reason || '—'} {f.due_date ? `· ${f.due_date}` : ''}</p></div><div className="text-end"><p className="font-black">{Number(f.amount - f.paid_amount).toLocaleString()} EGP</p><p className="text-[10px] font-bold uppercase text-slate-500">{f.status}</p></div></div>)}{!fines.length && <p className="p-10 text-center text-sm text-slate-400">{ar ? 'لا توجد غرامات.' : 'No fines.'}</p>}</div></div>}

      {tab === 'notices' && <div className="grid gap-4 md:grid-cols-2">{notices.map(n => <button key={n.id} onClick={() => n.status === 'sent' && readNotice(n.id)} className={`rounded-2xl border p-5 text-start ${n.status === 'sent' ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white'}`}><div className="flex items-start justify-between gap-3"><p className="font-black">{n.title}</p><span className="text-[10px] font-black uppercase text-slate-400">{n.status}</span></div><p className="mt-2 text-sm text-slate-600">{n.body}</p><p className="mt-3 text-[10px] text-slate-400">{new Date(n.created_at).toLocaleString()} · {n.channel}</p></button>)}</div>}

      {tab === 'account' && <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100"><UserRound className="h-6 w-6 text-blue-600"/></div><div><p className="text-lg font-black">{summary?.student_name}</p><p className="text-xs text-slate-500">{summary?.student_id}</p></div></div><dl className="grid gap-4 sm:grid-cols-2">{[[ar ? 'البريد' : 'Email', summary?.email || '—'], [ar ? 'الكلية' : 'Faculty', summary?.faculty_name || '—'], [ar ? 'القسم' : 'Department', summary?.department || '—'], [ar ? 'السنة الدراسية' : 'Academic year', summary?.academic_year || '—'], [ar ? 'حالة العضوية' : 'Membership', summary?.status || '—'], [ar ? 'حد الاستعارة' : 'Borrow limit', String(summary?.borrow_limit || 0)]].map(([k,v]) => <div key={k} className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-black uppercase text-slate-400">{k}</dt><dd className="mt-1 font-bold">{v}</dd></div>)}</dl></div>}
    </div>
  </div>;
}
