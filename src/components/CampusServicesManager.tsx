import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, Building2, DoorOpen, FilePlus2, GraduationCap, Link2, Plus } from 'lucide-react';
import { Language } from '../translations';
import { supabase } from '../services/supabase-client';

type Branch = { id: number; code: string; name: string; address?: string; phone?: string; is_active: boolean };
type Space = { id: number; branch_id?: number; name: string; space_type: string; capacity: number; floor?: string; zone?: string; requires_approval: boolean; is_active: boolean };
type Resource = { id: number; title: string; author?: string; resource_type: string; url: string; provider?: string; subject?: string; access_level: string; is_active: boolean };
type Request = { id: number; student_id?: string; requester_name?: string; title: string; author?: string; resource_type: string; reason?: string; status: string; created_at: string };
type Transfer = { id: number; copy_id: number; from_branch_id?: number; to_branch_id: number; status: string; requested_at: string; book_copies?: { accession_number?: string; books?: { title?: string } } };
type Copy = { id: number; accession_number: string; branch_id?: number; books?: { title?: string } };

export default function CampusServicesManager({ lang }: { lang: Language }) {
  const ar = lang === 'ar';
  const [branches, setBranches] = useState<Branch[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [copies, setCopies] = useState<Copy[]>([]);
  const [branchForm, setBranchForm] = useState({ code: '', name: '', address: '', phone: '' });
  const [spaceForm, setSpaceForm] = useState({ branch_id: '', name: '', space_type: 'seat', capacity: '1', floor: '', zone: '', requires_approval: false });
  const [resourceForm, setResourceForm] = useState({ title: '', author: '', resource_type: 'ebook', url: '', provider: '', subject: '', access_level: 'campus' });
  const [transferForm, setTransferForm] = useState({ copy_id: '', to_branch_id: '', notes: '' });

  const load = async () => {
    const [{ data: b }, { data: s }, { data: r }, { data: aq }, { data: tr }, { data: c }] = await Promise.all([
      supabase.from('library_branches').select('*').order('name'),
      supabase.from('study_spaces').select('*').order('name'),
      supabase.from('digital_resources').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('acquisition_requests').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('branch_transfers').select('*, book_copies(accession_number, books(title))').order('requested_at', { ascending: false }).limit(200),
      supabase.from('book_copies').select('id,accession_number,branch_id,books(title)').order('accession_number').limit(1500)
    ]);
    setBranches((b || []) as Branch[]);
    setSpaces((s || []) as Space[]);
    setResources((r || []) as Resource[]);
    setRequests((aq || []) as Request[]);
    setTransfers((tr || []) as Transfer[]);
    setCopies((c || []) as Copy[]);
  };

  useEffect(() => { load(); }, []);

  const addBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('library_branches').insert({ ...branchForm, is_active: true });
    if (error) return alert(error.message);
    setBranchForm({ code: '', name: '', address: '', phone: '' });
    load();
  };

  const addSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('study_spaces').insert({
      branch_id: spaceForm.branch_id ? Number(spaceForm.branch_id) : null,
      name: spaceForm.name,
      space_type: spaceForm.space_type,
      capacity: Number(spaceForm.capacity),
      floor: spaceForm.floor || null,
      zone: spaceForm.zone || null,
      requires_approval: spaceForm.requires_approval,
      is_active: true
    });
    if (error) return alert(error.message);
    setSpaceForm({ branch_id: '', name: '', space_type: 'seat', capacity: '1', floor: '', zone: '', requires_approval: false });
    load();
  };

  const addResource = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('digital_resources').insert({ ...resourceForm, is_active: true });
    if (error) return alert(error.message);
    setResourceForm({ title: '', author: '', resource_type: 'ebook', url: '', provider: '', subject: '', access_level: 'campus' });
    load();
  };

  const createTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const copy = copies.find(c => String(c.id) === transferForm.copy_id);
    const { error } = await supabase.from('branch_transfers').insert({
      copy_id: Number(transferForm.copy_id),
      from_branch_id: copy?.branch_id || null,
      to_branch_id: Number(transferForm.to_branch_id),
      status: 'requested',
      notes: transferForm.notes || null
    });
    if (error) return alert(error.message);
    setTransferForm({ copy_id: '', to_branch_id: '', notes: '' });
    load();
  };

  const advanceTransfer = async (id: number, status: string) => {
    const { error } = await supabase.rpc('advance_branch_transfer', { transfer_id_in: id, next_status_in: status });
    if (error) return alert(error.message);
    load();
  };

  const reviewRequest = async (id: number, status: string) => {
    const { error } = await supabase.from('acquisition_requests').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id);
    if (error) return alert(error.message);
    load();
  };

  const branchName = (id?: number) => branches.find(b => b.id === id)?.name || '—';

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-black">{ar ? 'خدمات الحرم والفروع' : 'Campus & Branch Services'}</h1><p className="text-sm text-slate-500">{ar ? 'إدارة الفروع والمساحات الدراسية والتحويلات والموارد الرقمية وطلبات الشراء.' : 'Manage branches, study spaces, copy transfers, digital resources and acquisition suggestions.'}</p></div>

    <div className="grid gap-6 xl:grid-cols-2">
      <form onSubmit={addBranch} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Building2 className="h-5 w-5 text-blue-600"/><h2 className="font-black">{ar ? 'إضافة فرع' : 'Add branch'}</h2></div><div className="grid gap-3 sm:grid-cols-2"><input required className="input" placeholder={ar ? 'كود الفرع' : 'Branch code'} value={branchForm.code} onChange={e => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}/><input required className="input" placeholder={ar ? 'اسم الفرع' : 'Branch name'} value={branchForm.name} onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}/><input className="input" placeholder={ar ? 'العنوان' : 'Address'} value={branchForm.address} onChange={e => setBranchForm({ ...branchForm, address: e.target.value })}/><input className="input" placeholder={ar ? 'الهاتف' : 'Phone'} value={branchForm.phone} onChange={e => setBranchForm({ ...branchForm, phone: e.target.value })}/><button className="btn-primary sm:col-span-2"><Plus className="h-4 w-4"/>{ar ? 'إضافة الفرع' : 'Add branch'}</button></div></form>

      <form onSubmit={addSpace} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><DoorOpen className="h-5 w-5 text-blue-600"/><h2 className="font-black">{ar ? 'إضافة مساحة دراسة' : 'Add study space'}</h2></div><div className="grid gap-3 sm:grid-cols-2"><select className="input" value={spaceForm.branch_id} onChange={e => setSpaceForm({ ...spaceForm, branch_id: e.target.value })}><option value="">{ar ? 'اختر الفرع' : 'Select branch'}</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select><input required className="input" placeholder={ar ? 'اسم المساحة' : 'Space name'} value={spaceForm.name} onChange={e => setSpaceForm({ ...spaceForm, name: e.target.value })}/><select className="input" value={spaceForm.space_type} onChange={e => setSpaceForm({ ...spaceForm, space_type: e.target.value })}>{['seat','desk','group_room','quiet_room','lab','meeting_room'].map(x => <option key={x}>{x}</option>)}</select><input type="number" min="1" className="input" placeholder={ar ? 'السعة' : 'Capacity'} value={spaceForm.capacity} onChange={e => setSpaceForm({ ...spaceForm, capacity: e.target.value })}/><input className="input" placeholder={ar ? 'الدور' : 'Floor'} value={spaceForm.floor} onChange={e => setSpaceForm({ ...spaceForm, floor: e.target.value })}/><input className="input" placeholder={ar ? 'المنطقة' : 'Zone'} value={spaceForm.zone} onChange={e => setSpaceForm({ ...spaceForm, zone: e.target.value })}/><label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={spaceForm.requires_approval} onChange={e => setSpaceForm({ ...spaceForm, requires_approval: e.target.checked })}/>{ar ? 'يتطلب موافقة' : 'Requires approval'}</label><button className="btn-primary"><Plus className="h-4 w-4"/>{ar ? 'إضافة' : 'Add space'}</button></div></form>
    </div>

    <div className="grid gap-6 xl:grid-cols-2">
      <form onSubmit={addResource} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Link2 className="h-5 w-5 text-violet-600"/><h2 className="font-black">{ar ? 'مورد رقمي جديد' : 'Add digital resource'}</h2></div><div className="grid gap-3 sm:grid-cols-2"><input required className="input" placeholder={ar ? 'العنوان' : 'Title'} value={resourceForm.title} onChange={e => setResourceForm({ ...resourceForm, title: e.target.value })}/><input className="input" placeholder={ar ? 'المؤلف' : 'Author'} value={resourceForm.author} onChange={e => setResourceForm({ ...resourceForm, author: e.target.value })}/><select className="input" value={resourceForm.resource_type} onChange={e => setResourceForm({ ...resourceForm, resource_type: e.target.value })}>{['ebook','journal','database','thesis','article','video','website','other'].map(x => <option key={x}>{x}</option>)}</select><select className="input" value={resourceForm.access_level} onChange={e => setResourceForm({ ...resourceForm, access_level: e.target.value })}>{['public','student','campus','staff'].map(x => <option key={x}>{x}</option>)}</select><input required className="input sm:col-span-2" type="url" placeholder="https://..." value={resourceForm.url} onChange={e => setResourceForm({ ...resourceForm, url: e.target.value })}/><input className="input" placeholder={ar ? 'المزود' : 'Provider'} value={resourceForm.provider} onChange={e => setResourceForm({ ...resourceForm, provider: e.target.value })}/><input className="input" placeholder={ar ? 'الموضوع' : 'Subject'} value={resourceForm.subject} onChange={e => setResourceForm({ ...resourceForm, subject: e.target.value })}/><button className="btn-secondary sm:col-span-2"><FilePlus2 className="h-4 w-4"/>{ar ? 'حفظ المورد' : 'Save resource'}</button></div></form>

      <form onSubmit={createTransfer} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-blue-600"/><h2 className="font-black">{ar ? 'تحويل نسخة بين الفروع' : 'Transfer copy between branches'}</h2></div><div className="space-y-3"><select required className="input" value={transferForm.copy_id} onChange={e => setTransferForm({ ...transferForm, copy_id: e.target.value })}><option value="">{ar ? 'اختر النسخة' : 'Select copy'}</option>{copies.map(c => <option key={c.id} value={c.id}>{c.accession_number} — {c.books?.title || c.id}</option>)}</select><select required className="input" value={transferForm.to_branch_id} onChange={e => setTransferForm({ ...transferForm, to_branch_id: e.target.value })}><option value="">{ar ? 'الفرع المستلم' : 'Destination branch'}</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select><textarea className="input min-h-20" placeholder={ar ? 'ملاحظات التحويل' : 'Transfer notes'} value={transferForm.notes} onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })}/><button className="btn-primary w-full"><ArrowRightLeft className="h-4 w-4"/>{ar ? 'طلب التحويل' : 'Request transfer'}</button></div></form>
    </div>

    <div className="grid gap-6 2xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-black">{ar ? 'طلبات اقتناء الطلاب' : 'Student acquisition requests'}</h2></div><div className="divide-y divide-slate-100">{requests.slice(0, 100).map(req => <div key={req.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-violet-500"/><p className="font-bold">{req.title}</p></div><p className="mt-1 text-xs text-slate-500">{req.author || '—'} · {req.resource_type} · {req.requester_name || req.student_id || '—'}</p>{req.reason && <p className="mt-2 text-xs text-slate-600">{req.reason}</p>}</div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">{req.status}</span>{['submitted','reviewing'].includes(req.status) && <><button onClick={() => reviewRequest(req.id, 'approved')} className="btn-secondary">{ar ? 'اعتماد' : 'Approve'}</button><button onClick={() => reviewRequest(req.id, 'rejected')} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">{ar ? 'رفض' : 'Reject'}</button></>}</div></div>)}{!requests.length && <p className="p-8 text-center text-sm text-slate-400">{ar ? 'لا توجد طلبات.' : 'No requests.'}</p>}</div></div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-black">{ar ? 'تحويلات الفروع' : 'Branch transfers'}</h2></div><div className="divide-y divide-slate-100">{transfers.slice(0, 100).map(tr => <div key={tr.id} className="p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-bold">{tr.book_copies?.books?.title || `Copy #${tr.copy_id}`}</p><p className="font-mono text-[10px] text-slate-400">{tr.book_copies?.accession_number || '—'}</p><p className="mt-1 text-xs text-slate-500">{branchName(tr.from_branch_id)} → {branchName(tr.to_branch_id)}</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">{tr.status}</span>{tr.status === 'requested' && <button onClick={() => advanceTransfer(tr.id, 'approved')} className="btn-secondary">{ar ? 'اعتماد' : 'Approve'}</button>}{['requested','approved'].includes(tr.status) && <button onClick={() => advanceTransfer(tr.id, 'in_transit')} className="btn-secondary">{ar ? 'شحن' : 'In transit'}</button>}{tr.status === 'in_transit' && <button onClick={() => advanceTransfer(tr.id, 'received')} className="btn-primary">{ar ? 'استلام' : 'Receive'}</button>}</div></div></div>)}{!transfers.length && <p className="p-8 text-center text-sm text-slate-400">{ar ? 'لا توجد تحويلات.' : 'No transfers.'}</p>}</div></div>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{resources.slice(0, 30).map(resource => <div key={resource.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{resource.title}</p><p className="text-xs text-slate-500">{resource.author || resource.provider || '—'} · {resource.resource_type}</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black uppercase text-blue-700">{resource.access_level}</span></div><a className="mt-3 inline-flex items-center gap-1 text-xs font-black text-blue-600" href={resource.url} target="_blank" rel="noreferrer"><Link2 className="h-3 w-3"/>{ar ? 'فتح المورد' : 'Open resource'}</a></div>)}</div>
  </div>;
}
