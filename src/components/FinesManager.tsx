import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CircleDollarSign, Plus, ReceiptText, Search, ShieldCheck, WalletCards } from 'lucide-react';
import { supabase } from '../services/supabase-client';
import { Language } from '../translations';

type Student = { student_id: string; student_name: string };
type Fine = {
  id: number;
  student_id: string;
  type: 'overdue' | 'lost' | 'damage' | 'manual';
  amount: number;
  paid_amount: number;
  status: 'unpaid' | 'partial' | 'paid' | 'waived';
  reason?: string | null;
  created_at: string;
  students?: { student_name?: string } | null;
  borrowing?: { book_title?: string } | null;
};

const words = {
  en: {
    title: 'Fines & Payments', subtitle: 'Manage overdue, damage, lost-book and manual charges.',
    create: 'Create fine', student: 'Student', type: 'Type', amount: 'Amount (EGP)', reason: 'Reason', save: 'Add fine',
    ledger: 'Fine ledger', search: 'Search student or reason...', all: 'All', open: 'Open', paid: 'Paid', waived: 'Waived',
    remaining: 'Remaining', pay: 'Record payment', paymentAmount: 'Payment amount', submitPayment: 'Save payment', waive: 'Waive',
    totalOpen: 'Outstanding', collected: 'Collected', openCount: 'Open fines', noRows: 'No fines match this filter.',
    missing: 'Fines tables are unavailable. Run migrations 002 and 003 in Supabase.'
  },
  ar: {
    title: 'الغرامات والمدفوعات', subtitle: 'إدارة غرامات التأخير والتلف والفقد والغرامات اليدوية.',
    create: 'إضافة غرامة', student: 'الطالب', type: 'النوع', amount: 'المبلغ (جنيه)', reason: 'السبب', save: 'إضافة الغرامة',
    ledger: 'سجل الغرامات', search: 'بحث بالطالب أو السبب...', all: 'الكل', open: 'مستحق', paid: 'مدفوع', waived: 'معفى',
    remaining: 'المتبقي', pay: 'تسجيل دفعة', paymentAmount: 'قيمة الدفعة', submitPayment: 'حفظ الدفعة', waive: 'إعفاء',
    totalOpen: 'إجمالي المستحق', collected: 'تم تحصيله', openCount: 'غرامات مفتوحة', noRows: 'لا توجد غرامات مطابقة.',
    missing: 'جداول الغرامات غير متاحة. شغّل migrations 002 و003 على Supabase.'
  }
};

