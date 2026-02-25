import React from 'react';
import { CartItem } from '../types';
import { Minus, Plus, Trash2 } from 'lucide-react';

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (productId: number, newQuantity: number) => void;
  onRemove: (productId: number) => void;
}

export const CartItemRow: React.FC<CartItemRowProps> = ({ item, onUpdateQuantity, onRemove }) => {
  const { product, quantity, total } = item;
  const isKg = product.unit === 'kg';

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0 pr-3">
        <h4 className="text-sm font-semibold text-gray-800 truncate">{product.name}</h4>
        <p className="text-xs text-gray-500 mt-0.5">
          {product.price.toFixed(2)} ج.م / {isKg ? 'كجم' : 'حبة'}
        </p>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200">
          <button 
            onClick={() => onUpdateQuantity(product.id, isKg ? quantity - 0.5 : quantity - 1)}
            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-l-lg transition-colors"
          >
            <Minus size={16} />
          </button>
          
          <span className="w-12 text-center text-sm font-medium text-gray-800">
            {quantity} {isKg ? 'كجم' : ''}
          </span>
          
          <button 
            onClick={() => onUpdateQuantity(product.id, isKg ? quantity + 0.5 : quantity + 1)}
            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-r-lg transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
        
        <div className="w-16 text-left font-semibold text-gray-800 text-sm">
          {total.toFixed(2)}
        </div>
        
        <button 
          onClick={() => onRemove(product.id)}
          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};
