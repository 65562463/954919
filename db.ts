import Dexie, { Table } from 'dexie';
import { Product, Category, Branch, User, Order } from '../types';

export interface SyncOperation {
  id?: number;
  type: 'order' | 'waste' | 'purchase' | 'transfer';
  data: any;
  timestamp: number;
}

export class PosDatabase extends Dexie {
  products!: Table<Product, number>;
  categories!: Table<Category, number>;
  branches!: Table<Branch, number>;
  users!: Table<User, number>;
  syncQueue!: Table<SyncOperation, number>;

  constructor() {
    super('PosDatabase');
    this.version(1).stores({
      products: 'id, category_id, barcode',
      categories: 'id',
      branches: 'id',
      users: 'id, pin',
      syncQueue: '++id, type, timestamp'
    });
  }
}

export const db = new PosDatabase();
