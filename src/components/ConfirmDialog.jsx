import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) {
  // Close with Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-library-ink/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-parchment border border-coffee-cream/20 shadow-cozy rounded-sm p-6 max-w-md w-full animate-fade-in-up relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 text-coffee-cream/50 hover:text-maple-rust transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <span className="p-2.5 bg-maple-rust/10 rounded-sm">
            <AlertTriangle size={18} className="text-maple-rust" />
          </span>
          <h3 className="font-display text-xl text-yale-blue">{title}</h3>
        </div>

        <div className="font-body text-sm text-coffee-cream leading-relaxed mb-6">
          {message}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 border border-coffee-cream/30 rounded-sm font-label text-xs uppercase tracking-wider text-coffee-cream hover:bg-coffee-cream/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2.5 bg-maple-rust text-page-cream rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}