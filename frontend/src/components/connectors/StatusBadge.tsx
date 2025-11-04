import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

interface StatusBadgeProps {
  status?: string | null;
  isExtracting?: boolean;
}

export default function StatusBadge({ status, isExtracting }: StatusBadgeProps) {
  if (isExtracting) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Extracting...
      </span>
    );
  }

  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle className="w-3.5 h-3.5" />
        Success
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle className="w-3.5 h-3.5" />
        Failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      <Clock className="w-3.5 h-3.5" />
      Never run
    </span>
  );
}
