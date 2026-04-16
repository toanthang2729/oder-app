import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, getDoc, where } from 'firebase/firestore';
import { Restaurant, MenuItem, OrderItem, Order } from '../types';
import { ShoppingBag, Utensils, Plus, Minus, ChevronRight, CheckCircle2, Loader2, BellRing, Receipt } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function CustomerMenu({ restaurantId, tableNumber }: { restaurantId: string, tableNumber: string }) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [callSuccess, setCallSuccess] = useState(false);
  const [tableOrders, setTableOrders] = useState<Order[]>([]);

  useEffect(() => {
    // Fetch restaurant info
    const fetchRestaurant = async () => {
      const docRef = doc(db, 'restaurants', restaurantId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setRestaurant({ id: docSnap.id, ...docSnap.data() } as Restaurant);
      }
    };

    // Fetch menu items
    const q = query(collection(db, 'restaurants', restaurantId, 'menuItems'));
    const unsubscribeMenu = onSnapshot(q, (snapshot) => {
      setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem)));
      setLoading(false);
    });

    // Fetch active orders for this table
    const ordersQ = query(
      collection(db, 'restaurants', restaurantId, 'orders'),
      where('tableNumber', '==', tableNumber)
    );
    const unsubscribeOrders = onSnapshot(ordersQ, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setTableOrders(fetchedOrders);
    });

    fetchRestaurant();
    return () => {
      unsubscribeMenu();
      unsubscribeOrders();
    };
  }, [restaurantId, tableNumber]);

  const addToCart = (itemId: string) => {
    setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[itemId] > 1) {
        newCart[itemId] -= 1;
      } else {
        delete newCart[itemId];
      }
      return newCart;
    });
  };

  const cartTotal = Object.entries(cart).reduce((total, [itemId, quantity]) => {
    const item = menuItems.find(i => i.id === itemId);
    return total + (item?.price || 0) * (quantity as number);
  }, 0);

  const cartCount: number = (Object.values(cart) as number[]).reduce((a, b) => a + b, 0);

  const placeOrder = async () => {
    if (cartCount === 0) return;
    setIsOrdering(true);
    
    const orderItems: OrderItem[] = Object.entries(cart).map(([itemId, quantity]) => {
      const item = menuItems.find(i => i.id === itemId)!;
      return {
        id: itemId,
        name: item.name,
        price: item.price,
        quantity: quantity as number
      };
    });

    try {
      await addDoc(collection(db, 'restaurants', restaurantId, 'orders'), {
        restaurantId,
        tableNumber,
        items: orderItems,
        total: cartTotal,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setOrderSuccess(true);
      setCart({});
    } catch (error) {
      console.error("Error placing order:", error);
    } finally {
      setIsOrdering(false);
    }
  };

  const callWaiter = async () => {
    setIsCallingWaiter(true);
    try {
      // Create a special order to notify staff
      await addDoc(collection(db, 'restaurants', restaurantId, 'orders'), {
        restaurantId,
        tableNumber,
        items: [{
          id: 'call_waiter',
          name: '🛎️ GỌI PHỤC VỤ',
          price: 0,
          quantity: 1
        }],
        total: 0,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setCallSuccess(true);
      setTimeout(() => setCallSuccess(false), 5000); // Reset after 5 seconds
    } catch (error) {
      console.error("Error calling waiter:", error);
    } finally {
      setIsCallingWaiter(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (restaurant && !restaurant.isSessionActive) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-6 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-12 rounded-3xl shadow-xl shadow-zinc-200/50 border border-zinc-100 max-w-sm w-full"
        >
          <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Utensils className="w-10 h-10 text-zinc-400" />
          </div>
          <h2 className="text-2xl font-serif text-zinc-800 mb-3">Chưa tới giờ mở cửa</h2>
          <p className="text-zinc-500 mb-8 leading-relaxed">
            Nhà hàng hiện chưa bắt đầu ca làm việc. Vui lòng quay lại sau nhé!
          </p>
        </motion.div>
      </div>
    );
  }

  if (orderSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-6 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-12 rounded-3xl shadow-xl shadow-zinc-200/50 border border-zinc-100 max-w-sm w-full"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="text-emerald-500 w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Đặt món thành công!</h2>
          <p className="text-zinc-500 mb-8">Đơn hàng của bạn đã được gửi đến nhà bếp. Vui lòng đợi trong giây lát.</p>
          <button
            onClick={() => setOrderSuccess(false)}
            className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl hover:bg-orange-600 transition-colors"
          >
            Tiếp tục gọi món
          </button>
        </motion.div>
      </div>
    );
  }

  const categories = ['Tất cả', ...Array.from(new Set(menuItems.map(item => item.category || 'Khác')))];

  const filteredItems = selectedCategory === 'Tất cả' 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  return (
    <div className="min-h-screen bg-bg pb-32">
      {/* Header */}
      <header className="bg-olive border-b border-white/10 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-6 py-6 flex justify-between items-center text-white">
          <div>
            <h1 className="text-xl font-serif">{restaurant?.name || 'Order APP'}</h1>
            <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mt-1">Bàn {tableNumber}</p>
          </div>
          <button 
            onClick={callWaiter}
            disabled={isCallingWaiter || callSuccess}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm",
              callSuccess 
                ? "bg-emerald-500 text-white" 
                : "bg-white text-olive hover:bg-bg"
            )}
          >
            {isCallingWaiter ? (
              <Loader2 size={16} className="animate-spin" />
            ) : callSuccess ? (
              <CheckCircle2 size={16} />
            ) : (
              <BellRing size={16} />
            )}
            {callSuccess ? 'Đã gọi' : 'Gọi phục vụ'}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Categories */}
        <div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "whitespace-nowrap px-6 py-2 rounded-full border text-sm font-bold transition-all",
                selectedCategory === cat 
                  ? "bg-olive text-white border-olive shadow-lg shadow-olive/20" 
                  : "bg-white border-border text-text-muted hover:border-accent hover:text-accent"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Menu Items */}
        <div className="space-y-4">
          {filteredItems.map(item => (
            <motion.div
              layout
              key={item.id}
              className="bg-white rounded-2xl border border-border p-4 flex gap-4 shadow-sm"
            >
              <div className="w-24 h-24 bg-bg rounded-xl overflow-hidden flex-shrink-0 relative">
                {item.imageUrls && item.imageUrls.length > 0 ? (
                  <img src={item.imageUrls[0]} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-border">
                    <Utensils size={24} />
                  </div>
                )}
                {item.imageUrls && item.imageUrls.length > 1 && (
                  <div className="absolute bottom-1 right-1 bg-sidebar/60 backdrop-blur-sm text-white text-[6px] px-1 py-0.5 rounded-sm font-bold uppercase">
                    +1 Ảnh
                  </div>
                )}
              </div>
              <div className="flex-1 flex flex-col justify-between py-1">
                <div>
                  <h3 className="font-bold text-text-main text-sm">{item.name}</h3>
                  <p className="text-text-muted text-[11px] mt-1 line-clamp-2">{item.description}</p>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-olive font-bold">{formatCurrency(item.price)}</span>
                  <div className="flex items-center gap-3">
                    {(cart[item.id] || 0) > 0 && (
                      <>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-text-muted hover:bg-bg"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="font-bold text-text-main w-4 text-center text-sm">{cart[item.id]}</span>
                      </>
                    )}
                    <button
                      onClick={() => addToCart(item.id)}
                      className="w-8 h-8 rounded-full bg-olive flex items-center justify-center text-white shadow-lg shadow-olive/10 hover:bg-olive/90"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Cart Bar */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-8 left-6 right-6 z-40"
          >
            <div className="max-w-2xl mx-auto">
              <button
                onClick={placeOrder}
                disabled={isOrdering}
                className="w-full bg-sidebar text-white rounded-2xl p-4 flex items-center justify-between shadow-2xl hover:bg-sidebar/95 transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-olive text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold">
                    {cartCount}
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Xem giỏ hàng</p>
                    <p className="font-bold">{formatCurrency(cartTotal)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-bold text-sm">
                  {isOrdering ? 'Đang gửi...' : 'Đặt món ngay'}
                  <ChevronRight size={18} />
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
