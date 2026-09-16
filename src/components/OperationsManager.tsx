import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, BookOpenCheck, CalendarClock, CheckCircle2, Clock3, Plus, RotateCcw, XCircle } from 'lucide-react';
import { supabase } from '../services/supabase-client';
import { Language } from '../translations';

type BookOption = { id: number; title: string; quantity?: number; current_borrows?: number };
type StudentOption = { student_id: string; student_name: string };
type Reservation = {
  id: number;
  book_id: number;
  student_id: string;
  status: 'waiting' | 'ready' | 'fulfilled' | 'cancelled' | 'expired';
  reserved_at: string;
  expires_at?: string | null;
  notes?: string | null;
  books?: { title?: string } | null;
  students?: { student_name?: string } | null;
};
type OverdueLoan = {
  id: number;
  book_id: number;
  book_title?: string | null;
  student_id: string;
  student_name: string;
  expected_return_date: string;
  overdue_days: number;
};

const labels = {
  en: {
    title: 'Circulation Center', subtitle: 'Reservations, overdue queue and day-to-day library operations.',
    newHold: 'New reservation', student: 'Student', book: 'Book', note: 'Note (optional)', create: 'Create reservation',
    active: 'Reservations', overdue: 'Overdue queue', waiting: 'Waiting', ready: 'Ready', fulfilled: 'Fulfilled', cancelled: 'Cancelled',
    markReady: 'Mark ready', fulfill: 'Fulfill', cancel: 'Cancel', days: 'days overdue', noReservations: 'No active reservations.', noOverdue: 'No overdue loans.',
    migration: 'Operations tables are not available yet. Run migrations/002_library_pro_v4.sql in Supabase first.'
  },
  ar: {
    title: 'مركز الإعارة والتداول', subtitle: 'الحجوزات والمتأخرات والعمليات اليومية للمكتبة.',
    newHold: 'حجز جديد', student: 'الطالب', book: 'الكتاب', note: 'ملاحظة (اختياري)', create: 'إنشاء الحجز',
    active: 'الحجوزات', overdue: 'قائمة المتأخرات', waiting: 'قيد الانتظار', ready: 'جاهز', fulfilled: 'تم التسليم', cancelled: 'ملغي',
    markReady: 'تجهيز', fulfill: 'تسليم', cancel: 'إلغاء', days: 'يوم تأخير', noReservations: 'لا توجد حجوزات نشطة.', noOverdue: 'لا توجد إعارات متأخرة.',
    migration: 'جداول العمليات غير متاحة بعد. شغّل migrations/002_library_pro_v4.sql على Supabase أولاً.'
  }
};

