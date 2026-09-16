import React, { useEffect, useMemo, useState } from 'react';
import { Barcode, BookOpen, Calendar, CheckCircle, History, RotateCcw, Search, User, X } from 'lucide-react';
import { format } from 'date-fns';
import { translations, Language } from '../translations';
import { supabase } from '../services/supabase-client';

type Copy = {
  id: number;
  book_id: number;
  accession_number: string;
  barcode?: string | null;
  branch?: string | null;
  room?: string | null;
  sector?: string | null;
  shelf_number?: string | null;
  books?: { title?: string; author?: string; isbn?: string } | null;
};

type BorrowingRecord = {
  id: number;
  book_id: number;
  copy_id?: number | null;
  book_title: string;
  student_name: string;
  student_id: string;
  college_name?: string | null;
  faculty_name?: string | null;
  academic_year?: string | null;
  borrow_date: string;
  expected_return_date: string;
  return_date: string | null;
  condition_on_return?: string | null;
  book_copies?: { accession_number?: string; barcode?: string } | null;
};

export default function BorrowManager({ lang }: { lang: Language }) {
  const t = translations[lang];
  const ar = lang === 'ar';
  const [borrowing, setBorrowing] = useState<BorrowingRecord[]>([]);
  const [availableCopies, setAvailableCopies] = useState<Copy[]>([]);
  const [searchStudent, setSearchStudent] = useState('');
  const [scanValue, setScanValue] = useState('');
  const [scanMessage, setScanMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState<BorrowingRecord | null>(null);
  const [returnCondition, setReturnCondition] = useState('good');
  const [returnNote, setReturnNote] = useState('');
  const [formData, setFormData] = useState({
    copy_id: '',
    student_name: '',
    student_id: '',
    college_name: '',
    faculty_name: '',
    academic_year: '',
    duration_days: '14',
    note: ''
  });

  const fetchData = async () => {
    const [{ data: borrowData, error: borrowError }, { data: copyData, error: copyError }] = await Promise.all([
      supabase.from('borrowing').select('*, book_copies(accession_number,barcode)').order('borrow_date', { ascending: false }).limit(1000),
      supabase.from('book_copies').select('id,book_id,accession_number,barcode,branch,room,sector,shelf_number,books(title,author,isbn)').eq('status', 'available').order('accession_number').limit(2000)
    ]);
    if (borrowError) console.error('Failed loading borrowing', borrowError);
    if (copyError) console.error('Failed loading copies', copyError);
    setBorrowing((borrowData || []) as BorrowingRecord[]);
    setAvailableCopies((copyData || []) as Copy[]);
  };

  useEffect(() => { fetchData(); }, []);

  const selectedCopy = availableCopies.find(copy => String(copy.id) === formData.copy_id);

  const resolveScan = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const value = scanValue.trim();
    if (!value) return;
    setScanMessage(ar ? 'جاري البحث…' : 'Looking up copy…');
    const { data, error } = await supabase.rpc('resolve_available_copy', { scan_in: value });
    if (error) {
      setScanMessage(error.message);
      return;
    }
    const found = Array.isArray(data) ? data[0] : null;
    if (!found) {
      setScanMessage(ar ? 'لم يتم العثور على نسخة متاحة بهذا الكود.' : 'No available copy matched that scan.');
      return;
    }
    setFormData(prev => ({ ...prev, copy_id: String(found.copy_id) }));
    setScanMessage(`${found.title} · ${found.accession_number}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.copy_id) return;
    setBusy(true);
    const { error } = await supabase.rpc('checkout_library_copy', {
      copy_id_in: Number(formData.copy_id),
      student_id_in: formData.student_id.trim(),
      student_name_in: formData.student_name.trim(),
      college_name_in: formData.college_name || null,
      faculty_name_in: formData.faculty_name || null,
      academic_year_in: formData.academic_year || null,
      duration_days_in: Number(formData.duration_days),
      note_in: formData.note || null
    });
    setBusy(false);
    if (error) return alert((ar ? 'تعذر تسجيل الاستعارة: ' : 'Checkout failed: ') + error.message);
    setFormData({ copy_id: '', student_name: '', student_id: '', college_name: '', faculty_name: '', academic_year: '', duration_days: '14', note: '' });
    setScanValue('');
    setScanMessage('');
    fetchData();
  };

  const confirmReturn = async () => {
    if (!returning) return;
    setBusy(true);
    const { error } = await supabase.rpc('return_library_loan', {
      borrowing_id_in: returning.id,
      condition_on_return_in: returnCondition,
      note_in: returnNote || null
    });
    setBusy(false);
    if (error) return alert((ar ? 'تعذر الإرجاع: ' : 'Return failed: ') + error.message);
    setReturning(null);
    setReturnCondition('good');
    setReturnNote('');
    fetchData();
  };

  const safeFormatDate = (dateStr?: string | null) => {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '---';
    try { return format(d, 'yyyy-MM-dd'); } catch { return '---'; }
  };

  const getTimeLeft = (expectedDate?: string | null) => {
    if (!expectedDate) return 0;
    const d = new Date(expectedDate);
    if (Number.isNaN(d.getTime())) return 0;
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
  };

  const filteredHistory = useMemo(() => {
    const q = searchStudent.toLowerCase().trim();
    if (!q) return borrowing;
    return borrowing.filter(r =>
      (r.student_name || '').toLowerCase().includes(q) ||
      (r.student_id || '').toLowerCase().includes(q) ||
      (r.book_title || '').toLowerCase().includes(q) ||
      (r.book_copies?.accession_number || '').toLowerCase().includes(q) ||
      (r.book_copies?.barcode || '').toLowerCase().includes(q)
    );
  }, [borrowing, searchStudent]);

  const activeCount = borrowing.filter(r => !r.return_date).length;
  const overdueCount = borrowing.filter(r => !r.return_date && getTimeLeft(r.expected_return_date) < 0).length;

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-400">{ar ? 'نسخ متاحة' : 'Available copies'}</p><p className="mt-1 text-2xl font-black">{availableCopies.length}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-400">{ar ? 'إعارات نشطة' : 'Active loans'}</p><p className="mt-1 text-2xl font-black text-blue-700">{activeCount}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-400">{ar ? 'متأخر' : 'Overdue'}</p><p className="mt-1 text-2xl font-black text-rose-600">{overdueCount}</p></div>
    </div>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[390px_1fr]">
      <div className="space-y-4">
        <form onSubmit={resolveScan} className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
          <div className="mb-3 flex items-center gap-2"><Barcode className="h-5 w-5 text-blue-600"/><h2 className="font-black">{ar ? 'مسح النسخة' : 'Scanner checkout'}</h2></div>
          <p className="mb-3 text-xs text-slate-500">{ar ? 'امسح باركود النسخة أو رقم الإيداع أو ISBN.' : 'Scan a copy barcode, accession number or ISBN.'}</p>
          <div className="flex gap-2"><input autoFocus className="input flex-1 font-mono" placeholder="Barcode / Accession / ISBN" value={scanValue} onChange={e => setScanValue(e.target.value)}/><button className="btn-primary" type="submit"><Search className="h-4 w-4"/></button></div>
          {scanMessage && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700">{scanMessage}</p>}
        </form>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2"><BookOpen className="h-5 w-5 text-blue-600"/><h2 className="font-black">{t.borrowing.register}</h2></div>
          <div className="space-y-3">
            <label className="block text-xs font-black uppercase text-slate-500">{ar ? 'النسخة الفعلية' : 'Physical copy'}<select required className="input mt-1" value={formData.copy_id} onChange={e => setFormData({ ...formData, copy_id: e.target.value })}><option value="">{ar ? 'اختر نسخة متاحة' : 'Select available copy'}</option>{availableCopies.map(copy => <option key={copy.id} value={copy.id}>{copy.accession_number} — {copy.books?.title || `Book #${copy.book_id}`}{copy.barcode ? ` · ${copy.barcode}` : ''}</option>)}</select></label>
            {selectedCopy && <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><p className="font-black text-slate-900">{selectedCopy.books?.title}</p><p>{selectedCopy.books?.author || '—'}</p><p className="mt-1 font-mono">{selectedCopy.accession_number}</p><p className="mt-1">{[selectedCopy.branch, selectedCopy.room, selectedCopy.sector, selectedCopy.shelf_number].filter(Boolean).join(' / ') || '—'}</p></div>}
            <label className="block text-xs font-black uppercase text-slate-500">{t.borrowing.studentName}<input required className="input mt-1" value={formData.student_name} onChange={e => setFormData({ ...formData, student_name: e.target.value })}/></label>
            <label className="block text-xs font-black uppercase text-slate-500">{t.borrowing.studentId}<input required className="input mt-1" value={formData.student_id} onChange={e => setFormData({ ...formData, student_id: e.target.value })}/></label>
            <div className="grid grid-cols-2 gap-3"><label className="text-xs font-black uppercase text-slate-500">{t.borrowing.college}<input className="input mt-1" value={formData.college_name} onChange={e => setFormData({ ...formData, college_name: e.target.value })}/></label><label className="text-xs font-black uppercase text-slate-500">{t.borrowing.faculty}<input className="input mt-1" value={formData.faculty_name} onChange={e => setFormData({ ...formData, faculty_name: e.target.value })}/></label></div>
            <label className="block text-xs font-black uppercase text-slate-500">{t.borrowing.academicYear}<input className="input mt-1" value={formData.academic_year} onChange={e => setFormData({ ...formData, academic_year: e.target.value })}/></label>
            <label className="block text-xs font-black uppercase text-slate-500">{t.borrowing.duration}<select className="input mt-1" value={formData.duration_days} onChange={e => setFormData({ ...formData, duration_days: e.target.value })}><option value="3">3 {ar ? 'أيام' : 'days'}</option><option value="7">7 {ar ? 'أيام' : 'days'}</option><option value="14">14 {ar ? 'يوماً' : 'days'}</option><option value="30">30 {ar ? 'يوماً' : 'days'}</option></select></label>
            <textarea className="input min-h-20" placeholder={ar ? 'ملاحظة الاستعارة (اختياري)' : 'Checkout note (optional)'} value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })}/>
            <button disabled={busy} type="submit" className="btn-primary w-full"><BookOpen className="h-4 w-4"/>{busy ? (ar ? 'جاري الحفظ…' : 'Saving…') : t.borrowing.submit}</button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><History className="h-5 w-5 text-slate-400"/><h2 className="font-black">{t.borrowing.history}</h2></div><div className="relative w-full sm:w-80"><User className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input className="input ps-9 pe-9" placeholder={ar ? 'طالب، كتاب، باركود أو رقم إيداع…' : 'Student, book, barcode or accession…'} value={searchStudent} onChange={e => setSearchStudent(e.target.value)}/>{searchStudent && <button onClick={() => setSearchStudent('')} className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400"><X className="h-4 w-4"/></button>}</div></div>
        <div className="max-h-[780px] divide-y divide-slate-100 overflow-y-auto">
          {filteredHistory.map(record => {
            const timeLeft = getTimeLeft(record.expected_return_date);
            const overdue = !record.return_date && timeLeft < 0;
            return <div key={record.id} className={`p-5 ${overdue ? 'bg-rose-50/50' : ''}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{record.book_title}</p><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${record.return_date ? 'bg-emerald-50 text-emerald-700' : overdue ? 'bg-rose-600 text-white' : 'bg-blue-50 text-blue-700'}`}>{record.return_date ? (ar ? 'مُعاد' : 'Returned') : overdue ? (ar ? 'متأخر' : 'Overdue') : `${timeLeft} ${ar ? 'يوم' : 'days'}`}</span></div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span className="font-bold text-slate-700">{record.student_name} ({record.student_id})</span>{record.book_copies?.accession_number && <span className="font-mono">#{record.book_copies.accession_number}</span>}{record.book_copies?.barcode && <span className="font-mono">{record.book_copies.barcode}</span>}<span className="flex items-center gap-1"><Calendar className="h-3 w-3"/>{safeFormatDate(record.borrow_date)} → {safeFormatDate(record.expected_return_date)}</span>{record.return_date && <span className="text-emerald-700">{ar ? 'أُعيد' : 'Returned'} {safeFormatDate(record.return_date)}</span>}</div>
                </div>
                {!record.return_date && <button onClick={() => setReturning(record)} className="btn-secondary shrink-0"><RotateCcw className="h-4 w-4"/>{t.borrowing.markReturned}</button>}
              </div>
            </div>;
          })}
          {!filteredHistory.length && <div className="p-12 text-center text-sm text-slate-400"><BookOpen className="mx-auto mb-3 h-10 w-10 opacity-20"/>{ar ? 'لا توجد سجلات.' : 'No records found.'}</div>}
        </div>
      </div>
    </div>

    {returning && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setReturning(null)}><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}><div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-lg font-black">{ar ? 'تأكيد إرجاع النسخة' : 'Return physical copy'}</h2><p className="mt-1 text-sm text-slate-500">{returning.book_title} · {returning.book_copies?.accession_number || `Loan #${returning.id}`}</p></div><button onClick={() => setReturning(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5"/></button></div><div className="space-y-4"><label className="block text-xs font-black uppercase text-slate-500">{ar ? 'حالة النسخة عند الإرجاع' : 'Condition on return'}<select className="input mt-1" value={returnCondition} onChange={e => setReturnCondition(e.target.value)}>{['new','good','fair','poor','damaged'].map(v => <option key={v} value={v}>{v}</option>)}</select></label><textarea className="input min-h-24" placeholder={ar ? 'ملاحظة الإرجاع' : 'Return note'} value={returnNote} onChange={e => setReturnNote(e.target.value)}/><div className="flex gap-3"><button onClick={() => setReturning(null)} className="btn-secondary flex-1">{ar ? 'إلغاء' : 'Cancel'}</button><button disabled={busy} onClick={confirmReturn} className="btn-primary flex-1"><CheckCircle className="h-4 w-4"/>{ar ? 'تأكيد الإرجاع' : 'Confirm return'}</button></div></div></div></div>}
  </div>;
}
