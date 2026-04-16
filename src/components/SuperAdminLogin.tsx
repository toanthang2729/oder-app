import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Shield, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // Assuming react-router is used

export default function SuperAdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists() && userDoc.data().role === 'superadmin') {
        window.location.href = '/superadmin'; // Redirect to superadmin dashboard
      } else {
        setError('Bạn không có quyền truy cập trang này.');
      }
    } catch (err) {
      setError('Đăng nhập thất bại. Kiểm tra lại email/mật khẩu.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-border">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-sidebar rounded-2xl flex items-center justify-center mb-4">
            <Shield className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-serif text-text-main">Đăng nhập Quản trị</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-bg text-sm"
            placeholder="Email quản trị"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-bg text-sm"
            placeholder="Mật khẩu"
            required
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button type="submit" className="w-full bg-sidebar text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
            <LogIn size={18} /> Đăng nhập
          </button>
        </form>
      </div>
    </div>
  );
}
