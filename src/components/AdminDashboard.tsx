import React, { useState, useEffect } from 'react';
import { User, getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { db, auth, storage } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, orderBy, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Restaurant, MenuItem, Order, UserRole, UserProfile } from '../types';
import { LayoutDashboard, Utensils, ClipboardList, QrCode, LogOut, Plus, Check, X, Clock, ChevronRight, Image as ImageIcon, Upload, Loader2, Camera, BarChart3, ShieldCheck, Star, Users, Wallet, ChefHat, Bell, BellRing, Pencil, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminDashboard({ user }: { user: User }) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'qr' | 'analytics' | 'staff'>('orders');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isUpgradingPlan, setIsUpgradingPlan] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('owner');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [newStaff, setNewStaff] = useState({ phone: '', password: '', role: 'waiter' as UserRole });
  const [isUploading, setIsUploading] = useState<number | null>(null);
  const [newItem, setNewItem] = useState({ name: '', price: '', category: 'Món chính', description: '', imageUrls: ['', ''] });
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const categories = [
    'Món khai vị',
    'Món chính',
    'Món phụ',
    'Rau & Salad',
    'Đồ uống',
    'Tráng miệng',
    'Lẩu & Súp',
    'Đặc sản'
  ];
  const [selectedTable, setSelectedTable] = useState('1');
  const numTables = 20; // Full tables for both plans as requested
  
  useEffect(() => {
    // Fetch user profile and restaurant
    const fetchInitialData = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        setUserProfile(userData);
        setUserRole(userData.role);

        if (userData.role === 'owner') {
          const q = query(collection(db, 'restaurants'), where('ownerUid', '==', user.uid));
          onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
              const data = snapshot.docs[0].data();
              setRestaurant({ id: snapshot.docs[0].id, ...data } as Restaurant);
            } else {
              createDefaultRestaurant();
            }
          });
        } else if (userData.restaurantId) {
          const resDoc = await getDoc(doc(db, 'restaurants', userData.restaurantId));
          if (resDoc.exists()) {
            setRestaurant({ id: resDoc.id, ...resDoc.data() } as Restaurant);
          }
        }
      }
    };
    fetchInitialData();
  }, [user.uid]);

  useEffect(() => {
    if (!restaurant) return;

    // Fetch staff list if owner
    if (userRole === 'owner') {
      const staffUnsubscribe = onSnapshot(
        query(collection(db, 'users'), where('restaurantId', '==', restaurant.id)),
        (snapshot) => {
          setStaffList(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
        }
      );
      return () => staffUnsubscribe();
    }
  }, [restaurant, userRole]);

  useEffect(() => {
    if (!restaurant) return;

    // Fetch menu items
    const menuUnsubscribe = onSnapshot(collection(db, 'restaurants', restaurant.id, 'menuItems'), (snapshot) => {
      setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem)));
    });

    // Fetch orders
    const ordersQuery = query(
      collection(db, 'restaurants', restaurant.id, 'orders'),
      orderBy('createdAt', 'desc')
    );
    const ordersUnsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });

    return () => {
      menuUnsubscribe();
      ordersUnsubscribe();
    };
  }, [restaurant]);

  const createDefaultRestaurant = async () => {
    const trialDays = 30;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    await addDoc(collection(db, 'restaurants'), {
      name: 'Nhà hàng của tôi',
      ownerUid: user.uid,
      plan: 'standard',
      trialEndsAt: trialEndsAt,
      createdAt: serverTimestamp()
    });
  };

  const upgradePlan = async () => {
    if (!restaurant) return;
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        plan: 'pro'
      });
      setIsUpgradingPlan(false);
      alert("Chúc mừng! Bạn đã nâng cấp lên bản PRO thành công.");
    } catch (error) {
      console.error("Error upgrading plan:", error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file || !restaurant) return;

    try {
      setIsUploading(index);
      
      // Compress image and convert to base64 to avoid Storage permission issues
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Compress to JPEG with 0.7 quality
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            const urls = [...newItem.imageUrls];
            urls[index] = dataUrl;
            setNewItem({ ...newItem, imageUrls: urls });
          }
          setIsUploading(null);
        };
      };
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Lỗi khi tải ảnh lên. Vui lòng thử lại.");
      setIsUploading(null);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;

    await addDoc(collection(db, 'restaurants', restaurant.id, 'menuItems'), {
      ...newItem,
      price: Number(newItem.price),
      restaurantId: restaurant.id,
      imageUrls: newItem.imageUrls.filter(url => url.trim() !== ''),
      available: true
    });
    setNewItem({ name: '', price: '', category: 'Món chính', description: '', imageUrls: ['', ''] });
    setIsAddingItem(false);
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant || !editingItem) return;

    await updateDoc(doc(db, 'restaurants', restaurant.id, 'menuItems', editingItem.id), {
      name: editingItem.name,
      price: Number(editingItem.price),
      category: editingItem.category,
      description: editingItem.description,
      available: editingItem.available
    });
    setEditingItem(null);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!restaurant) return;
    if (window.confirm('Bạn có chắc chắn muốn xóa món này khỏi thực đơn?')) {
      await deleteDoc(doc(db, 'restaurants', restaurant.id, 'menuItems', itemId));
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) {
      alert('Không tìm thấy thông tin nhà hàng.');
      return;
    }
    if (!userProfile) {
      alert('Không tìm thấy thông tin chủ quán.');
      return;
    }

    try {
      // Create a secondary Firebase app instance to create the staff user without logging out the owner
      const secondaryApp = initializeApp(auth.app.options, `SecondaryApp_${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      
      const email = `staff_${userProfile.phone}_${newStaff.phone}@restaurant.com`;
      
      const result = await createUserWithEmailAndPassword(secondaryAuth, email, newStaff.password);
      await secondaryAuth.signOut(); // Sign out the secondary app

      const staffRef = doc(db, 'users', result.user.uid);
      await setDoc(staffRef, {
        uid: result.user.uid,
        phone: newStaff.phone,
        ownerPhone: userProfile.phone,
        role: newStaff.role,
        restaurantId: restaurant.id,
        createdAt: serverTimestamp()
      });

      alert(`Đã thêm ${newStaff.role === 'cashier' ? 'Thu ngân' : 'Phục vụ'} thành công!`);
      setIsAddingStaff(false);
      setNewStaff({ phone: '', password: '', role: 'waiter' });
    } catch (error: any) {
      console.error("Error adding staff:", error);
      if (error.code === 'auth/email-already-in-use') {
        alert('Số điện thoại nhân viên này đã được đăng ký cho nhà hàng của bạn.');
      } else {
        alert('Có lỗi xảy ra: ' + error.message);
      }
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    if (!restaurant) return;
    await updateDoc(doc(db, 'restaurants', restaurant.id, 'orders', orderId), { status });
  };

  const clearTable = async (tableNumber: string) => {
    if (!restaurant) return;
    try {
      // Find all paid, completed, and cancelled orders for this table and archive them
      const tableOrders = orders.filter(o => 
        o.tableNumber === tableNumber && 
        (o.status === 'paid' || o.status === 'completed' || o.status === 'cancelled')
      );
      for (const order of tableOrders) {
        await updateDoc(doc(db, 'restaurants', restaurant.id, 'orders', order.id), { status: 'archived' });
      }
      alert(`Bàn ${tableNumber} đã được dọn sạch và sẵn sàng đón khách mới.`);
    } catch (error) {
      console.error("Error clearing table:", error);
      alert("Có lỗi xảy ra khi dọn bàn.");
    }
  };

  const updateTableOrders = async (tableNumber: string, fromStatuses: string[], toStatus: string) => {
    if (!restaurant) return;
    const tableOrders = orders.filter(o => o.tableNumber === tableNumber && fromStatuses.includes(o.status));
    for (const order of tableOrders) {
      await updateDoc(doc(db, 'restaurants', restaurant.id, 'orders', order.id), { status: toStatus });
    }
  };

  const downloadQR = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `QR_Ban_${selectedTable}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const qrUrl = `${window.location.origin}/?restaurantId=${restaurant?.id}`;

  const startSession = async () => {
    if (!restaurant) return;
    if (window.confirm('Bạn có chắc chắn muốn bắt đầu ca làm việc mới? Doanh thu sẽ được tính từ thời điểm này.')) {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        isSessionActive: true,
        sessionStartTime: serverTimestamp()
      });
    }
  };

  const endSession = async () => {
    if (!restaurant) return;
    if (window.confirm('Bạn có chắc chắn muốn kết thúc ca làm việc? Khách hàng sẽ không thể đặt món cho đến khi bạn bắt đầu ca mới.')) {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        isSessionActive: false
      });
    }
  };

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Sidebar */}
      <div className="w-64 bg-sidebar text-white flex flex-col">
        <div className="p-8">
          <div className="flex items-center gap-3 text-soft-clay font-serif italic text-2xl">
            <Utensils size={24} />
            <span>Order APP</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {(userRole === 'owner' || userRole === 'cashier' || userRole === 'waiter') && (
            <button
              onClick={() => setActiveTab('orders')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-sm",
                activeTab === 'orders' ? "bg-accent text-white" : "text-white/60 hover:bg-white/5"
              )}
            >
              <ClipboardList size={20} />
              {userRole === 'waiter' ? 'Đơn hàng' : 'Quản lý đơn'}
              {orders.filter(o => o.status === 'pending').length > 0 && (
                <span className="ml-auto bg-soft-clay text-sidebar text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {orders.filter(o => o.status === 'pending').length}
                </span>
              )}
            </button>
          )}

          {userRole === 'owner' && (
            <button
              onClick={() => setActiveTab('menu')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-sm",
                activeTab === 'menu' ? "bg-accent text-white" : "text-white/60 hover:bg-white/5"
              )}
            >
              <Utensils size={20} />
              Thực đơn
            </button>
          )}

          {(userRole === 'owner' || userRole === 'cashier') && (
            <button
              onClick={() => setActiveTab('qr')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-sm",
                activeTab === 'qr' ? "bg-accent text-white" : "text-white/60 hover:bg-white/5"
              )}
            >
              <QrCode size={20} />
              Thiết lập QR
            </button>
          )}

          {userRole === 'owner' && (
            <>
              <button
                onClick={() => setActiveTab('staff')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-sm",
                  activeTab === 'staff' ? "bg-accent text-white" : "text-white/60 hover:bg-white/5"
                )}
              >
                <Users size={20} />
                Nhân viên
              </button>
              
              <button
                onClick={() => setActiveTab('management')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-sm",
                  activeTab === 'management' ? "bg-accent text-white" : "text-white/60 hover:bg-white/5"
                )}
              >
                <BarChart3 size={20} />
                Quản lý & Báo cáo
              </button>
            </>
          )}
          
          {userRole === 'superadmin' && (
            <button
              onClick={() => setActiveTab('orders')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm text-soft-clay bg-white/5 mt-4"
            >
              <ShieldCheck size={20} />
              Quản trị App
            </button>
          )}
        </nav>

        <div className="px-6 py-6 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Gói hiện tại</span>
              <span className={cn(
                "text-[9px] font-bold uppercase px-2 py-0.5 rounded-full",
                restaurant?.plan === 'pro' ? "bg-soft-clay text-sidebar" : "bg-white/20 text-white"
              )}>
                {restaurant?.plan === 'pro' ? 'PRO' : 'Tiêu chuẩn'}
              </span>
            </div>
            <div className="text-[11px] text-white/60 mb-3">
              {restaurant?.trialEndsAt && new Date(restaurant.trialEndsAt.toDate()) > new Date() ? (
                <span>Hết hạn thử nghiệm: {new Date(restaurant.trialEndsAt.toDate()).toLocaleDateString('vi-VN')}</span>
              ) : (
                <span>Phí duy trì: {restaurant?.plan === 'pro' ? '145k' : '99k'}/tháng</span>
              )}
            </div>
            {restaurant?.plan === 'standard' && (
              <button 
                onClick={() => setIsUpgradingPlan(true)}
                className="w-full mt-2 py-2 bg-soft-clay text-sidebar rounded-lg text-[11px] font-bold hover:bg-white transition-all"
              >
                Nâng cấp lên PRO
              </button>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => auth.signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-all text-sm"
          >
            <LogOut size={20} />
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10">
        <header className="mb-10 flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-serif text-text-main mb-2">
              {activeTab === 'orders' && 'Chào buổi sáng, ' + (restaurant?.name || 'Nhà hàng')}
              {activeTab === 'menu' && 'Quản lý thực đơn'}
              {activeTab === 'qr' && 'Mã QR của bạn'}
            </h2>
            <p className="text-text-muted text-sm">
              {activeTab === 'orders' && `Hôm nay bạn có ${orders.filter(o => o.status !== 'archived').length} đơn hàng mới.`}
              {activeTab !== 'orders' && restaurant?.name}
            </p>
          </div>
          <div className="flex gap-3">
            {activeTab === 'orders' && (userRole === 'owner' || userRole === 'cashier') && (
              restaurant?.isSessionActive ? (
                <button
                  onClick={endSession}
                  className="bg-red-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Kết thúc ca
                </button>
              ) : (
                <button
                  onClick={startSession}
                  className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                >
                  Bắt đầu ca
                </button>
              )
            )}
            {activeTab === 'menu' && userRole === 'owner' && (
              <button
                onClick={() => setIsAddingItem(true)}
                className="bg-olive text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-olive/90 transition-all shadow-lg shadow-olive/10"
              >
                <Plus size={20} />
                Thêm món mới
              </button>
            )}
          </div>
        </header>

        {activeTab === 'orders' && (
          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
              <div className="text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1">Doanh thu (Ca hiện tại)</div>
              <div className="text-2xl font-medium text-text-main">
                {formatCurrency(orders.filter(o => {
                  if (o.status !== 'paid' && o.status !== 'completed' && o.status !== 'archived') return false;
                  if (!o.createdAt || !restaurant?.sessionStartTime) return false;
                  return o.createdAt.toMillis() >= restaurant.sessionStartTime.toMillis();
                }).reduce((acc, o) => acc + o.total, 0))}
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
              <div className="text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1">Đơn đang phục vụ</div>
              <div className="text-2xl font-medium text-text-main">{orders.filter(o => o.status !== 'paid' && o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'archived').length}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
              <div className="text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1">Bàn trống</div>
              <div className="text-2xl font-medium text-text-main">{numTables - new Set(orders.filter(o => o.status !== 'paid' && o.status !== 'completed' && o.status !== 'archived' && o.status !== 'cancelled').map(o => o.tableNumber)).size}</div>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'orders' && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Service Requests Section */}
              {orders.filter(o => o.status === 'pending' && o.items.length === 1 && o.items[0].id === 'call_waiter').length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm font-bold uppercase text-amber-600 tracking-wide flex items-center gap-2">
                    <BellRing size={16} /> Yêu cầu hỗ trợ
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {orders
                      .filter(o => o.status === 'pending' && o.items.length === 1 && o.items[0].id === 'call_waiter')
                      .map(request => (
                        <div key={request.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
                          <div>
                            <div className="font-bold text-amber-900">Bàn số {request.tableNumber}</div>
                            <div className="text-xs text-amber-700 mt-1">Đang gọi phục vụ</div>
                          </div>
                          <button 
                            onClick={() => updateOrderStatus(request.id, 'completed')}
                            className="bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-amber-600 transition-colors shadow-sm"
                          >
                            Đã hỗ trợ
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Food Orders Section */}
              <div className="space-y-4">
                <div className="text-sm font-bold uppercase text-text-muted tracking-wide mb-4">Đơn hàng chờ xử lý</div>
                {orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'archived' && !(o.items.length === 1 && o.items[0].id === 'call_waiter')).length === 0 ? (
                  <div className="py-20 text-center bg-white rounded-2xl border border-border">
                    <ClipboardList className="w-12 h-12 text-border mx-auto mb-4" />
                    <p className="text-text-muted">Chưa có đơn hàng nào</p>
                  </div>
                ) : (
                  Array.from(new Set<string>(orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'archived' && !(o.items.length === 1 && o.items[0].id === 'call_waiter')).map(o => o.tableNumber)))
                    .sort((a, b) => Number(a) - Number(b))
                    .map((tableNumber: string) => {
                      const tableOrders = orders.filter(o => o.tableNumber === tableNumber && o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'archived' && !(o.items.length === 1 && o.items[0].id === 'call_waiter'));
                      const tableTotal = tableOrders.reduce((acc, o) => acc + o.total, 0);
                      
                      // Aggregate items
                      const aggregatedItems = tableOrders.flatMap(o => o.items).reduce((acc, item) => {
                        const existing = acc.find(i => i.name === item.name);
                        if (existing) {
                          existing.quantity += item.quantity;
                        } else {
                          acc.push({ ...item });
                        }
                        return acc;
                      }, [] as typeof tableOrders[0]['items'][0][]);

                      const hasPending = tableOrders.some(o => o.status === 'pending');
                      const hasCookingOrReady = tableOrders.some(o => o.status === 'cooking' || o.status === 'ready');
                      const hasServed = tableOrders.some(o => o.status === 'served');
                      const allPaid = tableOrders.every(o => o.status === 'paid');

                      return (
                        <div key={tableNumber} className="bg-white rounded-xl border border-border p-5 shadow-sm border-l-4 border-l-olive">
                          <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
                            <h3 className="text-lg font-bold text-text-main">Bàn số {tableNumber}</h3>
                            <div className="text-sm font-bold text-olive">{formatCurrency(tableTotal)}</div>
                          </div>
                          
                          <div className="mb-4 space-y-2">
                            {aggregatedItems.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center text-sm">
                                <span className="font-medium text-text-main">{item.quantity}x {item.name}</span>
                                <span className="text-text-muted">{formatCurrency(item.price * item.quantity)}</span>
                              </div>
                            ))}
                          </div>

                        <div className="flex gap-2 mt-4">
                          {(userRole === 'owner' || userRole === 'cashier') && (
                            <button 
                              onClick={() => updateTableOrders(tableNumber, ['pending', 'cooking', 'ready'], 'served')}
                              className={cn("flex-1 py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1", (hasPending || hasCookingOrReady) ? "bg-indigo-500 text-white hover:bg-indigo-600 shadow-md shadow-indigo-500/20" : "bg-gray-100 text-gray-400 cursor-not-allowed")}
                              disabled={!(hasPending || hasCookingOrReady)}
                            >
                              <Bell size={14} /> Đã Phục vụ
                            </button>
                          )}

                          {(userRole === 'owner' || userRole === 'cashier') && (
                            <button 
                              onClick={() => updateTableOrders(tableNumber, ['served'], 'paid')}
                              className={cn("flex-1 py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1", hasServed ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/20" : "bg-gray-100 text-gray-400 cursor-not-allowed")}
                              disabled={!hasServed}
                            >
                              <Wallet size={14} /> Thanh toán
                            </button>
                          )}
                        </div>
                        
                        {allPaid && (userRole === 'owner' || userRole === 'cashier') && (
                          <button 
                            onClick={() => clearTable(tableNumber)}
                            className="w-full mt-3 py-2.5 rounded-lg border-2 border-emerald-600 text-emerald-600 font-bold hover:bg-emerald-50 transition-all text-xs flex items-center justify-center gap-1"
                          >
                            <Check size={14} /> Hoàn tất & Trả bàn
                          </button>
                        )}
                      </div>
                    );
                  })
              )}
              </div>
            </motion.div>
          )}

          {activeTab === 'menu' && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {menuItems.length === 0 ? (
                  <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-border">
                    <Utensils className="w-12 h-12 text-border mx-auto mb-4" />
                    <p className="text-text-muted">Chưa có món ăn nào trong thực đơn. Hãy nhấn "Thêm món mới".</p>
                  </div>
                ) : (
                  menuItems.map((item) => (
                    <div key={item.id} className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm group hover:border-accent transition-all">
                      <div className="aspect-video bg-bg relative overflow-hidden">
                        {item.imageUrls && item.imageUrls.length > 0 ? (
                          <div className="w-full h-full flex">
                            {item.imageUrls.map((url, idx) => (
                              <img 
                                key={idx} 
                                src={url} 
                                alt={item.name} 
                                className={cn(
                                  "h-full object-cover transition-all duration-500",
                                  item.imageUrls!.length === 1 ? "w-full" : "w-1/2 hover:w-full"
                                )} 
                                referrerPolicy="no-referrer"
                              />
                            ))}
                          </div>
                        ) : item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-border">
                            <Utensils size={32} />
                          </div>
                        )}
                        <div className="absolute top-3 right-3 flex gap-1">
                          {item.imageUrls && item.imageUrls.length > 1 && (
                            <span className="bg-sidebar/60 backdrop-blur-sm text-white text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase">2 Ảnh</span>
                          )}
                          <span className={cn(
                            "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                            item.available ? "bg-olive text-white" : "bg-text-muted text-white"
                          )}>
                            {item.available ? 'Đang bán' : 'Hết hàng'}
                          </span>
                        </div>
                      </div>
                      <div className="p-5">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{item.category || 'Món ăn'}</span>
                        <h3 className="font-bold text-text-main mt-1">{item.name}</h3>
                        <p className="text-text-muted text-xs mt-1 line-clamp-2">{item.description}</p>
                        <div className="mt-4 flex justify-between items-center">
                          <span className="text-olive font-bold">{formatCurrency(item.price)}</span>
                          {userRole === 'owner' ? (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setEditingItem(item)}
                                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-text-muted hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-all"
                              >
                                <Pencil size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteItem(item.id)}
                                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-text-muted hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ) : (
                            <button className="text-border group-hover:text-accent transition-colors">
                              <ChevronRight size={20} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'staff' && userRole === 'owner' && (
            <motion.div
              key="staff"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-text-main">Danh sách nhân viên</h3>
                <button
                  onClick={() => setIsAddingStaff(true)}
                  className="bg-olive text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-olive/90 transition-all text-sm"
                >
                  <Plus size={18} /> Thêm nhân viên
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {staffList.length === 0 ? (
                  <div className="col-span-full py-10 text-center bg-white rounded-2xl border border-border">
                    <Users className="w-10 h-10 text-border mx-auto mb-2" />
                    <p className="text-text-muted">Chưa có nhân viên nào</p>
                  </div>
                ) : (
                  staffList.map((staff) => (
                    <div key={staff.uid} className="bg-white p-4 rounded-xl border border-border flex justify-between items-center">
                      <div>
                        <div className="font-bold text-text-main">{staff.phone}</div>
                        <div className="text-xs text-text-muted uppercase tracking-wider font-bold">
                          {staff.role === 'cashier' ? 'Thu ngân' : 'Phục vụ'}
                        </div>
                      </div>
                      <button className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all">
                        <X size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
          {activeTab === 'management' && userRole === 'owner' && (
            <motion.div
              key="management"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white p-8 rounded-2xl border border-border shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-text-main">Quản lý & Báo cáo</h3>
                  {restaurant?.plan !== 'pro' && (
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Yêu cầu bản PRO</span>
                  )}
                </div>
                
                {restaurant?.plan === 'pro' ? (
                  <div className="space-y-8">
                    {/* Tổng quan */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-6 bg-bg rounded-xl border border-border">
                        <div className="text-sm font-bold text-text-muted mb-2 uppercase">Tổng doanh thu</div>
                        <div className="text-2xl font-bold text-olive">
                          {formatCurrency(orders.filter(o => o.status === 'paid' || o.status === 'completed' || o.status === 'archived').reduce((acc, o) => acc + o.total, 0))}
                        </div>
                      </div>
                      <div className="p-6 bg-bg rounded-xl border border-border">
                        <div className="text-sm font-bold text-text-muted mb-2 uppercase">Tổng số đơn</div>
                        <div className="text-2xl font-bold text-text-main">
                          {orders.filter(o => o.status === 'paid' || o.status === 'completed' || o.status === 'archived').length}
                        </div>
                      </div>
                      <div className="p-6 bg-bg rounded-xl border border-border">
                        <div className="text-sm font-bold text-text-muted mb-2 uppercase">Món bán chạy</div>
                        <div className="text-lg font-bold text-text-main">Đang cập nhật...</div>
                      </div>
                    </div>

                    {/* Doanh thu chi tiết */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Doanh thu theo tuần (Tháng hiện tại) */}
                      <div>
                        <h4 className="text-sm font-bold text-text-muted uppercase mb-4">Doanh thu theo tuần (Tháng {new Date().getMonth() + 1})</h4>
                        <div className="space-y-3">
                          {[1, 2, 3, 4].map(week => {
                            const weekRevenue = orders
                              .filter(o => o.status === 'paid' || o.status === 'completed' || o.status === 'archived')
                              .filter(o => {
                                if (!o.createdAt) return false;
                                const date = o.createdAt.toDate();
                                const currentMonth = new Date().getMonth();
                                const currentYear = new Date().getFullYear();
                                if (date.getMonth() !== currentMonth || date.getFullYear() !== currentYear) return false;
                                const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
                                const offsetDate = date.getDate() + firstDay - 1;
                                const w = Math.floor(offsetDate / 7) + 1;
                                return w === week || (week === 4 && w > 4); // Group week 5 into week 4
                              })
                              .reduce((acc, o) => acc + o.total, 0);
                            
                            return (
                              <div key={week} className="flex justify-between items-center p-3 bg-bg rounded-lg">
                                <span className="font-medium text-text-main">Tuần {week}</span>
                                <span className="font-bold text-olive">{formatCurrency(weekRevenue)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Doanh thu theo tháng (Năm hiện tại) */}
                      <div>
                        <h4 className="text-sm font-bold text-text-muted uppercase mb-4">Doanh thu theo tháng (Năm {new Date().getFullYear()})</h4>
                        <div className="space-y-3 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                          {Array.from({ length: 12 }).map((_, i) => {
                            const monthRevenue = orders
                              .filter(o => o.status === 'paid' || o.status === 'completed' || o.status === 'archived')
                              .filter(o => {
                                if (!o.createdAt) return false;
                                const date = o.createdAt.toDate();
                                return date.getMonth() === i && date.getFullYear() === new Date().getFullYear();
                              })
                              .reduce((acc, o) => acc + o.total, 0);
                            
                            if (monthRevenue === 0 && i > new Date().getMonth()) return null; // Hide future months
                            
                            return (
                              <div key={i} className="flex justify-between items-center p-3 bg-bg rounded-lg">
                                <span className="font-medium text-text-main">Tháng {i + 1}</span>
                                <span className="font-bold text-olive">{formatCurrency(monthRevenue)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BarChart3 size={32} />
                    </div>
                    <h4 className="text-lg font-bold text-text-main mb-2">Tính năng dành cho bản PRO</h4>
                    <p className="text-text-muted mb-6 max-w-md mx-auto">
                      Nâng cấp lên bản PRO để xem báo cáo doanh thu chi tiết theo tuần, tháng, năm và các phân tích chuyên sâu khác.
                    </p>
                    <button 
                      onClick={() => setIsUpgradingPlan(true)}
                      className="bg-amber-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-600 transition-colors"
                    >
                      Nâng cấp ngay
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'qr' && (
            <motion.div
              key="qr"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col lg:flex-row gap-10 items-start"
            >
              <div className="flex-1 bg-white rounded-3xl border border-border p-10 shadow-sm">
                <div className="mb-8">
                  <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-3">Chọn số bàn để tạo mã QR</label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: numTables }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedTable((i + 1).toString())}
                        className={cn(
                          "w-10 h-10 rounded-lg border font-bold text-xs transition-all",
                          selectedTable === (i + 1).toString() 
                            ? "bg-olive text-white border-olive" 
                            : "bg-white text-text-muted border-border hover:border-accent"
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-center">
                  <div className="bg-bg p-8 rounded-2xl inline-block mb-8 border border-border">
                    <QRCodeSVG id="qr-code-svg" value={`${qrUrl}&table=${selectedTable}`} size={200} level="H" includeMargin />
                  </div>
                  <h3 className="text-xl font-serif text-text-main mb-2">Mã QR Bàn số {selectedTable}</h3>
                  <p className="text-text-muted text-sm mb-8">Khách hàng quét mã này sẽ tự động được nhận diện tại bàn {selectedTable}.</p>
                  <div className="flex gap-4 justify-center">
                    <button 
                      onClick={() => window.open(`${qrUrl}&table=${selectedTable}`, '_blank')}
                      className="bg-olive text-white px-6 py-3 rounded-xl font-bold hover:bg-olive/90 transition-colors shadow-lg shadow-olive/10 text-sm"
                    >
                      Thử Menu Bàn {selectedTable}
                    </button>
                    <button 
                      onClick={downloadQR}
                      className="bg-white border border-border text-text-main px-6 py-3 rounded-xl font-bold hover:bg-bg transition-colors text-sm"
                    >
                      Tải xuống QR
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <p className="text-[11px] uppercase tracking-widest text-text-muted mb-6 font-bold">Xem trước Web-App (Bàn {selectedTable})</p>
                <div className="w-[280px] h-[580px] bg-sidebar rounded-[40px] p-2 border-[8px] border-zinc-800 shadow-2xl relative overflow-hidden">
                  <div className="w-full h-full bg-white rounded-[30px] overflow-hidden flex flex-col">
                    <div className="h-24 bg-olive flex flex-col items-center justify-center text-white p-4 pt-8">
                      <h4 className="font-serif text-sm">{restaurant?.name}</h4>
                      <p className="text-[8px] opacity-70 uppercase tracking-widest mt-1">Quét - Chọn - Thưởng thức</p>
                    </div>
                    <div className="flex-1 p-4 space-y-4">
                      {[1,2,3].map(i => (
                        <div key={i} className="flex gap-3">
                          <div className="w-12 h-12 bg-bg rounded-lg"></div>
                          <div className="flex-1">
                            <div className="h-2 bg-border rounded w-3/4 mb-2"></div>
                            <div className="h-1.5 bg-border rounded w-1/2"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-4">
                      <div className="bg-sidebar text-white text-[10px] py-2 rounded-full text-center font-bold">
                        Đang xem: Bàn số {selectedTable}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="mt-6 text-xs text-olive font-bold cursor-pointer hover:underline">In mã QR cho Bàn {selectedTable} →</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-sidebar/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl border border-border max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-serif text-text-main mb-6">Chỉnh sửa món</h3>
            <form onSubmit={handleUpdateItem} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Tên món</label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none bg-bg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Giá (VND)</label>
                  <input
                    type="number"
                    required
                    value={editingItem.price}
                    onChange={e => setEditingItem({...editingItem, price: Number(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none bg-bg text-sm"
                  />
                </div>
                <div className="relative">
                  <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Danh mục</label>
                  <div className="relative">
                    <select
                      value={editingItem.category}
                      onChange={e => setEditingItem({...editingItem, category: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none bg-bg text-sm appearance-none cursor-pointer pr-10"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none rotate-90" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Mô tả</label>
                <textarea
                  value={editingItem.description}
                  onChange={e => setEditingItem({...editingItem, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none bg-bg text-sm h-20 resize-none"
                />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="available"
                  checked={editingItem.available}
                  onChange={e => setEditingItem({...editingItem, available: e.target.checked})}
                  className="w-4 h-4 text-olive bg-bg border-border rounded focus:ring-olive"
                />
                <label htmlFor="available" className="text-sm font-medium text-text-main">
                  Đang bán (Hiển thị trên menu)
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 px-4 py-3 rounded-xl border border-border text-text-main font-bold hover:bg-bg transition-colors text-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl bg-olive text-white font-bold hover:bg-olive/90 transition-colors text-sm"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Item Modal */}
      {isAddingItem && (
        <div className="fixed inset-0 bg-sidebar/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl border border-border max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-serif text-text-main mb-6">Thêm món mới</h3>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Tên món</label>
                <input
                  type="text"
                  required
                  value={newItem.name}
                  onChange={e => setNewItem({...newItem, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none bg-bg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Giá (VND)</label>
                  <input
                    type="number"
                    required
                    value={newItem.price}
                    onChange={e => setNewItem({...newItem, price: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none bg-bg text-sm"
                  />
                </div>
                <div className="relative">
                  <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Danh mục</label>
                  <div className="relative">
                    <select
                      value={newItem.category}
                      onChange={e => setNewItem({...newItem, category: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none bg-bg text-sm appearance-none cursor-pointer pr-10"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none rotate-90" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Mô tả</label>
                <textarea
                  value={newItem.description}
                  onChange={e => setNewItem({...newItem, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none bg-bg text-sm h-20 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[0, 1].map((idx) => (
                  <div key={idx}>
                    <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Ảnh {idx + 1}</label>
                    {!newItem.imageUrls[idx] ? (
                      <label className={cn(
                        "flex flex-col items-center justify-center w-full aspect-video rounded-xl border-2 border-dashed border-border bg-bg cursor-pointer hover:border-accent hover:bg-white transition-all group relative overflow-hidden",
                        isUploading === idx && "opacity-50 cursor-not-allowed"
                      )}>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, idx)}
                          disabled={isUploading !== null}
                        />
                        {isUploading === idx ? (
                          <Loader2 size={24} className="animate-spin text-olive" />
                        ) : (
                          <>
                            <div className="flex gap-3 mb-2">
                              <div className="w-10 h-10 rounded-full bg-bg flex items-center justify-center text-text-muted group-hover:text-olive group-hover:bg-olive/10 transition-all">
                                <Camera size={20} />
                              </div>
                              <div className="w-10 h-10 rounded-full bg-bg flex items-center justify-center text-text-muted group-hover:text-olive group-hover:bg-olive/10 transition-all">
                                <ImageIcon size={20} />
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-text-muted group-hover:text-olive transition-colors uppercase tracking-widest">Chụp hoặc Tải ảnh</span>
                          </>
                        )}
                      </label>
                    ) : (
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border bg-bg group">
                        <img src={newItem.imageUrls[idx]} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-sidebar/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button 
                            type="button"
                            onClick={() => {
                              const urls = [...newItem.imageUrls];
                              urls[idx] = '';
                              setNewItem({...newItem, imageUrls: urls});
                            }}
                            className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-colors shadow-lg"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingItem(false)}
                  className="flex-1 py-3 rounded-xl border border-border text-text-muted font-bold hover:bg-bg transition-colors text-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-olive text-white font-bold hover:bg-olive/90 transition-colors shadow-lg shadow-olive/10 text-sm"
                >
                  Lưu món
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Upgrade Plan Modal */}
      {isUpgradingPlan && (
        <div className="fixed inset-0 bg-sidebar/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl border border-border"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-soft-clay/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <QrCode size={32} className="text-sidebar" />
              </div>
              <h3 className="text-2xl font-serif text-text-main mb-2">Nâng cấp lên bản PRO</h3>
              <p className="text-text-muted text-sm">Mở khóa toàn bộ tính năng cao cấp cho nhà hàng của bạn.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 rounded-2xl border border-border bg-bg">
                <h4 className="font-bold text-text-main text-sm mb-3">Tiêu chuẩn</h4>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-[11px] text-text-muted">
                    <Check size={12} className="text-emerald-500" /> Full tính năng bàn/QR
                  </li>
                  <li className="flex items-center gap-2 text-[11px] text-text-muted">
                    <Check size={12} className="text-emerald-500" /> Quản lý đơn hàng
                  </li>
                  <li className="flex items-center gap-2 text-[11px] text-text-muted opacity-50">
                    <X size={12} className="text-red-500" /> Báo cáo doanh thu
                  </li>
                </ul>
                <div className="mt-4 text-lg font-bold text-text-main">99.000đ<span className="text-[10px] font-normal text-text-muted">/tháng</span></div>
              </div>
              <div className="p-4 rounded-2xl border-2 border-soft-clay bg-soft-clay/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-soft-clay text-sidebar text-[8px] font-bold px-2 py-1 rounded-bl-lg uppercase">Khuyên dùng</div>
                <h4 className="font-bold text-text-main text-sm mb-3">PRO Full</h4>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-[11px] text-text-main font-medium">
                    <Check size={12} className="text-emerald-500" /> Full tính năng bàn/QR
                  </li>
                  <li className="flex items-center gap-2 text-[11px] text-text-main font-medium">
                    <Check size={12} className="text-emerald-500" /> Báo cáo doanh thu (Ngày/Tháng)
                  </li>
                  <li className="flex items-center gap-2 text-[11px] text-text-main font-medium">
                    <Check size={12} className="text-emerald-500" /> Phân tích theo bàn
                  </li>
                  <li className="flex items-center gap-2 text-[11px] text-text-main font-medium">
                    <Check size={12} className="text-emerald-500" /> Hỗ trợ ưu tiên
                  </li>
                </ul>
                <div className="mt-4 text-lg font-bold text-text-main">145.000đ<span className="text-[10px] font-normal text-text-muted">/tháng</span></div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setIsUpgradingPlan(false)}
                className="flex-1 py-3 rounded-xl border border-border text-text-muted font-bold hover:bg-bg transition-colors text-sm"
              >
                Để sau
              </button>
              <button
                onClick={upgradePlan}
                className="flex-1 py-3 rounded-xl bg-sidebar text-white font-bold hover:bg-sidebar/90 transition-colors shadow-lg shadow-sidebar/10 text-sm"
              >
                Nâng cấp ngay
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Add Staff Modal */}
      {isAddingStaff && (
        <div className="fixed inset-0 bg-sidebar/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl border border-border"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-serif text-text-main italic">Thêm nhân viên mới</h3>
              <button onClick={() => setIsAddingStaff(false)} className="p-2 hover:bg-bg rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Số điện thoại đăng nhập</label>
                <input
                  type="tel"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none transition-all bg-bg text-sm"
                  placeholder="09xx xxx xxx"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Mật khẩu</label>
                <input
                  type="password"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none transition-all bg-bg text-sm"
                  placeholder="••••••••"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Vai trò</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as UserRole })}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:border-accent outline-none transition-all bg-bg text-sm appearance-none"
                >
                  <option value="cashier">Thu ngân</option>
                  <option value="waiter">Nhân viên phục vụ</option>
                </select>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-olive text-white font-bold py-3.5 rounded-xl hover:bg-olive/90 transition-all shadow-lg shadow-olive/10 text-sm"
                >
                  Xác nhận thêm
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
