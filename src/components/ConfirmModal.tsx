import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'হ্যাঁ, নিশ্চিত করুন',
  cancelText = 'বাতিল',
  isDanger = true,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm overflow-hidden p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isDanger ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">{message}</p>

        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-200 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-white text-xs font-semibold rounded-xl transition-all shadow-sm ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-teal-700 hover:bg-teal-800'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
