import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, PackageCheck, Plus, ShoppingCart, Truck } from 'lucide-react';
import { Language } from '../translations';
import { supabase } from '../services/supabase-client';

type Vendor = { id: number; name: string; contact_name?: string; email?: string; phone?: string; is_active: boolean };
type PO = { id: number; po_number: string; vendor_id?: number; status: string; order_date?: string; expected_date?: string; currency: string; shipping_amount: number; notes?: string };
type POItem = { id: number; purchase_order_id: number; title: string; author?: string; isbn?: string; quantity: number; received_quantity: number; unit_price: number };

export default function AcquisitionsManager({ lang }: { lang: Language }) {
  const ar = lang === 'ar';
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orders, setOrders] = useState<PO[]>([]);
  const [items, setItems] = useState<POItem[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [vendorForm, setVendorForm] = useState({ name: '', contact_name: '', email: '', phone: '' });
  const [poForm, setPoForm] = useState({ po_number: '', vendor_id: '', expected_date: '', notes: '' });
  const [itemForm, setItemForm] = useState({ title: '', author: '', isbn: '', quantity: '1', unit_price: '0' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: v }, { data: p }, { data: i }] = await Promise.all([
      supabase.from('vendors').select('*').order('name'),
      supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('purchase_order_items').select('*').order('created_at', { ascending: false })
    ]);
    setVendors((v || []) as Vendor[]);
    setOrders((p || []) as PO[]);
    setItems((i || []) as POItem[]);
    if (!selectedOrder && p?.length) setSelectedOrder(p[0].id);
  };

  useEffect(() => { load(); }, []);

  const addVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('vendors').insert({ ...vendorForm, is_active: true });
    setBusy(false);
    if (error) return alert(error.message);
    setVendorForm({ name: '', contact_name: '', email: '', phone: '' });
    load();
  };

  const createPO = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.from('purchase_orders').insert({
      po_number: poForm.po_number,
      vendor_id: poForm.vendor_id ? Number(poForm.vendor_id) : null,
      status: 'draft',
      order_date: new Date().toISOString().slice(0, 10),
      expected_date: poForm.expected_date || null,
      currency: 'EGP',
      notes: poForm.notes || null
    }).select().single();
    setBusy(false);
    if (error) return alert(error.message);
    setPoForm({ po_number: '', vendor_id: '', expected_date: '', notes: '' });
    setSelectedOrder(data.id);
    load();
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setBusy(true);
    const { error } = await supabase.from('purchase_order_items').insert({
      purchase_order_id: selectedOrder,
      title: itemForm.title,
      author: itemForm.author || null,
      isbn: itemForm.isbn || null,
      quantity: Number(itemForm.quantity),
      unit_price: Number(itemForm.unit_price)
    });
    setBusy(false);
    if (error) return alert(error.message);
    setItemForm({ title: '', author: '', isbn: '', quantity: '1', unit_price: '0' });
    load();
  };

  const setOrderStatus = async (id: number, status: string) => {
    const { error } = await supabase.from('purchase_orders').update({ status }).eq('id', id);
    if (error) return alert(error.message);
    load();
  };

  const receiveOne = async (item: POItem) => {
    if (item.received_quantity >= item.quantity) return;
    const { error } = await supabase.rpc('receive_purchase_order_item', { item_id_in: item.id, qty_in: 1 });
    if (error) return alert(error.message);
    load();
  };

  const selected = orders.find(o => o.id === selectedOrder);
  const selectedItems = items.filter(i => i.purchase_order_id === selectedOrder);
  const selectedTotal = selectedItems.reduce((sum, i) => sum + Number(i.unit_price || 0) * Number(i.quantity || 0), 0) + Number(selected?.shipping_amount || 0);

  return <div className="space-y-6">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-black text-slate-900">{ar ? 'المشتريات والموردون' : 'Acquisitions & Vendors'}</h1><p className="text-sm text-slate-500">{ar ? 'طلبات شراء واستلام نسخ جديدة وتتبع الموردين.' : 'Purchase orders, receiving, vendor records and new-copy intake.'}</p></div>
      <div className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">{orders.length} {ar ? 'طلب شراء' : 'purchase orders'}</div>
    </div>

    <div className="grid gap-6 xl:grid-cols-3">
      <form onSubmit={addVendor} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2"><Building2 className="h-5 w-5 text-blue-600"/><h2 className="font-black">{ar ? 'مورد جديد' : 'New vendor'}</h2></div>
        <div className="space-y-3">
          <input required placeholder={ar ? 'اسم المورد' : 'Vendor name'} className="input" value={vendorForm.name} onChange={e => setVendorForm({ ...vendorForm, name: e.target.value })}/>
          <input placeholder={ar ? 'اسم جهة الاتصال' : 'Contact person'} className="input" value={vendorForm.contact_name} onChange={e => setVendorForm({ ...vendorForm, contact_name: e.target.value })}/>
          <input placeholder="Email" className="input" value={vendorForm.email} onChange={e => setVendorForm({ ...vendorForm, email: e.target.value })}/>
          <input placeholder={ar ? 'الهاتف' : 'Phone'} className="input" value={vendorForm.phone} onChange={e => setVendorForm({ ...vendorForm, phone: e.target.value })}/>
          <button disabled={busy} className="btn-primary w-full"><Plus className="h-4 w-4"/>{ar ? 'إضافة المورد' : 'Add vendor'}</button>
        </div>
      </form>

      <form onSubmit={createPO} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
        <div className="mb-4 flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-blue-600"/><h2 className="font-black">{ar ? 'إنشاء طلب شراء' : 'Create purchase order'}</h2></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input required placeholder="PO-2026-001" className="input" value={poForm.po_number} onChange={e => setPoForm({ ...poForm, po_number: e.target.value })}/>
          <select className="input" value={poForm.vendor_id} onChange={e => setPoForm({ ...poForm, vendor_id: e.target.value })}><option value="">{ar ? 'اختر المورد' : 'Select vendor'}</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
          <input type="date" className="input" value={poForm.expected_date} onChange={e => setPoForm({ ...poForm, expected_date: e.target.value })}/>
          <input placeholder={ar ? 'ملاحظات' : 'Notes'} className="input" value={poForm.notes} onChange={e => setPoForm({ ...poForm, notes: e.target.value })}/>
        </div>
        <button disabled={busy} className="btn-primary mt-3"><Plus className="h-4 w-4"/>{ar ? 'إنشاء الطلب' : 'Create order'}</button>
      </form>
    </div>

    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <div className="space-y-3">
        {orders.map(order => <button key={order.id} onClick={() => setSelectedOrder(order.id)} className={`w-full rounded-2xl border p-4 text-start transition ${selectedOrder === order.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
          <div className="flex items-center justify-between gap-3"><span className="font-black">{order.po_number}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">{order.status}</span></div>
          <p className="mt-2 text-xs text-slate-500">{vendors.find(v => v.id === order.vendor_id)?.name || (ar ? 'بدون مورد' : 'No vendor')}</p>
        </button>)}
      </div>

      {selected ? <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-black">{selected.po_number}</h2><p className="text-xs text-slate-500">{ar ? 'الإجمالي' : 'Total'}: {selectedTotal.toLocaleString()} EGP</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={() => setOrderStatus(selected.id, 'approved')} className="btn-secondary"><CheckCircle2 className="h-4 w-4"/>{ar ? 'اعتماد' : 'Approve'}</button><button onClick={() => setOrderStatus(selected.id, 'ordered')} className="btn-secondary"><Truck className="h-4 w-4"/>{ar ? 'تم الطلب' : 'Mark ordered'}</button></div>
        </div>
        <form onSubmit={addItem} className="grid gap-3 border-b border-slate-100 p-5 md:grid-cols-5">
          <input required placeholder={ar ? 'عنوان الكتاب' : 'Book title'} className="input md:col-span-2" value={itemForm.title} onChange={e => setItemForm({ ...itemForm, title: e.target.value })}/>
          <input placeholder={ar ? 'المؤلف' : 'Author'} className="input" value={itemForm.author} onChange={e => setItemForm({ ...itemForm, author: e.target.value })}/>
          <input type="number" min="1" placeholder={ar ? 'الكمية' : 'Qty'} className="input" value={itemForm.quantity} onChange={e => setItemForm({ ...itemForm, quantity: e.target.value })}/>
          <input type="number" min="0" step="0.01" placeholder={ar ? 'السعر' : 'Unit price'} className="input" value={itemForm.unit_price} onChange={e => setItemForm({ ...itemForm, unit_price: e.target.value })}/>
          <input placeholder="ISBN" className="input md:col-span-2" value={itemForm.isbn} onChange={e => setItemForm({ ...itemForm, isbn: e.target.value })}/>
          <button disabled={busy} className="btn-primary md:col-span-3"><Plus className="h-4 w-4"/>{ar ? 'إضافة بند' : 'Add order item'}</button>
        </form>
        <div className="divide-y divide-slate-100">
          {selectedItems.map(item => <div key={item.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-bold text-slate-900">{item.title}</p><p className="text-xs text-slate-500">{item.author || '—'} · {item.unit_price} EGP × {item.quantity}</p></div>
            <div className="flex items-center gap-3"><span className="text-xs font-bold text-slate-500">{item.received_quantity}/{item.quantity} {ar ? 'مستلم' : 'received'}</span><button disabled={item.received_quantity >= item.quantity} onClick={() => receiveOne(item)} className="btn-secondary disabled:opacity-40"><PackageCheck className="h-4 w-4"/>{ar ? 'استلام نسخة' : 'Receive 1'}</button></div>
          </div>)}
          {!selectedItems.length && <p className="p-8 text-center text-sm text-slate-400">{ar ? 'لا توجد بنود بعد' : 'No order items yet'}</p>}
        </div>
      </div> : <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-400">{ar ? 'اختر طلب شراء' : 'Select a purchase order'}</div>}
    </div>
  </div>;
}
