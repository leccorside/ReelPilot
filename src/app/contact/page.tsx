import { Building2, FileText, Mail, MapPin } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BRAND, COMPANY, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata = { title: `Contact | ${BRAND}` };

function Card({ icon: Icon, title, children, className = "" }: { icon: typeof Mail; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border bg-white/80 text-card-foreground shadow-sm p-6 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function ContactPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <SiteHeader />
      <main className="container mx-auto max-w-4xl px-4 pt-28 pb-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">We&apos;re here to help with any questions or concerns you may have about our services.</p>
        </div>
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card icon={Building2} title="Legal Information">
              <div className="space-y-2">
                <p>{COMPANY}</p>
                <p>Company ID: 00000000</p>
              </div>
            </Card>
            <Card icon={MapPin} title="Address">
              <div className="space-y-2">
                <p>100 Sample Street</p>
                <p>10000 Sample City</p>
                <p>Country</p>
              </div>
            </Card>
          </div>
          <Card icon={FileText} title="Registration">
            <p>Registered in the commercial register kept by the municipal court of Sample City,<span className="hidden sm:inline"> Sample Region,</span> Section X, Insert 000000</p>
          </Card>
          <Card icon={Mail} title="Get in Touch">
            <p className="font-medium">Email</p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:underline">
              {SUPPORT_EMAIL}
            </a>
            <p className="text-sm text-muted-foreground mt-1">For general inquiries and support</p>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