export default function OperationsManager({ lang }: { lang: Language }) {
  const t = labels[lang];
  const [books, setBooks] = useState<BookOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [overdue, setOverdue] = useState<OverdueLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ student_id: '', book_id: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    const [bookRes, studentRes, reservationRes, overdueRes] = await Promise.all([
      supabase.from('books').select('id,title,quantity,current_borrows').eq('is_archived', false).order('title'),
      supabase.from('students').select('student_id,student_name').eq('status', 'active').order('student_name'),
      supabase.from('reservations').select('id,book_id,student_id,status,reserved_at,expires_at,notes,books(title),students(student_name)').in('status', ['waiting', 'ready']).order('reserved_at', { ascending: true }),
      supabase.from('overdue_loans').select('id,book_id,book_title,student_id,student_name,expected_return_date,overdue_days').order('overdue_days', { ascending: false })
    ]);

    if (reservationRes.error || overdueRes.error) {
      setError(t.migration);
    }
    if (!bookRes.error) setBooks((bookRes.data || []) as BookOption[]);
    if (!studentRes.error) setStudents((studentRes.data || []) as StudentOption[]);
    if (!reservationRes.error) setReservations((reservationRes.data || []) as unknown as Reservation[]);
    if (!overdueRes.error) setOverdue((overdueRes.data || []) as OverdueLoan[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [lang]);

  const availableBooks = useMemo(() => books.filter(b => (b.quantity || 0) > 0), [books]);

  const createReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.student_id || !form.book_id) return;
    setSaving(true);
    const { error: insertError } = await supabase.from('reservations').insert({
      student_id: form.student_id,
      book_id: Number(form.book_id),
      notes: form.notes.trim() || null,
      status: 'waiting'
    });
    setSaving(false);
    if (insertError) return setError(insertError.message);
    setForm({ student_id: '', book_id: '', notes: '' });
    await load();
  };

  const updateReservation = async (id: number, status: Reservation['status']) => {
    const patch: Record<string, unknown> = { status };
    if (status === 'ready') {
      patch.ready_at = new Date().toISOString();
      patch.expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    }
    if (status === 'fulfilled') patch.fulfilled_at = new Date().toISOString();
    const { error: updateError } = await supabase.from('reservations').update(patch).eq('id', id);
    if (updateError) return setError(updateError.message);
    await load();
  };

  const statusBadge = (status: Reservation['status']) => {
    const cls = status === 'ready' ? 'bg-emerald-100 text-emerald-700' : status === 'waiting' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
    return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${cls}`}>{t[status as 'waiting' | 'ready' | 'fulfilled' | 'cancelled'] || status}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex items-center gap-3"><BookOpenCheck className="h-6 w-6 text-blue-300" /><div><h3 className="text-xl font-bold">{t.title}</h3><p className="mt-1 text-sm text-slate-300">{t.subtitle}</p></div></div>
      </div>

      {error && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span></div>}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <form onSubmit={createReservation} className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2"><Plus className="h-5 w-5 text-blue-600" /><h4 className="font-bold text-slate-900">{t.newHold}</h4></div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">{t.student}</label>
          <select required value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} className="mb-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">
            <option value="">-- {t.student} --</option>{students.map(s => <option key={s.student_id} value={s.student_id}>{s.student_name} · {s.student_id}</option>)}
          </select>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">{t.book}</label>
          <select required value={form.book_id} onChange={e => setForm({ ...form, book_id: e.target.value })} className="mb-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">
            <option value="">-- {t.book} --</option>{availableBooks.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">{t.note}</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className="mb-4 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
          <button disabled={saving} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? '...' : t.create}</button>
        </form>

        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-5"><div className="flex items-center gap-2"><BellRing className="h-5 w-5 text-blue-600" /><h4 className="font-bold text-slate-900">{t.active}</h4></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{reservations.length}</span></div>
            <div className="divide-y divide-slate-100">
              {!loading && reservations.length === 0 && <p className="p-8 text-center text-sm text-slate-500">{t.noReservations}</p>}
              {reservations.map(r => <div key={r.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{r.books?.title || `Book #${r.book_id}`}</p>{statusBadge(r.status)}</div><p className="text-sm text-slate-600">{r.students?.student_name || r.student_id} · {r.student_id}</p><p className="mt-1 text-xs text-slate-400">{new Date(r.reserved_at).toLocaleString()}</p></div>
                <div className="flex flex-wrap gap-2">
                  {r.status === 'waiting' && <button onClick={() => updateReservation(r.id, 'ready')} className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"><Clock3 className="h-4 w-4" />{t.markReady}</button>}
                  {r.status === 'ready' && <button onClick={() => updateReservation(r.id, 'fulfilled')} className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"><CheckCircle2 className="h-4 w-4" />{t.fulfill}</button>}
                  <button onClick={() => updateReservation(r.id, 'cancelled')} className="flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"><XCircle className="h-4 w-4" />{t.cancel}</button>
                </div>
              </div>)}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-5"><div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-rose-600" /><h4 className="font-bold text-slate-900">{t.overdue}</h4></div><button onClick={load} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Refresh"><RotateCcw className="h-4 w-4" /></button></div>
            <div className="divide-y divide-slate-100">
              {!loading && overdue.length === 0 && <p className="p-8 text-center text-sm text-slate-500">{t.noOverdue}</p>}
              {overdue.map(row => <div key={row.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"><div><p className="font-bold text-slate-900">{row.book_title || `Book #${row.book_id}`}</p><p className="mt-1 text-sm text-slate-600">{row.student_name} · {row.student_id}</p><p className="mt-1 text-xs text-slate-400">Due: {new Date(row.expected_return_date).toLocaleDateString()}</p></div><div className="inline-flex w-fit items-center gap-2 rounded-full bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700"><AlertTriangle className="h-4 w-4" />{row.overdue_days} {t.days}</div></div>)}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
