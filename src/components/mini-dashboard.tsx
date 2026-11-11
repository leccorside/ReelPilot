import { CreditCard, Film, Layers, Plus, Settings, Upload, ChevronRight, ArrowLeft, Play, Calendar } from "lucide-react";
import { LogoMark } from "./icons";
import { BRAND } from "@/lib/brand";

// A small, non-interactive picture of the dashboard inside a browser window, used where the
// original shows screen recordings of its app (How It Works, See It In Action).

const ROWS = [
  ["history", "Mar 17, 2025", "0 video(s)"],
  ["medieval stories", "Mar 15, 2025", "1 video(s)"],
  ["less known", "Mar 13, 2025", "4 video(s)"],
  ["cave diving 2", "Mar 13, 2025", "1 video(s)"],
  ["cave", "Mar 13, 2025", "1 video(s)"],
  ["tragic", "Mar 11, 2025", "1 video(s)"],
  ["history", "Mar 11, 2025", "1 video(s)"],
  ["history", "Mar 9, 2025", "1 video(s)"],
];

function Sidebar() {
  return (
    <div className="w-[22%] shrink-0 border-r border-border flex flex-col p-2 gap-1">
      <div className="flex items-center gap-1 px-1 py-1.5 font-heading font-extrabold text-[9px]">
        <LogoMark className="w-3 h-3 text-primary" /> {BRAND}
      </div>
      {[
        [Layers, "Series"],
        [Film, "Videos"],
        [Settings, "Settings"],
        [CreditCard, "Billing"],
      ].map(([Icon, label], i) => {
        const I = Icon as typeof Layers;
        return (
          <div key={label as string} className={`flex items-center gap-1 rounded px-1.5 py-1 text-[7px] ${i === 0 ? "bg-muted font-medium" : ""}`}>
            <I className="w-2 h-2" /> {label as string}
          </div>
        );
      })}
      <div className="mt-auto space-y-1">
        <div className="flex justify-between text-[6px] text-muted-foreground">
          <span>Credits left</span>
          <span>60/60</span>
        </div>
        <div className="h-1 rounded-full bg-primary" />
        <div className="rounded border border-border text-center text-[6px] py-1 text-primary">Upgrade</div>
      </div>
    </div>
  );
}

function SeriesView() {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-[7px] text-muted-foreground">
          Dashboard <ChevronRight className="inline w-2 h-2" /> <span className="text-foreground">Series</span>
        </span>
        <span className="flex items-center gap-0.5 rounded bg-primary px-1.5 py-0.5 text-[6px] text-white">
          <Plus className="w-2 h-2" /> Create Series
        </span>
      </div>
      <div className="m-2 rounded border border-border overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1.3fr_1fr_0.9fr] px-2 py-1 text-[6px] text-muted-foreground border-b border-border">
          <span>Name</span>
          <span>Type</span>
          <span>Created</span>
          <span>Published</span>
          <span>Actions</span>
        </div>
        {ROWS.map((r, i) => (
          <div key={i} className="grid grid-cols-[2fr_1fr_1.3fr_1fr_0.9fr] items-center px-2 py-[5px] text-[6px] border-b border-border last:border-0">
            <span>{r[0]}</span>
            <span>
              <span className="rounded-full bg-primary/10 px-1 text-primary text-[5px]">Voiceover</span>
            </span>
            <span className="flex items-center gap-0.5">
              <Calendar className="w-1.5 h-1.5" />
              {r[1]}
            </span>
            <span>{r[2]}</span>
            <span className="rounded border border-border px-1 text-[5px] w-fit flex items-center gap-0.5">
              <Play className="w-1.5 h-1.5 fill-current" /> Resume
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateView() {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="border-b border-border px-3 py-1.5 text-[7px] text-muted-foreground">
        Series <ChevronRight className="inline w-2 h-2" /> <span className="text-foreground">Create New Series</span>
      </div>
      <div className="mx-auto w-[62%] py-3 space-y-2">
        <div className="flex gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} className={`h-[3px] flex-1 rounded-full ${i < 3 ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <div className="flex items-center gap-1 text-[8px] font-semibold font-heading">
          Background Music <span className="rounded-full bg-primary/10 px-1 text-[5px] text-primary">Step 3 of 6</span>
        </div>
        <div className="text-[6px] text-muted-foreground">Add background music to your video</div>
        <div className="text-[6px] font-medium">TikTok Sound URLs</div>
        <div className="h-7 rounded border border-border text-[5px] text-muted-foreground p-1">Enter TikTok sound URLs, one per line</div>
        <div className="text-[6px] font-medium">Upload Sound Files</div>
        <div className="h-9 rounded border border-dashed border-border flex flex-col items-center justify-center text-[5px]">
          <Upload className="w-2 h-2" />
          Click to upload sound files or drag and drop
        </div>
        <div className="flex justify-between pt-1">
          <span className="rounded border border-border px-1.5 py-0.5 text-[6px] flex items-center gap-0.5">
            <ArrowLeft className="w-1.5 h-1.5" /> Back
          </span>
          <span className="rounded bg-primary px-1.5 py-0.5 text-[6px] text-white">Continue</span>
        </div>
      </div>
    </div>
  );
}

export function MiniDashboard({ view }: { view: "series" | "create" }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,#67e8f9_0%,#4f46e5_45%,#7c3aed_75%,#c4b5fd_100%)] p-[7%]">
      <div className="w-full h-full rounded-md bg-white shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-1 bg-zinc-800 px-2 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="ml-2 flex-1 rounded bg-zinc-700 h-2" />
        </div>
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          {view === "series" ? <SeriesView /> : <CreateView />}
        </div>
      </div>
    </div>
  );
}
