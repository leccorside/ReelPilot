import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { buttonClass } from "./button";

export type Block =
  | { h1: string }
  | { h2: string }
  | { h3: string }
  | { p: string }
  | { ul: string[] }
  | { ol: string[] }
  | { contact: [string, string] }
  | { updated: string };

export function LegalPage({ title, blocks }: { title: ReactNode; blocks: Block[] }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <SiteHeader />
      {/* Same frame as the original: a 672px column 64px below the fixed header, 20px inside. */}
      <main className="max-w-2xl mx-auto mt-16">
        <div className="p-5">
          <Link href="/" className={buttonClass("ghost", "default", "!gap-0.5")}>
            <ArrowLeft className="h-5 w-5" />
            Back
          </Link>
          <h1 className="font-heading text-3xl font-extrabold pb-6 text-center m-10 text-balance">{title}</h1>
          <article className="prose max-w-none mb-10 prose-headings:font-heading prose-a:font-medium">
            {blocks.map((b, i) => {
              if ("h1" in b) return <h1 key={i}>{b.h1}</h1>;
              if ("h2" in b) return <h2 key={i}>{b.h2}</h2>;
              if ("h3" in b) return <h3 key={i}>{b.h3}</h3>;
              if ("ul" in b)
                return (
                  <ul key={i}>
                    {b.ul.map((li) => (
                      <li key={li}>{li}</li>
                    ))}
                  </ul>
                );
              if ("ol" in b)
                return (
                  <ol key={i}>
                    {b.ol.map((li) => (
                      <li key={li}>{li}</li>
                    ))}
                  </ol>
                );
              if ("contact" in b)
                return (
                  <p key={i}>
                    {b.contact[0]} <Link href="/contact/">Contact Page</Link>
                    {b.contact[1]}
                  </p>
                );
              if ("updated" in b)
                return (
                  <div key={i}>
                    <hr />
                    <p>
                      <em>{b.updated}</em>
                    </p>
                  </div>
                );
              return <p key={i}>{b.p}</p>;
            })}
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
