import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import AdminDashboard from './components/AdminDashboard';
import CustomerMenu from './components/CustomerMenu';
import Auth from './components/Auth';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'admin' | 'customer'>('customer');

  // Simple routing based on URL params
  const urlParams = new URLSearchParams(window.location.search);
  const restaurantId = urlParams.get('restaurantId');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // If restaurantId is in URL, show customer menu
  if (restaurantId) {
    return <CustomerMenu restaurantId={restaurantId} tableNumber={urlParams.get('table') || '1'} />;
  }

  // Otherwise, show admin/auth
  if (!user) {
    return <Auth />;
  }

  return <AdminDashboard user={user} />;
}
