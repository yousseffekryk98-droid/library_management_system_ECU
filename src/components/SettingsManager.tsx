import React, { useState, useEffect } from 'react';
import { translations, Language } from '../translations';
import { supabase } from '../services/supabase-client';
import { FileDown, Languages, Shield, Database, Info, UserCheck, Save } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function SettingsManager({ lang, setLang, onSettingsUpdate }: { lang: Language, setLang: (l: Language) => void, onSettingsUpdate?: () => void }) {
  const t = translations[lang];
  const [currentDr, setCurrentDr] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase.from('settings').select('value').eq('key', 'current_dr').single();
    if (error) {
      console.error('Failed to load settings', error);
      return;
    }
    if (data?.value) setCurrentDr(data.value);
  };

  const updateDrName = async () => {
    const { error } = await supabase.from('settings').upsert({ key: 'current_dr', value: currentDr });
    if (error) return alert('Update failed: ' + error.message);
    alert(lang === 'ar' ? 'تم تحديث اسم المسؤول بنجاح' : 'Librarian name updated successfully');
    if (onSettingsUpdate) onSettingsUpdate();
  };

  const exportToExcel = async (type: 'inventory' | 'borrowing') => {
    const table = type === 'inventory' ? 'books' : 'borrowing';
    const { data, error } = await supabase.from(table).select('*');
    if (error) return alert('Failed to export: ' + error.message);
    const ws = XLSX.utils.json_to_sheet(data || []);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === 'inventory' ? 'Inventory' : 'History');
    
    XLSX.writeFile(wb, `library_${type}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      {/* Librarian Shift Management */}
      <section className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 transition-all"></div>
        <div className="flex items-center gap-3 mb-6 font-bold text-gray-900 border-b border-gray-100 pb-4">
          <UserCheck className="w-5 h-5 text-blue-600" />
          {lang === 'ar' ? 'إدارة مناوبة المسؤول (Chief Librarian)' : 'Librarian on Duty (Dr. Shift)'}
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
              {lang === 'ar' ? 'اسم الدكتور / المسؤول الحالي' : 'Current Librarian Name'}
            </label>
            <input 
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
              value={currentDr}
              onChange={(e) => setCurrentDr(e.target.value)}
              placeholder="e.g. Dr. Ahmed Hassan"
            />
          </div>
          <button 
            onClick={updateDrName}
            className="md:self-end flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-100"
          >
            <Save className="w-5 h-5" />
            <span>{lang === 'ar' ? 'تعديل المناوبة' : 'Update Shift'}</span>
          </button>
        </div>
      </section>

      {/* Language Section */}
      <section className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6 font-bold text-gray-900 border-b border-gray-100 pb-4">
          <Languages className="w-5 h-5 text-blue-600" />
          {t.settings.language}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setLang('ar')}
            className={`px-6 py-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${lang === 'ar' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 hover:border-gray-200 text-gray-500'}`}
          >
            <span className="text-2xl">🇸🇦</span>
            <span className="font-bold">العربية</span>
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-6 py-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${lang === 'en' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 hover:border-gray-200 text-gray-500'}`}
          >
            <span className="text-2xl">🇺🇸</span>
            <span className="font-bold">English</span>
          </button>
        </div>
      </section>

      {/* Reports Section */}
      <section className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6 font-bold text-gray-900 border-b border-gray-100 pb-4">
          <FileDown className="w-5 h-5 text-blue-600" />
          {t.tabs.settings}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => exportToExcel('inventory')}
            className="flex items-center justify-between p-6 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 hover:border-gray-200 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <FileDown className="w-6 h-6" />
              </div>
              <div className="text-left rtl:text-right">
                <h3 className="font-bold text-gray-900">{t.settings.exportInventory}</h3>
                <p className="text-xs text-gray-500">Excel (.xlsx)</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => exportToExcel('borrowing')}
            className="flex items-center justify-between p-6 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 hover:border-gray-200 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <FileDown className="w-6 h-6" />
              </div>
              <div className="text-left rtl:text-right">
                <h3 className="font-bold text-gray-900">{t.settings.exportBorrowing}</h3>
                <p className="text-xs text-gray-500">Excel (.xlsx)</p>
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* System Status Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
            <Shield className="w-5 h-5" />
          </div>
          <div className="text-left rtl:text-right">
            <p className="text-[10px] uppercase font-bold text-gray-400">Security</p>
            <p className="text-sm font-bold text-gray-900">Encrypted DB</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
            <Database className="w-5 h-5" />
          </div>
          <div className="text-left rtl:text-right">
            <p className="text-[10px] uppercase font-bold text-gray-400">Database</p>
            <p className="text-sm font-bold text-gray-900">SQLite 3.x Local</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
            <Info className="w-5 h-5" />
          </div>
          <div className="text-left rtl:text-right">
            <p className="text-[10px] uppercase font-bold text-gray-400">Version</p>
            <p className="text-sm font-bold text-gray-900">v3.0.0 Stable</p>
          </div>
        </div>
      </div>
    </div>
  );
}
