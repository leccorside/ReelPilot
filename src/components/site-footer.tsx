import Link from "next/link";
import { Logo } from "./logo";
import { BRAND, COMPANY_ADDRESS, TAGLINE } from "@/lib/brand";

const link = "text-muted-foreground hover:text-foreground text-xs sm:text-sm";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container py-8 sm:py-10 md:py-12 lg:py-16 px-6 sm:px-8 md:px-10">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          <div className="space-y-3 md:space-y-4 col-span-2 sm:col-span-2 md:col-span-1">
            <Logo />
            <p className="text-muted-foreground text-xs sm:text-sm">{TAGLINE}</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2 sm:mb-4 text-sm sm:text-base">Product</h3>
            <ul className="space-y-1 sm:space-y-2">
              <li>
                <Link className={link} href="/#how-it-works">How it works</Link>
              </li>
              <li>
                <Link className={link} href="/#faq">FAQ</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2 sm:mb-4 text-sm sm:text-base">Company</h3>
            <ul className="space-y-1 sm:space-y-2">
              <li>
                <Link className={link} href="/contact/">Contact</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2 sm:mb-4 text-sm sm:text-base">Legal</h3>
            <ul className="space-y-1 sm:space-y-2">
              <li>
                <Link className={link} href="/tos/">Terms of Service</Link>
              </li>
              <li>
                <Link className={link} href="/privacy/">Privacy Policy</Link>
              </li>
              <li>
                <Link className={link} href="/refund/">Refund Policy</Link>
              </li>
              <li>
                <Link className={link} href="/cancellation-policy/">Cancellation Policy</Link>
              </li>
              <li>
                <Link className={link} href="/affiliate-tos/">Affiliate ToS</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border mt-8 sm:mt-10 md:mt-12 pt-6 sm:pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-muted-foreground text-xs sm:text-sm">© 2026 {BRAND}. All rights reserved.</p>
          <p className="text-muted-foreground text-xs sm:text-sm mt-3 md:mt-0">Made with ❤️ for creators</p>
        </div>
        <p className="text-muted-foreground text-xs mt-4 text-center md:text-left">{COMPANY_ADDRESS}</p>
      </div>
    </footer>
  );
}
