export interface Restaurant {
  id: string;
  name: string;
  ownerUid: string;
  address?: string;
  plan: 'standard' | 'pro';
  trialEndsAt: any;
  createdAt: any;
  isSessionActive?: boolean;
  sessionStartTime?: any;
}

export type UserRole = 'owner' | 'cashier' | 'waiter' | 'superadmin';

export interface UserProfile {
  uid: string;
  phone: string;
  role: UserRole;
  restaurantId?: string;
  ownerPhone?: string;
  name?: string;
  cccd?: string;
  dob?: string;
  address?: string;
  createdAt: any;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  imageUrl?: string;
  imageUrls?: string[];
  available: boolean;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export type OrderStatus = 'pending' | 'cooking' | 'ready' | 'served' | 'paid';

export interface Order {
  id: string;
  restaurantId: string;
  tableNumber: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: any;
}
