import { toast } from '@/hooks/use-toast';
import { errMsg } from './format';
export const ok = (title: string, description?: string) => toast({ title, description });
export const fail = (e: unknown, title = 'تعذر تنفيذ العملية') => toast({ variant: 'destructive', title, description: errMsg(e) });
