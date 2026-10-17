'use client';

import { useParams } from 'next/navigation';
import { InvitationView } from '@/components/invitations/InvitationView';

// Public on purpose (no AppShell, no session, not in the middleware matcher): the secret token in the address is the access control.
export default function InvitationPage() {
  const params = useParams<{ token: string }>();
  return <InvitationView token={params.token} />;
}
