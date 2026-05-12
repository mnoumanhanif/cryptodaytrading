import AuthGuard from '@/components/AuthGuard';
import HighOpportunityBoard from '@/components/HighOpportunityBoard';

export default function OpportunitiesPage() {
  return (
    <AuthGuard adminOnly>
      <HighOpportunityBoard />
    </AuthGuard>
  );
}
