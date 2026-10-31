import { useRef, useState } from "react";
import { locations } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useNoIndex } from "@/lib/noindex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, Paperclip, X, UploadCloud } from "lucide-react";

const MAX_FILE_MB = 50;
const MAX_FILES = 15;

const blank = () => ({
  store: "", title: "", start_date: "", end_date: "", start_time: "", end_time: "",
  details: "", links: "", contact_name: "", contact_email: "",
});

export default function PublicStoreEventForm() {
  useNoIndex();
  // A store's own link (?store=loc-5) picks that store automatically.
  const presetStore = (() => {
    const id = new URLSearchParams(window.location.search).get("store") || "";
    return locations.some(l => l.id === id) ? id : "";
  })();
  const [form, setForm] = useState({ ...blank(), store: presetStore });
  const [files, setFiles] = useState<File[]>([]);
  const [honeypot, setHoneypot] = useState("");
  const startedAt = useRef(Date.now());
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "saving" | "done">("idle");
  const [error, setError] = useState("");
  const set = (k: keyof ReturnType<typeof blank>, v: string) => setForm(f => ({ ...f, [k]: v }));
  const today = new Date().toISOString().slice(0, 10);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    const tooBig = picked.filter(f => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig.length) setError(`${tooBig.map(f => f.name).join(", ")} ${tooBig.length === 1 ? "is" : "are"} over ${MAX_FILE_MB}MB. For big videos, paste a Google Drive or Dropbox link in the links box instead.`);
    else setError("");
    setFiles(prev => [...prev, ...picked.filter(f => f.size <= MAX_FILE_MB * 1024 * 1024)].slice(0, MAX_FILES));
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.store || !form.title.trim() || !form.start_date || !form.contact_name.trim()) {
      setError("Please fill in your store, the event name, the date and your name.");
      return;
    }
    if (form.end_date && form.end_date < form.start_date) {
      setError("The end date is before the start date.");
      return;
    }
    try {
      // 1) Upload files into one folder for this submission.
      setStatus("uploading");
      const folder = `uploads/${crypto.randomUUID()}`;
      const uploaded: { path: string; name: string; type: string; size: number }[] = [];
      for (const file of files) {
        const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120) || "file";
        const path = `${folder}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage.from("store-event-files").upload(path, file, { contentType: file.type || undefined });
        if (upErr) throw new Error(`Couldn't upload ${file.name}: ${upErr.message}`);
        uploaded.push({ path, name: file.name, type: file.type, size: file.size });
      }
      // 2) Send the event to the marketing team.
      setStatus("saving");
      const res = await fetch("/api/store-event-submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, files: uploaded, website: honeypot, started_at: startedAt.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || "Something went wrong. Please try again.");
      setStatus("done");
    } catch (err) {
      setError((err as Error).message);
      setStatus("idle");
    }
  };

  if (status === "done") {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="bg-card border rounded-xl shadow-sm p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Event sent!</h1>
          <p className="text-muted-foreground mb-6">The marketing team has your event and will be in touch about promoting it.</p>
          <Button className="w-full" onClick={() => { setForm({ ...blank(), store: presetStore }); setFiles([]); startedAt.current = Date.now(); setStatus("idle"); }}>
            Submit another event
          </Button>
        </div>
      </div>
    );
  }

  const busy = status !== "idle";
  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <img src="/square-peg-logo.png" alt="Square Peg Pizzeria" className="h-16 mx-auto object-contain mb-6" />
          <h1 className="text-2xl font-bold tracking-tight">Submit a Store Event</h1>
          <p className="text-muted-foreground mt-2 text-sm">Tell the marketing team about an event at your store so we can help promote it.</p>
        </div>

        <form onSubmit={submit} className="bg-card rounded-xl shadow-sm border p-6 space-y-5">
          {/* Honeypot: hidden from people, bots fill it in. */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
            <label htmlFor="website">Website</label>
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={e => setHoneypot(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>Your store <span className="text-destructive">*</span></Label>
            <Select value={form.store} onValueChange={v => set("store", v)}>
              <SelectTrigger><SelectValue placeholder="Select your store" /></SelectTrigger>
              <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="title">Event name <span className="text-destructive">*</span></Label>
            <Input id="title" value={form.title} maxLength={200} placeholder="e.g. Trivia Night, Pizza & Paint, Holiday Kids Day" onChange={e => set("title", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start_date">Date <span className="text-destructive">*</span></Label>
              <Input id="start_date" type="date" min={today} value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end_date">End date <span className="text-muted-foreground font-normal">(if more than one day)</span></Label>
              <Input id="end_date" type="date" min={form.start_date || today} value={form.end_date} onChange={e => set("end_date", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="start_time">Start time</Label>
              <Input id="start_time" type="time" value={form.start_time} onChange={e => set("start_time", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end_time">End time</Label>
              <Input id="end_time" type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="details">Details</Label>
            <Textarea id="details" rows={5} maxLength={5000} value={form.details} onChange={e => set("details", e.target.value)}
              placeholder="What's happening, who it's for, specials, prices, anything we should mention when we promote it." />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="links">Links</Label>
            <Textarea id="links" rows={2} maxLength={2000} value={form.links} onChange={e => set("links", e.target.value)}
              placeholder="Ticket page, Facebook event, Google Drive or Dropbox folder… one per line" />
          </div>

          <div className="grid gap-2">
            <Label>Photos, videos or flyers</Label>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}
              className="border-2 border-dashed rounded-lg p-5 text-center hover:bg-muted/40 transition-colors">
              <UploadCloud className="w-7 h-7 mx-auto text-muted-foreground mb-1" />
              <div className="text-sm font-medium">Tap to add files</div>
              <div className="text-xs text-muted-foreground">Images, videos, PDFs · up to {MAX_FILE_MB}MB each</div>
            </button>
            <input ref={fileInput} type="file" multiple hidden accept="image/*,video/*,application/pdf,.doc,.docx,.ppt,.pptx" onChange={e => addFiles(e.target.files)} />
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-sm bg-muted/40 rounded px-3 py-1.5">
                    <span className="flex items-center gap-2 min-w-0"><Paperclip className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{(f.size / 1024 / 1024).toFixed(1)}MB</span></span>
                    <button type="button" disabled={busy} onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>
                      <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="contact_name">Your name <span className="text-destructive">*</span></Label>
              <Input id="contact_name" maxLength={120} value={form.contact_name} onChange={e => set("contact_name", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact_email">Your email</Label>
              <Input id="contact_email" type="email" maxLength={200} value={form.contact_email} onChange={e => set("contact_email", e.target.value)} />
            </div>
          </div>

          {error && <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{status === "uploading" ? "Uploading files…" : "Sending…"}</> : "Submit event"}
          </Button>
        </form>
      </div>
    </div>
  );
}
