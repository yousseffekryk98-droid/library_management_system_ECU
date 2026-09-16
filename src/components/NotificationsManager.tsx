import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, Mail, MessageSquareText, Plus, RefreshCcw, Send } from 'lucide-react';
import { Language } from '../translations';
import { supabase } from '../services/supabase-client';

type Template = { id: number; code: string; name: string; channel: string; language: string; subject_template?: string; body_template: string; is_active: boolean };
type Notice = { id: number; student_id?: string; channel: string; type: string; title: string; body: string; status: string; scheduled_for?: string; sent_at?: string; created_at: string };

type Student = { student_id: string; student_name: string; email?: string; phone?: string };

export default function NotificationsManager({ lang }: { lang: Language }) {
  const ar = lang === 'ar';
  const [templates, setTemplates] = useState<Template[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState({ student_id: '', template_id: '', channel: 'email', title: '', body: '', scheduled_for: '' });
  const [templateForm, setTemplateForm] = useState({ code: '', name: '', channel: 'email', language: 'en', subject_template: '', body_template: '' });

  const load = async () => {
    const [{ data: t }, { data: n }, { data: s }] = await Promise.all([
      supabase.from('notice_templates').select('*').order('name'),
      supabase.from('library_notices').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('students').select('student_id,student_name,email,phone').order('student_name').limit(1000)
    ]);
    setTemplates((t || []) as Template[]);
    setNotices((n || []) as Notice[]);
    setStudents((s || []) as Student[]);
  };

  useEffect(() => { load(); }, []);

  const applyTemplate = (id: string) => {
    const template = templates.find(t => String(t.id) === id);
    setForm({
      ...form,
      template_id: id,
      channel: template?.channel || form.channel,
      title: template?.subject_template || template?.name || '',
      body: template?.body_template || ''
    });
  };

  const queueNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('library_notices').insert({
      student_id: form.student_id || null,
      channel: form.channel,
      type: templates.find(t => String(t.id) === form.template_id)?.code || 'manual',
      title: form.title,
      body: form.body,
      status: 'pending',
      scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null
    });
    if (error) return alert(error.message);
    setForm({ student_id: '', template_id: '', channel: 'email', title: '', body: '', scheduled_for: '' });
    load();
  };

  const addTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('notice_templates').insert({ ...templateForm, is_active: true });
    if (error) return alert(error.message);
    setTemplateForm({ code: '', name: '', channel: 'email', language: 'en', subject_template: '', body_template: '' });
    load();
  };

  const markStatus = async (id: number, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === 'sent') patch.sent_at = new Date().toISOString();
    const { error } = await supabase.from('library_notices').update(patch).eq('id', id);
    if (error) return alert(error.message);
    load();
  };

  const pending = notices.filter(n => n.status === 'pending').length;
  const failed = notices.filter(n => n.status === 'failed').length;
  const sent = notices.filter(n => ['sent','read'].includes(n.status)).length;

  return <div className="space-y-6">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-black">{ar ? 'مركز الإشعارات' : 'Notification Center'}</h1><p className="text-sm text-slate-500">{ar ? 'قوالب وإشعارات الاستحقاق والتأخير والحجوزات وقائمة الإرسال.' : 'Templates and delivery queue for due dates, overdue loans, reservations and manual notices.'}</p></div><button onClick={load} className="btn-secondary"><RefreshCcw className="h-4 w-4"/>{ar ? 'تحديث' : 'Refresh'}</button></div>

    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-amber-50 p-4"><Bell className="mb-3 h-5 w-5 text-amber-600"/><p className="text-xs font-bold uppercase text-amber-700">{ar ? 'قيد الانتظار' : 'Pending'}</p><p className="text-2xl font-black text-amber-950">{pending}</p></div><div className="rounded-2xl bg-emerald-50 p-4"><CheckCheck className="mb-3 h-5 w-5 text-emerald-600"/><p className="text-xs font-bold uppercase text-emerald-700">{ar ? 'مرسل' : 'Sent / read'}</p><p className="text-2xl font-black text-emerald-950">{sent}</p></div><div className="rounded-2xl bg-rose-50 p-4"><MessageSquareText className="mb-3 h-5 w-5 text-rose-600"/><p className="text-xs font-bold uppercase text-rose-700">{ar ? 'فشل' : 'Failed'}</p><p className="text-2xl font-black text-rose-950">{failed}</p></div></div>

    <div className="grid gap-6 xl:grid-cols-2">
      <form onSubmit={queueNotice} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Send className="h-5 w-5 text-blue-600"/><h2 className="font-black">{ar ? 'إضافة إلى قائمة الإرسال' : 'Queue a notice'}</h2></div><div className="space-y-3"><select className="input" value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}><option value="">{ar ? 'إشعار عام / بدون طالب محدد' : 'General / no specific student'}</option>{students.map(s => <option key={s.student_id} value={s.student_id}>{s.student_name} ({s.student_id})</option>)}</select><select className="input" value={form.template_id} onChange={e => applyTemplate(e.target.value)}><option value="">{ar ? 'بدون قالب' : 'No template'}</option>{templates.filter(t => t.is_active).map(t => <option key={t.id} value={t.id}>{t.name} · {t.language}</option>)}</select><select className="input" value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}>{['in_app','email','sms','whatsapp'].map(c => <option key={c}>{c}</option>)}</select><input required className="input" placeholder={ar ? 'العنوان' : 'Title'} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/><textarea required className="input min-h-28" placeholder={ar ? 'نص الرسالة' : 'Message'} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}/><input type="datetime-local" className="input" value={form.scheduled_for} onChange={e => setForm({ ...form, scheduled_for: e.target.value })}/><button className="btn-primary w-full"><Send className="h-4 w-4"/>{ar ? 'إضافة للقائمة' : 'Queue notice'}</button></div></form>

      <form onSubmit={addTemplate} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Mail className="h-5 w-5 text-blue-600"/><h2 className="font-black">{ar ? 'قالب جديد' : 'New template'}</h2></div><div className="grid gap-3 sm:grid-cols-2"><input required className="input" placeholder="code_example" value={templateForm.code} onChange={e => setTemplateForm({ ...templateForm, code: e.target.value })}/><input required className="input" placeholder={ar ? 'اسم القالب' : 'Template name'} value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}/><select className="input" value={templateForm.channel} onChange={e => setTemplateForm({ ...templateForm, channel: e.target.value })}>{['in_app','email','sms','whatsapp'].map(c => <option key={c}>{c}</option>)}</select><select className="input" value={templateForm.language} onChange={e => setTemplateForm({ ...templateForm, language: e.target.value })}><option value="en">English</option><option value="ar">العربية</option></select><input className="input sm:col-span-2" placeholder={ar ? 'عنوان الرسالة' : 'Subject template'} value={templateForm.subject_template} onChange={e => setTemplateForm({ ...templateForm, subject_template: e.target.value })}/><textarea required className="input min-h-28 sm:col-span-2" placeholder={ar ? 'نص القالب' : 'Body template'} value={templateForm.body_template} onChange={e => setTemplateForm({ ...templateForm, body_template: e.target.value })}/><button className="btn-secondary sm:col-span-2"><Plus className="h-4 w-4"/>{ar ? 'حفظ القالب' : 'Save template'}</button></div></form>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-black">{ar ? 'قائمة الإرسال' : 'Delivery queue'}</h2><p className="text-xs text-slate-500">{ar ? 'يمكن ربط هذه القائمة لاحقاً بمزود بريد أو SMS أو WhatsApp.' : 'This queue can be connected later to an email, SMS or WhatsApp delivery provider.'}</p></div><div className="divide-y divide-slate-100">{notices.slice(0, 100).map(n => <div key={n.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{n.title}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">{n.channel}</span><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${n.status === 'sent' || n.status === 'read' ? 'bg-emerald-50 text-emerald-700' : n.status === 'failed' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{n.status}</span></div><p className="mt-1 line-clamp-2 text-xs text-slate-500">{n.body}</p><p className="mt-1 text-[10px] text-slate-400">{n.student_id || (ar ? 'عام' : 'General')} · {new Date(n.created_at).toLocaleString()}</p></div><div className="flex gap-2">{n.status === 'pending' && <><button onClick={() => markStatus(n.id, 'sent')} className="btn-secondary"><CheckCheck className="h-4 w-4"/>{ar ? 'تم الإرسال' : 'Mark sent'}</button><button onClick={() => markStatus(n.id, 'failed')} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">{ar ? 'فشل' : 'Failed'}</button></>}</div></div>)}{!notices.length && <p className="p-10 text-center text-sm text-slate-400">{ar ? 'لا توجد إشعارات في القائمة.' : 'The queue is empty.'}</p>}</div></div>
  </div>;
}
