import { db, SyncOperation } from './db';
import { safeFetch } from './api';
import { Order } from '../types';

export const saveInvoice = async (orderData: any): Promise<{ success: boolean, orderId?: number, offline?: boolean }> => {
  if (navigator.onLine) {
    try {
      const data = await safeFetch<{ success: boolean, orderId: number }>('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      
      if (data && data.success) {
        return { success: true, orderId: data.orderId };
      }
    } catch (error) {
      console.error('Failed to send order online, saving locally', error);
      // Fallback to offline save
    }
  }

  // Offline save
  try {
    const operation: SyncOperation = {
      type: 'order',
      data: orderData,
      timestamp: Date.now()
    };
    await db.syncQueue.add(operation);
    console.log('Order saved locally for sync');
    // Generate a temporary negative ID for offline orders
    return { success: true, orderId: -Date.now(), offline: true };
  } catch (error) {
    console.error('Failed to save order locally', error);
    return { success: false };
  }
};

export const syncData = async () => {
  if (!navigator.onLine) return;

  const pendingOperations = await db.syncQueue.orderBy('timestamp').toArray();
  if (pendingOperations.length === 0) return;

  console.log(`Syncing ${pendingOperations.length} operations...`);

  for (const op of pendingOperations) {
    try {
      let success = false;
      if (op.type === 'order') {
        const data = await safeFetch<{ success: boolean }>('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(op.data)
        });
        success = !!data?.success;
      }
      // Add other types (waste, purchase, transfer) here if needed

      if (success && op.id) {
        await db.syncQueue.delete(op.id);
        console.log(`Successfully synced operation ${op.id}`);
      } else {
        console.warn(`Failed to sync operation ${op.id}, stopping sync queue.`);
        break; // Stop syncing to maintain order
      }
    } catch (error) {
      console.error(`Failed to sync operation ${op.id}`, error);
      break;
    }
  }
};
