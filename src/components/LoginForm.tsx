import React, { useState } from 'react';
import { supabase } from '../services/supabase-client';
import { Library, Lock, Mail, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginFormProps {
  onLoginSuccess: () => void;
  lang: 'en' | 'ar';
}

export default function LoginForm({ onLoginSuccess, lang }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = {
    en: {
      title: 'Library Master Pro',
      subtitle: 'Admin Access Only',
      email: 'Email Address',
      password: 'Password',
      login: 'Login',
      loggingIn: 'Logging in...',
      invalidCredentials: 'Invalid email or password',
      systemLocked: 'Secure Administration System'
    },
    ar: {
      title: 'لايبراري ماستر برو',
      subtitle: 'دخول المدير فقط',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      login: 'تسجيل الدخول',
      loggingIn: 'جاري تسجيل الدخول...',
      invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      systemLocked: 'نظام إدارة آمن'
    }
  };

  const text = t[lang];
  const isRtl = lang === 'ar';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Try to auto-create an admin user if env vars are provided and match
        const AUTO_CREATE = import.meta.env.VITE_AUTO_CREATE_ADMIN === 'true';
        const ENV_ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
        const ENV_ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

        if (AUTO_CREATE && ENV_ADMIN_EMAIL && ENV_ADMIN_PASSWORD && ENV_ADMIN_EMAIL === email && ENV_ADMIN_PASSWORD === password) {
          try {
            const { error: signUpError } = await supabase.auth.signUp({ email, password });
            if (signUpError) {
              setError(text.invalidCredentials);
              console.warn('Auto sign-up failed:', signUpError.message);
            } else {
              // Try sign in again after signup
              const { data: secondData, error: secondError } = await supabase.auth.signInWithPassword({ email, password });
              if (secondError) {
                setError(text.invalidCredentials);
                console.warn('Sign-in after signup failed:', secondError.message);
              } else if (secondData.session) {
                onLoginSuccess();
              }
            }
          } catch (e) {
            setError(text.invalidCredentials);
            console.warn('Auto-create admin exception:', e);
          }
        } else {
          setError(text.invalidCredentials);
        }
      } else if (data.session) {
        onLoginSuccess();
      }
    } catch (err) {
      setError(text.invalidCredentials);
      console.warn('Login exception:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Library className="w-10 h-10 text-white" />
            </div>
            <h1 className={`text-2xl font-bold text-white ${isRtl ? 'font-arabic' : ''}`}>
              {text.title}
            </h1>
            <p className="text-slate-400 text-sm mt-2">{text.subtitle}</p>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 rounded-full">
              <Lock className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                {text.systemLocked}
              </span>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-2">
                {text.email}
              </label>
              <div className="relative">
                <Mail className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all`}
                  placeholder={lang === 'en' ? 'admin@library.com' : 'admin@library.com'}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-2">
                {text.password}
              </label>
              <div className="relative">
                <Lock className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all`}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? text.loggingIn : text.login}
            </button>
          </form>

          {/* Footer Note */}
          <div className="mt-6 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              Authorized Personnel Only
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}