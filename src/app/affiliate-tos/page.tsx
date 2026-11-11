import { LegalPage } from "@/components/legal-page";
import { AFFILIATE } from "@/lib/legal";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `Affiliate Terms | ${BRAND}` };

export default function Page() {
  return <LegalPage title={`Affiliate Terms for ${BRAND}`} blocks={AFFILIATE} />;
}
