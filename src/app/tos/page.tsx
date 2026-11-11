import { LegalPage } from "@/components/legal-page";
import { TERMS } from "@/lib/legal";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `Terms of Service | ${BRAND}` };

export default function Page() {
  return (
    <LegalPage
      title={
        <>
          Terms and Conditions for
          <br className="hidden sm:inline" /> {BRAND}
        </>
      }
      blocks={TERMS}
    />
  );
}
