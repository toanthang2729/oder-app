import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AdminDashboard from './components/AdminDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import SuperAdminLogin from './components/SuperAdminLogin';
import CustomerMenu from './components/CustomerMenu';
import Auth from './components/Auth';
import { Loader2 } from 'lucide-react';
import { UserProfile } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Simple routing based on URL params
  const urlParams = new URLSearchParams(window.location.search);
  const restaurantId = urlParams.get('restaurantId');
  const isSuperAdminRoute = window.location.pathname === '/superadmin';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
      }
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

  // Super Admin Login Route
  if (isSuperAdminRoute) {
    if (user && userProfile?.role === 'superadmin') {
      return <SuperAdminDashboard user={user} />;
    }
    return <SuperAdminLogin />;
  }

  // Otherwise, show admin/auth
  if (!user) {
    return <Auth />;
  }

  return <AdminDashboard user={user} />;
}
