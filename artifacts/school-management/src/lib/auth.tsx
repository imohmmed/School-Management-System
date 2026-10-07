import { createContext, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SchoolUser } from '@workspace/api-client-react';

export const MeContext = createContext<SchoolUser | null>(null);
export function useMe() {
  const me = useContext(MeContext);
  if (!me) throw new Error('useMe outside gate');
  return me;
}
export function usePerms() {
  const me = useMe();
  const isAdmin = me.role === 'administrator';
  const isManager = isAdmin || me.role === 'registrar';
  return { me, isAdmin, isManager, canTeach: isManager || me.role === 'teacher' };
}
export function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== '/api/me' });
}
