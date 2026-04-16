import React, { useState, useEffect } from 'react';
import { User, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db } from '../lib/firebase';
import { collection, onSnapshot, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Restaurant, UserProfile } from '../types';
import { Shield, Users, Store, Trash2, Edit2, ChevronDown, ChevronUp, Lock, Unlock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function SuperAdminDashboard({ user }: { user: User }) {
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const resUnsubscribe = onSnapshot(collection(db, 'restaurants'), (snapshot) => {
      setAllRestaurants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Restaurant)));
    });
    const usersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });
    return () => { resUnsubscribe(); usersUnsubscribe(); };
  }, []);

  const [editingRestaurant, setEditingRestaurant] = useState<string | null>(null);
  const [tempData, setTempData] = useState<Partial<Restaurant>>({});

  const deleteUser = async (uid: string, role: string) => {
    if (role === 'superadmin') {
      alert('Không thể xóa SuperAdmin');
      return;
    }
    
    // Yêu cầu nhập mật khẩu trước khi xóa
    const password = prompt('Vui lòng nhập mật khẩu để xác nhận xóa người dùng:');
    if (!password) return;

    if (!user.email) return;
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      
      if (window.confirm('Bạn có chắc chắn muốn xóa người dùng này?')) {
        await deleteDoc(doc(db, 'users', uid));
      }
    } catch (error) {
      alert('Mật khẩu không đúng hoặc có lỗi xảy ra!');
    }
  };

  const deleteRestaurant = async (restaurantId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa nhà hàng này?')) {
      try {
        await deleteDoc(doc(db, 'restaurants', restaurantId));
      } catch (error) {
        alert('Lỗi khi xóa nhà hàng: ' + error);
      }
    }
  };

  const updateRestaurant = async (restaurantId: string, data: Partial<Restaurant>) => {
    try {
      const updateData = { ...data };
      // Nếu chưa có ngày đăng ký, đặt là hôm nay
      if (!data.startDate) {
        updateData.startDate = new Date().toISOString().split('T')[0];
      }
      // Tính ngày đến hạn: 30 ngày sau ngày đăng ký
      const startDate = new Date(updateData.startDate || new Date());
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + 30);
      updateData.dueDate = dueDate.toISOString().split('T')[0];

      await updateDoc(doc(db, 'restaurants', restaurantId), updateData);
      setEditingRestaurant(null);
      setTempData({});
    } catch (error) {
      alert('Lỗi khi cập nhật: ' + error);
    }
  };

  const toggleLock = async (r: Restaurant) => {
    const newStatus = r.status === 'locked' ? 'active' : 'locked';
    await updateDoc(doc(db, 'restaurants', r.id), { 
      status: newStatus,
      lockMessage: newStatus === 'locked' ? 'Vui lòng thanh toán' : ''
    });
  };

  const StatCard = ({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className="p-3 bg-slate-100 rounded-xl text-slate-600">{icon}</div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <p className="text-3xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );

  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const superAdmins = allUsers.filter(u => u.role === 'superadmin');

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Shield className="text-indigo-600" />
            Bảng điều khiển hệ thống
          </h2>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <StatCard title="Tổng người dùng" value={allUsers.length} icon={<Users size={24} />} />
          <StatCard title="Tổng nhà hàng" value={allRestaurants.length} icon={<Store size={24} />} />
        </div>

        <div className="grid grid-cols-1 gap-8">
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Quản trị viên hệ thống (SuperAdmin)</h3>
            <div className="overflow-x-auto bg-slate-50 rounded-xl">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                    <th className="p-4">Tên</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Mật khẩu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {superAdmins.map(u => (
                    <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-900">{u.name || 'Chưa cập nhật'}</td>
                      <td className="p-4 text-slate-600">{u.email || 'N/A'}</td>
                      <td className="p-4 text-slate-600">********</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Danh sách người dùng</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                    <th className="p-4">Tên</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Vai trò</th>
                    <th className="p-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allUsers.map(u => (
                    <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-900">{u.name || 'Chưa cập nhật'}</td>
                      <td className="p-4 text-slate-600">{u.email || 'N/A'}</td>
                      <td className="p-4 text-slate-600">{u.role}</td>
                      <td className="p-4 text-center">
                        {u.role !== 'superadmin' && (
                          <button onClick={() => deleteUser(u.uid, u.role)} className="text-red-600"><Trash2 size={18} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-md w-full max-w-[95rem] mx-auto">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold text-slate-900">Danh sách nhà hàng</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                    <th className="p-4">Tên Nhà Hàng</th>
                    <th className="p-4">Chủ Quán</th>
                    <th className="p-4">SĐT</th>
                    <th className="p-4">Địa Chỉ</th>
                    <th className="p-4">CCCD</th>
                    <th className="p-4">Phiên Bản</th>
                    <th className="p-4">Số Bàn</th>
                    <th className="p-4">Số Nhân Viên</th>
                    <th className="p-4">Ngày Đăng Ký</th>
                    <th className="p-4">Ngày Đến Hạn</th>
                    <th className="p-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allRestaurants.map(r => {
                    const owner = allUsers.find(u => u.uid === r.ownerUid);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-bold text-slate-900">{r.name}</td>
                        <td className="p-4 text-slate-600">{owner?.name || 'N/A'}</td>
                        <td className="p-4 text-slate-600">{owner?.phone || 'N/A'}</td>
                        <td className="p-4 text-slate-600">{owner?.address || 'N/A'}</td>
                        <td className="p-4 text-slate-600">{owner?.cccd || 'N/A'}</td>
                        <td className="p-4 text-slate-600 uppercase font-bold">
                          {editingRestaurant === r.id ? (
                            <select value={tempData.plan || r.plan || 'standard'} onChange={(e) => setTempData({...tempData, plan: e.target.value as 'pro' | 'standard'})} className="border rounded p-1">
                              <option value="standard">Standard</option>
                              <option value="pro">Pro</option>
                            </select>
                          ) : (r.plan || 'standard').toUpperCase()}
                        </td>
                        <td className="p-4 text-slate-600">
                          {editingRestaurant === r.id ? (
                            <input type="number" defaultValue={r.tableCount || 5} onChange={(e) => setTempData({...tempData, tableCount: parseInt(e.target.value)})} className="w-16 border rounded p-1" />
                          ) : (r.plan === 'pro' ? 'Không giới hạn' : r.tableCount || 5)}
                        </td>
                        <td className="p-4 text-slate-600">
                          {editingRestaurant === r.id ? (
                            <input type="number" defaultValue={r.staffCount || 3} onChange={(e) => setTempData({...tempData, staffCount: parseInt(e.target.value)})} className="w-16 border rounded p-1" />
                          ) : (r.plan === 'pro' ? 'Không giới hạn' : r.staffCount || 3)}
                        </td>
                        <td className="p-4 text-slate-600">{r.startDate || 'N/A'}</td>
                        <td className="p-4 text-slate-600">{r.dueDate || 'N/A'}</td>
                        <td className="p-4 flex gap-2 justify-center">
                          {editingRestaurant === r.id ? (
                            <button onClick={() => updateRestaurant(r.id, tempData)} className="text-green-600 font-bold">Cập nhật</button>
                          ) : (
                            <button onClick={() => { setEditingRestaurant(r.id); setTempData(r); }} className="text-indigo-600"><Edit2 size={20} /></button>
                          )}
                          <button onClick={() => toggleLock(r)} className={r.status === 'locked' ? 'text-yellow-600' : 'text-slate-400'}>
                            {r.status === 'locked' ? <Lock size={20} /> : <Unlock size={20} />}
                          </button>
                          <button onClick={() => deleteRestaurant(r.id)} className="text-red-600"><Trash2 size={20} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
