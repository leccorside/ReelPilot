import { LegalPage } from "@/components/legal-page";
import { PRIVACY } from "@/lib/legal";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `Privacy Policy | ${BRAND}` };

export default function Page() {
  return <LegalPage title={`Privacy policy for ${BRAND}`} blocks={PRIVACY} />;
}
