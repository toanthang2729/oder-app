import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UtensilsCrossed, LogIn, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function Auth() {
  const [authMode, setAuthMode] = useState<'owner_login' | 'owner_register' | 'staff_login'>('owner_login');
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  
  const [name, setName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [cccd, setCccd] = useState('');
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');

  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (authMode === 'owner_login') {
        const email = `owner_${phone}@restaurant.com`;
        // Fallback for old accounts if needed, but we'll stick to new format
        await signInWithEmailAndPassword(auth, email, password).catch(async (err) => {
           if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
             // Try old format
             return await signInWithEmailAndPassword(auth, `${phone}@restaurant.com`, password);
           }
           throw err;
        });
      } else if (authMode === 'owner_register') {
        const email = `owner_${phone}@restaurant.com`;
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          phone: phone,
          name,
          restaurantName,
          cccd,
          dob,
          address,
          role: 'owner',
          createdAt: serverTimestamp()
        });
        await setDoc(doc(db, 'restaurants', user.uid), {
          ownerUid: user.uid,
          name: restaurantName,
          createdAt: serverTimestamp()
        });
      } else if (authMode === 'staff_login') {
        const email = `staff_${ownerPhone}_${phone}@restaurant.com`;
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Thông tin đăng nhập không đúng');
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
        className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-border/50 p-8 border border-border"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-olive rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-olive/20">
            <UtensilsCrossed className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif text-text-main italic">Order APP</h1>
          <p className="text-text-muted text-[11px] uppercase tracking-widest mt-2 font-bold">Quản lý nhà hàng chuyên nghiệp</p>
        </div>

        <div className="flex gap-2 mb-8 bg-bg p-1 rounded-xl">
          <button
            onClick={() => setAuthMode('owner_login')}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
              authMode === 'owner_login' || authMode === 'owner_register' ? "bg-white shadow-sm text-olive" : "text-text-muted hover:text-text-main"
            )}
          >
            Chủ quán
          </button>
          <button
            onClick={() => setAuthMode('staff_login')}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
              authMode === 'staff_login' ? "bg-white shadow-sm text-olive" : "text-text-muted hover:text-text-main"
            )}
          >
            Nhân viên
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'staff_login' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">SĐT Chủ quán</label>
              <input
                type="tel"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none transition-all bg-bg text-sm mb-4"
                placeholder="09xx xxx xxx"
                required
              />
            </motion.div>
          )}

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">
              {authMode === 'staff_login' ? 'SĐT Nhân viên' : 'Số điện thoại'}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none transition-all bg-bg text-sm"
              placeholder="09xx xxx xxx"
              required
            />
          </div>

          {authMode === 'owner_register' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Tên nhà hàng</label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none transition-all bg-bg text-sm"
                  placeholder="Nhà hàng của tôi"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Họ và tên</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none transition-all bg-bg text-sm"
                  placeholder="Nguyễn Văn A"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">CCCD / CMND</label>
                <input
                  type="text"
                  value={cccd}
                  onChange={(e) => setCccd(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none transition-all bg-bg text-sm"
                  placeholder="0123456789"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Ngày tháng năm sinh</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none transition-all bg-bg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Địa chỉ</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none transition-all bg-bg text-sm"
                  placeholder="123 Đường ABC, Quận XYZ"
                  required
                />
              </div>
            </motion.div>
          )}

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
            className="w-full bg-olive hover:bg-olive/90 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-olive/10 flex items-center justify-center gap-2 text-sm mt-4"
          >
            {authMode === 'owner_register' ? <UserPlus size={18} /> : <LogIn size={18} />}
            {authMode === 'owner_register' ? 'Đăng ký Chủ quán' : 'Đăng nhập'}
          </button>
        </form>

        {(authMode === 'owner_login' || authMode === 'owner_register') && (
          <p className="mt-8 text-center text-text-muted text-xs">
            {authMode === 'owner_login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
            <button
              onClick={() => setAuthMode(authMode === 'owner_login' ? 'owner_register' : 'owner_login')}
              className="ml-2 text-olive font-bold hover:underline"
            >
              {authMode === 'owner_login' ? 'Đăng ký ngay' : 'Đăng nhập'}
            </button>
          </p>
        )}
      </motion.div>
    </div>
  );
}
