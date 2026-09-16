import React, { useEffect, useState } from 'react';
import { AlertTriangle, Barcode, Boxes, ClipboardCheck, Search, ShieldAlert, Wrench } from 'lucide-react';
import { Language } from '../translations';
import { supabase } from '../services/supabase-client';

type Copy = { id: number; book_id: number; accession_number: string; barcode?: string; status: string; condition: string; branch?: string; room?: string; sector?: string; shelf_number?: string; books?: { title?: string; author?: string } };
type Incident = { id: number; copy_id?: number; incident_type: string; severity: string; status: string; description?: string; estimated_cost: number; reported_at: string; book_id?: number; books?: { title?: string } };
type Audit = { id: number; name: string; sector?: string; status: string; started_at: string; completed_at?: string };

export default function InventoryControlManager({ lang }: { lang: Language }) {
  const ar = lang === 'ar';
  const [copies, setCopies] = useState<Copy[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [incidentForm, setIncidentForm] = useState({ copy_id: '', type: 'damage', student_id: '', description: '', cost: '0', create_fine: false });
  const [auditForm, setAuditForm] = useState({ name: '', sector: '' });

  const load = async () => {
    const [{ data: c }, { data: i }, { data: a }] = await Promise.all([
      supabase.from('book_copies').select('*, books(title,author)').order('created_at', { ascending: false }).limit(1000),
      supabase.from('book_incidents').select('*, books(title)').order('reported_at', { ascending: false }).limit(200),
      supabase.from('inventory_audits').select('*').order('started_at', { ascending: false }).limit(100)
    ]);
    setCopies((c || []) as Copy[]);
    setIncidents((i || []) as Incident[]);
    setAudits((a || []) as Audit[]);
  };

  useEffect(() => { load(); }, []);

  const updateCopy = async (copy: Copy, patch: Record<string, unknown>) => {
    const { error } = await supabase.from('book_copies').update(patch).eq('id', copy.id);
    if (error) return alert(error.message);
    load();
  };

  const openIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.rpc('open_copy_incident', {
      copy_id_in: Number(incidentForm.copy_id),
      incident_type_in: incidentForm.type,
      student_id_in: incidentForm.student_id || null,
      borrowing_id_in: null,
      description_in: incidentForm.description || null,
      estimated_cost_in: Number(incidentForm.cost || 0),
      create_fine_in: incidentForm.create_fine
    });
    if (error) return alert(error.message);
    setIncidentForm({ copy_id: '', type: 'damage', student_id: '', description: '', cost: '0', create_fine: false });
    load();
  };

  const resolveIncident = async (id: number) => {
    const { error } = await supabase.from('book_incidents').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id);
    if (error) return alert(error.message);
    load();
  };

  const startAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: audit, error } = await supabase.from('inventory_audits').insert({ name: auditForm.name, sector: auditForm.sector || null, status: 'open' }).select().single();
    if (error) return alert(error.message);
    const books = new Map<number, { expected: number }>();
    copies.filter(c => !auditForm.sector || c.sector === auditForm.sector).filter(c => c.status !== 'withdrawn').forEach(c => {
      books.set(c.book_id, { expected: (books.get(c.book_id)?.expected || 0) + 1 });
    });
    if (books.size) {
      const payload = Array.from(books.entries()).map(([book_id, value]) => ({ audit_id: audit.id, book_id, expected_quantity: value.expected }));
      const { error: itemError } = await supabase.from('inventory_audit_items').insert(payload);
      if (itemError) alert(itemError.message);
    }
    setAuditForm({ name: '', sector: '' });
    load();
  };

  const finishAudit = async (id: number) => {
    const { error } = await supabase.from('inventory_audits').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
    if (error) return alert(error.message);
    load();
  };

  const filtered = copies.filter(copy => {
    const q = search.toLowerCase();
    const matches = !q || copy.accession_number.toLowerCase().includes(q) || (copy.barcode || '').toLowerCase().includes(q) || (copy.books?.title || '').toLowerCase().includes(q) || (copy.books?.author || '').toLowerCase().includes(q);
    return matches && (statusFilter === 'all' || copy.status === statusFilter);
  });

  const counts = {
    total: copies.length,
    available: copies.filter(c => c.status === 'available').length,
    loaned: copies.filter(c => c.status === 'loaned').length,
    problems: copies.filter(c => ['lost','damaged','repair'].includes(c.status)).length
  };

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-black">{ar ? 'التحكم في النسخ والجرد' : 'Copy Control & Stocktake'}</h1><p className="text-sm text-slate-500">{ar ? 'تتبع كل نسخة فعلية بالباركود ورقم الإيداع والحالة والموقع.' : 'Track every physical copy by accession, barcode, condition, status and location.'}</p></div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[{ label: ar ? 'إجمالي النسخ' : 'Tracked copies', value: counts.total, icon: Boxes }, { label: ar ? 'متاحة' : 'Available', value: counts.available, icon: ClipboardCheck }, { label: ar ? 'معارة' : 'On loan', value: counts.loaned, icon: Barcode }, { label: ar ? 'مشاكل' : 'Problems', value: counts.problems, icon: ShieldAlert }].map(card => <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4"><card.icon className="mb-3 h-5 w-5 text-blue-600"/><p className="text-xs font-bold uppercase text-slate-500">{card.label}</p><p className="mt-1 text-2xl font-black">{card.value}</p></div>)}
    </div>

    <div className="grid gap-6 2xl:grid-cols-[1fr_360px]">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row">
          <div className="relative flex-1"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input className="input ps-9" placeholder={ar ? 'بحث بالعنوان أو الباركود أو رقم الإيداع' : 'Search title, barcode or accession'} value={search} onChange={e => setSearch(e.target.value)}/></div>
          <select className="input md:w-48" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">{ar ? 'كل الحالات' : 'All statuses'}</option>{['available','loaned','reserved','lost','damaged','repair','reference','withdrawn'].map(s => <option key={s} value={s}>{s}</option>)}</select>
        </div>
        <div className="max-h-[680px] overflow-auto">
          <table className="w-full min-w-[850px] text-sm"><thead className="sticky top-0 bg-slate-50 text-start text-xs uppercase text-slate-500"><tr><th className="p-3 text-start">{ar ? 'الكتاب' : 'Book'}</th><th className="p-3 text-start">{ar ? 'رقم الإيداع' : 'Accession'}</th><th className="p-3 text-start">Barcode</th><th className="p-3 text-start">{ar ? 'الموقع' : 'Location'}</th><th className="p-3 text-start">{ar ? 'الحالة' : 'Status'}</th><th className="p-3 text-start">{ar ? 'الهيئة' : 'Condition'}</th></tr></thead>
          <tbody>{filtered.map(copy => <tr key={copy.id} className="border-t border-slate-100"><td className="p-3"><p className="font-bold">{copy.books?.title || `Book #${copy.book_id}`}</p><p className="text-xs text-slate-400">{copy.books?.author || '—'}</p></td><td className="p-3 font-mono text-xs">{copy.accession_number}</td><td className="p-3 font-mono text-xs">{copy.barcode || '—'}</td><td className="p-3 text-xs">{[copy.branch, copy.room, copy.sector, copy.shelf_number].filter(Boolean).join(' / ') || '—'}</td><td className="p-3"><select className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={copy.status} onChange={e => updateCopy(copy, { status: e.target.value })}>{['available','loaned','reserved','lost','damaged','repair','reference','withdrawn'].map(s => <option key={s}>{s}</option>)}</select></td><td className="p-3"><select className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={copy.condition} onChange={e => updateCopy(copy, { condition: e.target.value })}>{['new','good','fair','poor','damaged'].map(s => <option key={s}>{s}</option>)}</select></td></tr>)}</tbody></table>
        </div>
      </div>

      <div className="space-y-6">
        <form onSubmit={openIncident} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500"/><h2 className="font-black">{ar ? 'فتح بلاغ نسخة' : 'Open copy incident'}</h2></div>
          <div className="space-y-3"><select required className="input" value={incidentForm.copy_id} onChange={e => setIncidentForm({ ...incidentForm, copy_id: e.target.value })}><option value="">{ar ? 'اختر النسخة' : 'Select copy'}</option>{copies.slice(0, 500).map(c => <option key={c.id} value={c.id}>{c.accession_number} — {c.books?.title || c.book_id}</option>)}</select><select className="input" value={incidentForm.type} onChange={e => setIncidentForm({ ...incidentForm, type: e.target.value })}>{['lost','damage','repair','missing_inventory','other'].map(s => <option key={s}>{s}</option>)}</select><input className="input" placeholder={ar ? 'رقم الطالب (اختياري)' : 'Student ID (optional)'} value={incidentForm.student_id} onChange={e => setIncidentForm({ ...incidentForm, student_id: e.target.value })}/><textarea className="input min-h-20" placeholder={ar ? 'وصف البلاغ' : 'Incident description'} value={incidentForm.description} onChange={e => setIncidentForm({ ...incidentForm, description: e.target.value })}/><input type="number" min="0" step="0.01" className="input" placeholder={ar ? 'التكلفة التقديرية' : 'Estimated cost'} value={incidentForm.cost} onChange={e => setIncidentForm({ ...incidentForm, cost: e.target.value })}/><label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={incidentForm.create_fine} onChange={e => setIncidentForm({ ...incidentForm, create_fine: e.target.checked })}/>{ar ? 'إنشاء غرامة للطالب' : 'Create matching student fine'}</label><button className="btn-primary w-full"><Wrench className="h-4 w-4"/>{ar ? 'فتح البلاغ' : 'Open incident'}</button></div>
        </form>

        <form onSubmit={startAudit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-blue-600"/><h2 className="font-black">{ar ? 'جرد جديد' : 'Start stocktake'}</h2></div><div className="space-y-3"><input required className="input" placeholder={ar ? 'اسم جلسة الجرد' : 'Audit name'} value={auditForm.name} onChange={e => setAuditForm({ ...auditForm, name: e.target.value })}/><input className="input" placeholder={ar ? 'القطاع (اختياري)' : 'Sector (optional)'} value={auditForm.sector} onChange={e => setAuditForm({ ...auditForm, sector: e.target.value })}/><button className="btn-secondary w-full">{ar ? 'بدء الجرد' : 'Start audit'}</button></div></form>
      </div>
    </div>

    <div className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 font-black">{ar ? 'البلاغات المفتوحة' : 'Open incidents'}</h2><div className="space-y-3">{incidents.filter(i => !['resolved','written_off'].includes(i.status)).slice(0, 12).map(i => <div key={i.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-bold">{i.books?.title || `Book #${i.book_id || '—'}`}</p><p className="text-xs text-slate-500">{i.incident_type} · {i.severity} · {i.status}</p></div><button onClick={() => resolveIncident(i.id)} className="btn-secondary">{ar ? 'حل' : 'Resolve'}</button></div>{i.description && <p className="mt-2 text-xs text-slate-600">{i.description}</p>}</div>)}{!incidents.length && <p className="text-sm text-slate-400">{ar ? 'لا توجد بلاغات.' : 'No incidents.'}</p>}</div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 font-black">{ar ? 'جلسات الجرد' : 'Stocktake sessions'}</h2><div className="space-y-3">{audits.slice(0, 12).map(a => <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"><div><p className="font-bold">{a.name}</p><p className="text-xs text-slate-500">{a.sector || (ar ? 'كل القطاعات' : 'All sectors')} · {a.status}</p></div>{a.status === 'open' && <button onClick={() => finishAudit(a.id)} className="btn-secondary">{ar ? 'إنهاء' : 'Complete'}</button>}</div>)}</div></div>
    </div>
  </div>;
}
