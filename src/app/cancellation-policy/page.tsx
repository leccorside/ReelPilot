import { LegalPage } from "@/components/legal-page";
import { CANCELLATION } from "@/lib/legal";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `Cancellation Policy | ${BRAND}` };

export default function Page() {
  return <LegalPage title={`Cancellation Policy for ${BRAND}`} blocks={CANCELLATION} />;
}
