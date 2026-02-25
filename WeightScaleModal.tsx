import React, { useState, useEffect } from 'react';
import { X, Scale, Check } from 'lucide-react';
import { Product } from '../types';

interface WeightScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onConfirm: (weight: number) => void;
}

export const WeightScaleModal: React.FC<WeightScaleModalProps> = ({ isOpen, onClose, product, onConfirm }) => {
  const [weight, setWeight] = useState<string>('');
  const [isReading, setIsReading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setWeight('');
      setIsReading(false);
    }
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const handleReadScale = () => {
    setIsReading(true);
    // Simulate reading from an electronic scale
    setTimeout(() => {
      // Generate a random weight between 0.5 and 3.5 kg for simulation
      const simulatedWeight = (Math.random() * 3 + 0.5).toFixed(3);
      setWeight(simulatedWeight);
      setIsReading(false);
    }, 1500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numWeight = parseFloat(weight);
    if (!isNaN(numWeight) && numWeight > 0) {
      onConfirm(numWeight);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Scale className="text-emerald-600" size={24} />
            قراءة الميزان
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <div className="text-center mb-6">
            <h3 className="text-lg font-bold text-gray-800">{product.name}</h3>
            <p className="text-sm text-gray-500">{product.price.toFixed(2)} ج.م / كجم</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الوزن (كجم)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 text-2xl text-center font-bold border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  placeholder="0.000"
                  autoFocus
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-500 font-medium">كجم</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleReadScale}
                disabled={isReading}
                className="bg-blue-50 text-blue-600 border border-blue-200 py-3 rounded-xl font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Scale size={20} />
                {isReading ? 'جاري القراءة...' : 'قراءة من الميزان'}
              </button>
              <button
                type="submit"
                disabled={!weight || parseFloat(weight) <= 0}
                className="bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={20} />
                تأكيد وإضافة
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
