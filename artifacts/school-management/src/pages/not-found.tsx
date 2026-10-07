import { Link } from 'wouter';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/kit';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState icon={Compass} title="الصفحة غير موجودة" text="الرابط الذي فتحته غير صحيح أو تم نقله." action={<Link href="/dashboard" className="btn btn-primary">العودة إلى لوحة التحكم</Link>} />
    </div>
  );
}
