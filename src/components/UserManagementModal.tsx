import React, { useEffect, useState } from 'react';
import { Shield, UserRound, Trash2, X } from 'lucide-react';
import { AppUser } from '../types';
import { createAppUser, deleteAppUser, fetchAppUsers } from '../utils/api';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose, currentUserId }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AppUser['role']>('user');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetchAppUsers().then(setUsers).catch((err) => setError(err.message));
  }, [isOpen]);

  if (!isOpen) return null;

  const addUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      setUsers(await createAppUser(username, password, role));
      setUsername('');
      setPassword('');
      setRole('user');
    } catch (err: any) {
      setError(err.message || 'Không thể tạo tài khoản.');
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (user: AppUser) => {
    if (!window.confirm(`Xóa tài khoản ${user.username}?`)) return;
    try {
      setUsers(await deleteAppUser(user.id));
    } catch (err: any) {
      setError(err.message || 'Không thể xóa tài khoản.');
    }
  };

  return (
    <div className="fixed inset-0 z-[10010] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
        <header className="flex items-center justify-between p-5 border-b border-slate-100">
          <div><h2 className="font-black text-slate-900">Quản lý tài khoản</h2><p className="text-xs text-slate-500 mt-1">Admin có thể tạo/xóa tài khoản và phân quyền.</p></div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Đóng"><X className="w-4 h-4" /></button>
        </header>
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          <form onSubmit={addUser} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
            <label className="text-xs font-semibold text-slate-600 space-y-1"><span>Tên đăng nhập</span><input required minLength={3} maxLength={32} value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg" /></label>
            <label className="text-xs font-semibold text-slate-600 space-y-1"><span>Mật khẩu (từ 8 ký tự)</span><input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg" /></label>
            <label className="text-xs font-semibold text-slate-600 space-y-1"><span>Quyền</span><select value={role} onChange={(e) => setRole(e.target.value as AppUser['role'])} className="w-full px-3 py-2 border border-slate-200 rounded-lg"><option value="user">User</option><option value="admin">Admin</option></select></label>
            <button disabled={busy} className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">Tạo tài khoản</button>
          </form>
          {error && <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</p>}
          <div className="space-y-2">
            {users.map((user) => <div key={user.id} className="flex items-center justify-between gap-3 border border-slate-100 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">{user.role === 'admin' ? <Shield className="w-4 h-4 text-emerald-700" /> : <UserRound className="w-4 h-4 text-slate-500" />}</div><div><p className="text-sm font-bold text-slate-800">{user.username}</p><p className="text-[11px] text-slate-500">{user.role === 'admin' ? 'Admin' : 'User'}</p></div></div>
              {user.id !== currentUserId && <button onClick={() => removeUser(user)} title="Xóa tài khoản" className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>}
            </div>)}
          </div>
          <p className="text-[11px] text-slate-500">User có thể xem và nhập dữ liệu; chỉ Admin mới được xóa hóa đơn, làm sạch kho hoặc phục hồi bản sao lưu. Hệ thống luôn giữ lại ít nhất một Admin.</p>
        </div>
      </section>
    </div>
  );
};
