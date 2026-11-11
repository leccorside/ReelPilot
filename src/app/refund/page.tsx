import { LegalPage } from "@/components/legal-page";
import { REFUND } from "@/lib/legal";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `Refund Policy | ${BRAND}` };

export default function Page() {
  return <LegalPage title={`Refund Policy for ${BRAND}`} blocks={REFUND} />;
}
