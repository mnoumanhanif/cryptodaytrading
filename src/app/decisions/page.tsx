import AuthGuard from '@/components/AuthGuard';
import AiDecisionBoard from '@/components/AiDecisionBoard';

export default function DecisionsPage() {
  return (
    <AuthGuard>
      <AiDecisionBoard />
    </AuthGuard>
  );
}
