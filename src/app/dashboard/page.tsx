import AuthGuard from '@/components/AuthGuard';
import Dashboard from '@/components/Dashboard';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}
