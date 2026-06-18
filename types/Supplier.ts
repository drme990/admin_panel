export interface Supplier {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  status: 'active' | 'inactive';
  totalOrders?: number;
  totalPayouts?: number;
  balance?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SupplierOrder {
  _id: string;
  supplierId: string;
  items: SupplierOrderItem[];
  totalAmount: number;
  orderDate: string;
  notes?: string;
  status: 'pending' | 'received' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPayout {
  _id: string;
  supplierId: string;
  amount: number;
  accountId?: string;
  account?: { name: string; currency: string; type: string };
  date: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
