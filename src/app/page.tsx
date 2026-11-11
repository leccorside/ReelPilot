import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Examples, Hero } from "@/components/landing/hero";
import { Views } from "@/components/landing/views";
import { Alternatives, HowItWorks, Testimonials } from "@/components/landing/sections";
import { Faq, SeeItInAction } from "@/components/landing/demo-faq";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <SiteHeader />
      <div className="flex flex-col min-h-screen bg-background">
        <Hero />
        <Examples />
        <Views />
        <Alternatives />
        <Testimonials />
        <HowItWorks />
        <SeeItInAction />
        <Faq />
      </div>
      <SiteFooter />
    </div>
  );
}
