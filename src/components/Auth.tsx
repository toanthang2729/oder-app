import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { UtensilsCrossed, LogIn, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';

export default function Auth() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');

  const handlePhoneAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Convert phone to a dummy email for Firebase Auth
    const email = `${phone}@restaurant.com`;
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          phone: phone,
          role: 'owner',
          createdAt: serverTimestamp()
        });
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Số điện thoại hoặc mật khẩu không đúng');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Số điện thoại này đã được đăng ký');
      } else {
        setError(err.message);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-border/50 p-10 border border-border"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-olive rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-olive/20">
            <UtensilsCrossed className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif text-text-main italic">Order APP</h1>
          <p className="text-text-muted text-[11px] uppercase tracking-widest mt-2 font-bold">Quản lý nhà hàng chuyên nghiệp</p>
        </div>

        <form onSubmit={handlePhoneAuth} className="space-y-5">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Số điện thoại</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none transition-all bg-bg text-sm"
              placeholder="09xx xxx xxx"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none transition-all bg-bg text-sm"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-red-500 text-[10px] font-bold uppercase">{error}</p>}

          <button
            type="submit"
            className="w-full bg-olive hover:bg-olive/90 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-olive/10 flex items-center justify-center gap-2 text-sm"
          >
            {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
            {isLogin ? 'Đăng nhập' : 'Đăng ký Chủ quán'}
          </button>
        </form>

        <p className="mt-10 text-center text-text-muted text-xs">
          {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="ml-2 text-olive font-bold hover:underline"
          >
            {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
