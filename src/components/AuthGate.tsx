import React, { useState } from 'react';
import { LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';

interface AuthGateProps {
  needsSetup: boolean;
  onLogin: (username: string, password: string) => Promise<void>;
  onSetup: (username: string, password: string) => Promise<void>;
}

export const AuthGate: React.FC<AuthGateProps> = ({ needsSetup, onLogin, onSetup }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (needsSetup) await onSetup(username, password);
      else await onLogin(username, password);
    } catch (err: any) {
      setError(err.message || 'Không thể đăng nhập.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-5">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-3xl p-7 sm:p-9 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">TaxVault Pro</h1>
            <p className="text-xs text-slate-500">{needsSetup ? 'Thiết lập tài khoản quản trị đầu tiên' : 'Đăng nhập để tiếp tục'}</p>
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-slate-700">Tên đăng nhập</span>
          <span className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5">
            <UserRound className="w-4 h-4 text-slate-400" />
            <input autoComplete="username" required minLength={3} maxLength={32} value={username} onChange={(e) => setUsername(e.target.value)} className="w-full outline-none text-sm" />
          </span>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-slate-700">Mật khẩu{needsSetup ? ' (ít nhất 8 ký tự)' : ''}</span>
          <span className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5">
            <LockKeyhole className="w-4 h-4 text-slate-400" />
            <input type="password" autoComplete={needsSetup ? 'new-password' : 'current-password'} required minLength={needsSetup ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full outline-none text-sm" />
          </span>
        </label>
        {error && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 text-sm font-bold">
          {busy ? 'Đang xử lý…' : needsSetup ? 'Tạo tài khoản Admin' : 'Đăng nhập'}
        </button>
      </form>
    </main>
  );
};
