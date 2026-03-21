import { PaymentsSummary } from '@/components/payments/PaymentsSummary';
import { PaymentsTable } from '@/components/payments/PaymentsTable';

export default function PaymentsPage() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments &amp; Finance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Read-only ledger of all recorded payments
        </p>
      </div>

      {/* Summary stats + method breakdown */}
      <PaymentsSummary />

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Payment history section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Payment History</h2>
        <PaymentsTable />
      </div>
    </div>
  );
}
