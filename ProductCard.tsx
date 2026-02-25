import React from 'react';
import { Product } from '../types';
import { Lock } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAdd }) => {
  const isOutOfStock = product.stock_quantity <= 0;

  return (
    <div 
      onClick={() => !isOutOfStock && onAdd(product)}
      className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-shadow duration-200 flex flex-col h-full relative ${
        isOutOfStock 
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:shadow-md'
      }`}
    >
      {isOutOfStock && (
        <div className="absolute inset-0 bg-gray-500/30 flex items-center justify-center z-10">
          <Lock className="text-white h-12 w-12" />
        </div>
      )}
      <div className="h-32 w-full bg-gray-100 relative">
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            لا توجد صورة
          </div>
        )}
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-emerald-600 shadow-sm">
          {product.price.toFixed(2)} ج.م / {product.unit === 'kg' ? 'كجم' : 'حبة'}
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col justify-between">
        <h3 className="font-semibold text-gray-800 text-sm mb-1">{product.name}</h3>
        <p className="text-xs text-gray-500">الباركود: {product.barcode}</p>
      </div>
    </div>
  );
};