export default function FinesManager({ lang }: { lang: Language }) {
  const t = words[lang];
  const [students, setStudents] = useState<Student[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'paid' | 'waived'>('open');
  const [form, setForm] = useState({ student_id: '', type: 'manual', amount: '', reason: '' });
  const [payment, setPayment] = useState<{ fineId: number; amount: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError('');
    const [studentsRes, finesRes] = await Promise.all([
      supabase.from('students').select('student_id,student_name').order('student_name'),
      supabase.from('fines').select('id,student_id,type,amount,paid_amount,status,reason,created_at,students(student_name),borrowing(book_title)').order('created_at', { ascending: false })
    ]);
    if (!studentsRes.error) setStudents((studentsRes.data || []) as Student[]);
    if (finesRes.error) setError(t.missing);
    else setFines((finesRes.data || []) as unknown as Fine[]);
  };

  useEffect(() => { load(); }, [lang]);

  const createFine = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.student_id || !Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    const { error: insertError } = await supabase.from('fines').insert({
      student_id: form.student_id,
      type: form.type,
      amount,
      reason: form.reason.trim() || null,
      status: 'unpaid'
    });
    setSaving(false);
    if (insertError) return setError(insertError.message);
    setForm({ student_id: '', type: 'manual', amount: '', reason: '' });
    await load();
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    const { error: payError } = await supabase.from('fine_payments').insert({ fine_id: payment.fineId, amount, payment_method: 'cash' });
    setSaving(false);
    if (payError) return setError(payError.message);
    setPayment(null);
    await load();
  };

  const waiveFine = async (id: number) => {
    const { error: waiveError } = await supabase.from('fines').update({ status: 'waived', waived_reason: 'Waived by library staff' }).eq('id', id);
    if (waiveError) return setError(waiveError.message);
    await load();
  };

  const metrics = useMemo(() => {
    const outstanding = fines.filter(f => f.status === 'unpaid' || f.status === 'partial').reduce((sum, f) => sum + Math.max(Number(f.amount) - Number(f.paid_amount || 0), 0), 0);
    const collected = fines.reduce((sum, f) => sum + Number(f.paid_amount || 0), 0);
    const openCount = fines.filter(f => f.status === 'unpaid' || f.status === 'partial').length;
    return { outstanding, collected, openCount };
  }, [fines]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fines.filter(f => {
      const matchesSearch = !q || `${f.students?.student_name || ''} ${f.student_id} ${f.reason || ''} ${f.borrowing?.book_title || ''}`.toLowerCase().includes(q);
      const matchesFilter = filter === 'all' || (filter === 'open' && (f.status === 'unpaid' || f.status === 'partial')) || f.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [fines, search, filter]);

  const statusClass = (status: Fine['status']) => status === 'paid' ? 'bg-emerald-100 text-emerald-700' : status === 'waived' ? 'bg-slate-100 text-slate-600' : status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';

  return <div className="space-y-6">
    <div className="rounded-2xl bg-slate-950 p-6 text-white"><div className="flex items-center gap-3"><CircleDollarSign className="h-6 w-6 text-blue-300"/><div><h3 className="text-xl font-bold">{t.title}</h3><p className="mt-1 text-sm text-slate-300">{t.subtitle}</p></div></div></div>
    {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>}

    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">{t.totalOpen}</p><p className="mt-2 text-2xl font-black text-rose-600">{metrics.outstanding.toFixed(2)} EGP</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">{t.collected}</p><p className="mt-2 text-2xl font-black text-emerald-600">{metrics.collected.toFixed(2)} EGP</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">{t.openCount}</p><p className="mt-2 text-2xl font-black text-slate-900">{metrics.openCount}</p></div>
    </div>

    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={createFine} className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2"><Plus className="h-5 w-5 text-blue-600"/><h4 className="font-bold text-slate-900">{t.create}</h4></div>
        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">{t.student}</label>
        <select required value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} className="mb-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">-- {t.student} --</option>{students.map(s => <option key={s.student_id} value={s.student_id}>{s.student_name} · {s.student_id}</option>)}</select>
        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">{t.type}</label>
        <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="mb-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="overdue">Overdue</option><option value="damage">Damage</option><option value="lost">Lost book</option><option value="manual">Manual</option></select>
        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">{t.amount}</label>
        <input required min="0.01" step="0.01" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"/>
        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">{t.reason}</label>
        <textarea rows={3} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="mb-4 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm"/>
        <button disabled={saving} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? '...' : t.save}</button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5"><div className="mb-4 flex items-center gap-2"><ReceiptText className="h-5 w-5 text-blue-600"/><h4 className="font-bold text-slate-900">{t.ledger}</h4></div><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm"/></div><div className="flex flex-wrap gap-2">{(['all','open','paid','waived'] as const).map(key => <button key={key} onClick={() => setFilter(key)} className={`rounded-lg px-3 py-2 text-xs font-bold ${filter === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t[key]}</button>)}</div></div></div>
        <div className="divide-y divide-slate-100">{rows.length === 0 && <p className="p-10 text-center text-sm text-slate-400">{t.noRows}</p>}{rows.map(f => { const remaining = Math.max(Number(f.amount) - Number(f.paid_amount || 0), 0); return <div key={f.id} className="p-5"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{f.students?.student_name || f.student_id}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${statusClass(f.status)}`}>{f.status}</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-700">{f.type}</span></div><p className="mt-1 text-sm text-slate-500">{f.student_id}{f.borrowing?.book_title ? ` · ${f.borrowing.book_title}` : ''}</p>{f.reason && <p className="mt-2 text-sm text-slate-700">{f.reason}</p>}<p className="mt-2 text-xs text-slate-400">{new Date(f.created_at).toLocaleString()}</p></div><div className="min-w-40 text-start md:text-end"><p className="text-lg font-black text-slate-900">{Number(f.amount).toFixed(2)} EGP</p><p className="text-xs font-bold text-rose-600">{t.remaining}: {remaining.toFixed(2)} EGP</p>{(f.status === 'unpaid' || f.status === 'partial') && <div className="mt-3 flex flex-wrap gap-2 md:justify-end"><button onClick={() => setPayment({ fineId: f.id, amount: remaining.toFixed(2) })} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"><Banknote className="h-4 w-4"/>{t.pay}</button><button onClick={() => waiveFine(f.id)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"><ShieldCheck className="h-4 w-4"/>{t.waive}</button></div>}</div></div>
          {payment?.fineId === f.id && <form onSubmit={recordPayment} className="mt-4 flex flex-col gap-2 rounded-xl bg-emerald-50 p-3 sm:flex-row sm:items-end"><div className="flex-1"><label className="mb-1 block text-xs font-bold text-emerald-800">{t.paymentAmount}</label><input autoFocus type="number" min="0.01" max={remaining} step="0.01" value={payment.amount} onChange={e => setPayment({ ...payment, amount: e.target.value })} className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"/></div><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white"><WalletCards className="h-4 w-4"/>{t.submitPayment}</button><button type="button" onClick={() => setPayment(null)} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500">×</button></form>}
        </div>})}</div>
      </section>
    </div>
  </div>;
}
