import { Check, CirclePlay, Rocket, SquarePen, X, Star } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Avatar } from "../art";
import { Marquee } from "../marquee";
import { MiniDashboard } from "../mini-dashboard";
import { GrowthArt } from "./growth-art";

export function Alternatives() {
  const items = [
    { title: "Hiring video editors", text: "Expensive per video, plus the time spent managing and coordinating freelancers", good: false },
    { title: "Creating videos yourself", text: "Hours of scripting, recording, editing and uploading to every platform by hand", good: false },
    { title: BRAND, text: "High-quality faceless reels created and published for you on TikTok, Instagram and YouTube", good: true },
  ];
  return (
    <section className="py-10 sm:py-16 md:py-20" id="alternatives">
      <div className="container mx-auto px-6 sm:px-8 md:px-10">
        <div className="text-center mb-8 sm:mb-10 md:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4">Why creators choose us</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            See how {BRAND} compares to traditional content creation methods
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {items.map((it) => (
            <div
              key={it.title}
              className={`rounded-lg border p-4 sm:p-5 ${it.good ? "border-green-400 bg-green-50/30" : "border-red-200 bg-red-50/30"}`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-sm sm:text-base">{it.title}</h3>
                {it.good ? <Check className="h-4 w-4 text-green-500 flex-shrink-0" /> : <X className="h-4 w-4 text-red-400 flex-shrink-0" />}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">{it.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const REVIEWS = [
  ["Jordan Miles", "Love it. It makes posting easy on days when I can't come up with an idea."],
  ["Nora Bell", "The videos look great and keep my audience engaged. I barely have to think about content anymore, which is exactly what I needed to keep growing."],
  ["Chris Dale", "Lots of styles and story ideas to pick from. My views and followers went up and are still climbing."],
  ["Studio North", "Simple to use and the stories are fun. A great way to start creating content without all the busywork."],
  ["Liam Earl", "Very productive tool, and the team listens to feedback."],
  ["Amy Chen", "Good choice if you are just starting out as a creator."],
  ["Josh Wright", "It has been great. My page grew a lot!"],
  ["Tom Ateb", "Perfect if you want to tell stories without showing your face."],
];

function Review({ name, text, index }: { name: string; text: string; index: number }) {
  return (
    <figure className="relative w-72 md:w-96 cursor-pointer overflow-hidden rounded-xl border p-6 bg-card hover:bg-accent/50 transition-colors border-border/50">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Avatar name={name} index={index} className="size-8" />
            <figcaption className="text-sm font-medium">{name}</figcaption>
          </div>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="size-4 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
        </div>
        <blockquote className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{text}</blockquote>
      </div>
    </figure>
  );
}

export function Testimonials() {
  const all = REVIEWS.map(([n, t], i) => <Review key={n} name={n} text={t} index={i} />);
  return (
    <section className="py-16 bg-background overflow-hidden">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center space-y-3 mb-8 md:mb-10">
          <h2 className="text-2xl md:text-3xl font-semibold">Hear what they say about us</h2>
          <p className="text-muted-foreground text-sm md:text-base text-balance">See what our users have to say about {BRAND}.</p>
        </div>
        <div className="flex md:hidden relative h-[600px] w-full flex-col items-center justify-center overflow-hidden bg-background">
          <Marquee vertical duration="40s" className="[&>div]:items-center">
            {all}
          </Marquee>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-background" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-background" />
        </div>
        <div className="hidden md:flex relative w-full flex-col items-center justify-center overflow-hidden bg-background gap-8">
          <Marquee duration="60s">{all.slice(0, 4)}</Marquee>
          <Marquee duration="60s" reverse>
            {all.slice(4)}
          </Marquee>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-background" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-background" />
        </div>
      </div>
    </section>
  );
}

function StepText({
  step,
  icon: Icon,
  title,
  text,
  points,
}: {
  step: number;
  icon: typeof Rocket;
  title: string;
  text: string;
  points: string[];
}) {
  return (
    <div className="w-full md:w-2/5">
      <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors bg-primary/10 border-primary/30 text-primary mb-4">
        Step {step}
      </div>
      <h3 className="text-xl sm:text-2xl font-bold mb-3 flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" />
        {title}
      </h3>
      <p className="text-sm sm:text-base mb-4">{text}</p>
      <ul className="space-y-2 sm:space-y-3">
        {points.map((p) => (
          <li key={p} className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
            <Check className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section className="py-10 sm:py-16 md:py-20" id="how-it-works">
      <div className="container mx-auto px-6 sm:px-8 md:px-10">
        <div className="text-center mb-8 sm:mb-12 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4">How It Works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">Create faceless videos in three simple steps</p>
        </div>
        <div className="relative max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center mb-12 sm:mb-16 md:mb-20">
            <div className="w-full md:w-3/5 md:pr-6 lg:pr-12 mb-6 md:mb-0">
              <div className="h-[16rem] sm:h-[18rem] md:h-[22rem] relative rounded-lg overflow-hidden border border-border">
                <MiniDashboard view="series" />
              </div>
            </div>
            <StepText
              step={1}
              icon={CirclePlay}
              title="Create a Series"
              text="Choose your niche and video formats. Our AI handles the rest."
              points={["Unlimited niches supported", "Multiple video formats available"]}
            />
          </div>
          <div className="flex flex-col md:flex-row-reverse items-center mb-12 sm:mb-16 md:mb-20">
            <div className="w-full md:w-3/5 md:pl-6 lg:pl-12 mb-6 md:mb-0">
              <div className="h-[16rem] sm:h-[18rem] md:h-[22rem] relative rounded-lg overflow-hidden border border-border">
                <MiniDashboard view="create" />
              </div>
            </div>
            <StepText
              step={2}
              icon={SquarePen}
              title="Customize"
              text="Pick art styles and add your favorite music."
              points={["Various art styles to choose from", "Upload custom music or enter TikTok sound link"]}
            />
          </div>
          <div className="flex flex-col md:flex-row items-center">
            <div className="w-full md:w-3/5 md:pr-6 lg:pr-12 mb-6 md:mb-0">
              <div className="h-[16rem] sm:h-[18rem] md:h-[22rem] overflow-hidden flex justify-center items-center pt-16">
                <GrowthArt />
              </div>
            </div>
            <StepText
              step={3}
              icon={Rocket}
              title="Watch your socials grow"
              text="Connect your accounts and let us handle the posting."
              points={["Automatic posting while you sleep", "Supports: Instagram, TikTok, YouTube"]}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
