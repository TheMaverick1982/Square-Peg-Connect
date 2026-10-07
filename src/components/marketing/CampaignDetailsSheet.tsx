import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO, addDays, differenceInCalendarDays } from "date-fns";
import { Megaphone, Send, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { locations } from "@/lib/data";
import { notifyMarketing } from "@/lib/notify";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TeamMemberSelect, memberLabel, useTeamMembers } from "./TeamMemberSelect";
import { EventDatesEditor } from "./EventDatesEditor";
import { PLAN_STATUSES, planStatusOf } from "@/lib/marketing";

type PlanKey = "drinks" | "menu" | "activity" | "instore";
const PLAN_SECTIONS: { key: PlanKey; title: string; emailLabel: string; placeholder: string }[] = [
  { key: "menu", title: "Food menu", emailLabel: "Food Menu", placeholder: "Food specials, prep needed, ingredients…" },
  { key: "drinks", title: "Drink menu", emailLabel: "Drinks Menu", placeholder: "Specific drinks, specials or prep needed…" },
  { key: "activity", title: "Activity & event", emailLabel: "Activity", placeholder: "Decorations, games, music, schedule of events…" },
  { key: "instore", title: "In-store experience", emailLabel: "In-Store Experience", placeholder: "Staffing changes, decorations, table setups, music…" },
];

const buildForm = (c: any) => ({
  title: c.title || "",
  description: c.description || "",
  target_date: c.target_date || "",
  end_date: c.end_date || "",
  planning_date: c.planning_date || "",
  event_dates: (Array.isArray(c.event_dates) ? c.event_dates : []) as string[],
  plan_status: planStatusOf(c) as string,
  location_id: c.location_id || "all",
  drinks_plan: c.drinks_plan || "", drinks_due_date: c.drinks_due_date || "", drinks_assigned_to: c.drinks_assigned_to || "",
  menu_plan: c.menu_plan || "", menu_due_date: c.menu_due_date || "", menu_assigned_to: c.menu_assigned_to || "",
  activity_plan: c.activity_plan || "", activity_due_date: c.activity_due_date || "", activity_assigned_to: c.activity_assigned_to || "",
  instore_plan: c.instore_plan || "", instore_due_date: c.instore_due_date || "", instore_assigned_to: c.instore_assigned_to || "",
  promo_social: !!c.promo_social, promo_como: !!c.promo_como, promo_email: !!c.promo_email, promo_in_store: !!c.promo_in_store,
  promo_notes: c.promo_notes || "", promo_due_date: c.promo_due_date || "", promo_assigned_to: c.promo_assigned_to || "",
  social_email: c.social_email || "",
  como_notes: c.como_notes || "", como_assigned_to: c.como_assigned_to || "",
  email_notes: c.email_notes || "", email_assigned_to: c.email_assigned_to || "",
  in_store_notes: c.in_store_notes || "", in_store_assigned_to: c.in_store_assigned_to || "",
});
type Form = ReturnType<typeof buildForm>;

const isLate = (due: string, content: string) => !!due && !content.trim() && due < format(new Date(), "yyyy-MM-dd");

/**
 * Campaign details. Basics on top; the planning areas are collapsed until needed.
 * Works with its own "Open Details" button, or controlled via open/onOpenChange (used by the calendar).
 */
export function CampaignDetailsSheet({ campaign, updateCampaignDetails, tasks = [], open: controlledOpen, onOpenChange, hideTrigger }: {
  campaign: any;
  updateCampaignDetails: any;
  /** This campaign's tasks, so their due dates can move with the event. */
  tasks?: any[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (v: boolean) => { onOpenChange ? onOpenChange(v) : setInnerOpen(v); };
  const { toast } = useToast();
  const { data: members } = useTeamMembers();
  const [f, setF] = useState<Form>(() => buildForm(campaign));
  const [sendingCreative, setSendingCreative] = useState(false);
  const [shiftTasks, setShiftTasks] = useState(true);
  const queryClient = useQueryClient();
  const openDatedTasks = tasks.filter((t: any) => !t.is_completed && t.due_date);
  const dayShift = f.target_date && campaign.target_date ? differenceInCalendarDays(parseISO(f.target_date), parseISO(campaign.target_date)) : 0;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));

  // Reload the form each time the panel opens (or a different campaign is shown).
  useEffect(() => { if (open) { setF(buildForm(campaign)); setShiftTasks(true); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, campaign.id]);

  const handleSave = () => {
    if (!f.title.trim() || !f.target_date) {
      toast({ title: "Title and start date are required", variant: "destructive" });
      return;
    }
    const d = (v: string) => (v ? v : null);
    const updates: Record<string, unknown> = {
      title: f.title.trim(), description: f.description, target_date: f.target_date,
      location_id: f.location_id === "all" ? null : f.location_id,
      drinks_plan: f.drinks_plan, drinks_due_date: d(f.drinks_due_date), drinks_assigned_to: f.drinks_assigned_to,
      menu_plan: f.menu_plan, menu_due_date: d(f.menu_due_date), menu_assigned_to: f.menu_assigned_to,
      activity_plan: f.activity_plan, activity_due_date: d(f.activity_due_date), activity_assigned_to: f.activity_assigned_to,
      instore_plan: f.instore_plan, instore_due_date: d(f.instore_due_date), instore_assigned_to: f.instore_assigned_to,
      promo_social: f.promo_social, promo_como: f.promo_como, promo_email: f.promo_email, promo_in_store: f.promo_in_store,
      promo_notes: f.promo_notes, promo_due_date: d(f.promo_due_date), promo_assigned_to: f.promo_assigned_to,
      social_email: f.social_email, como_notes: f.como_notes, como_assigned_to: f.como_assigned_to,
      email_notes: f.email_notes, email_assigned_to: f.email_assigned_to,
      in_store_notes: f.in_store_notes, in_store_assigned_to: f.in_store_assigned_to,
    };
    // Only send end_date when it's used, so saving still works before the database update is run.
    if (f.end_date || campaign.end_date) updates.end_date = f.end_date && f.end_date >= f.target_date ? f.end_date : null;
    if (f.planning_date || campaign.planning_date) updates.planning_date = f.planning_date || null;
    if (f.event_dates.length || (campaign.event_dates || []).length) updates.event_dates = f.event_dates.filter((d) => d !== f.target_date);
    if (f.plan_status !== "auto" || campaign.plan_status) updates.plan_status = f.plan_status === "auto" ? null : f.plan_status;
    const moveTasksBy = shiftTasks && dayShift !== 0 ? dayShift : 0;

    updateCampaignDetails.mutate({ id: campaign.id, updates }, {
      onSuccess: async () => {
        setOpen(false);
        // Event moved? Slide the open tasks' due dates by the same number of days.
        if (moveTasksBy !== 0 && openDatedTasks.length) {
          await Promise.all(openDatedTasks.map((t: any) =>
            supabase.from("marketing_tasks").update({ due_date: format(addDays(parseISO(t.due_date), moveTasksBy), "yyyy-MM-dd") }).eq("id", t.id)));
          queryClient.invalidateQueries({ queryKey: ["marketing_tasks"] });
        }
        // Email anyone newly put in charge of an area.
        const checks = [
          ...PLAN_SECTIONS.map((s) => ({ email: f[`${s.key}_assigned_to`], type: s.emailLabel, due: f[`${s.key}_due_date`], old: campaign[`${s.key}_assigned_to`] })),
          { email: f.promo_assigned_to, type: "Master Promo Lead", due: f.promo_due_date, old: campaign.promo_assigned_to },
          { email: f.como_assigned_to, type: "Como (Loyalty)", due: f.promo_due_date, old: campaign.como_assigned_to },
          { email: f.email_assigned_to, type: "Email Broadcast", due: f.promo_due_date, old: campaign.email_assigned_to },
          { email: f.in_store_assigned_to, type: "In-Store Signage", due: f.promo_due_date, old: campaign.in_store_assigned_to },
        ];
        for (const c of checks) {
          if (c.email && c.email !== (c.old || "")) {
            await notifyMarketing({ type: "task_assigned", to: c.email, taskTitle: `Manage ${c.type} for ${f.title}`, campaignTitle: f.title, dueDate: c.due || null });
          }
        }
      },
    });
  };

  const sendCreativeRequest = async () => {
    setSendingCreative(true);
    try {
      const { error } = await supabase.from("social_posts").insert({
        title: `Campaign Creative: ${campaign.title}`,
        content: f.promo_notes,
        target_date: campaign.target_date,
        location_id: campaign.location_id,
        status: "Requested",
        campaign_id: campaign.id,
      });
      if (error) throw error;
      const res = await notifyMarketing({
        type: "creative_request", to: f.social_email || undefined, campaignTitle: campaign.title,
        targetDate: campaign.target_date, dueDate: f.promo_due_date || null, notes: f.promo_notes,
      });
      toast(res.ok && !res.skipped
        ? { title: "Creative request sent", description: "It's in the Creative Requests queue and the email is on its way." }
        : { title: "Added to Creative Requests", description: res.skipped ? "No email sent: add a social team email (here or under Email alerts)." : `The email didn't send: ${res.error}`, variant: res.ok ? undefined : "destructive" });
    } catch (e) {
      toast({ title: "Couldn't send request", description: (e as Error).message, variant: "destructive" });
    } finally { setSendingCreative(false); }
  };

  const summary = (who: string, due: string, content: string) => {
    const bits = [who ? memberLabel(members, who) : "", due ? `due ${format(parseISO(due), "MMM d")}` : ""].filter(Boolean).join(" · ");
    if (isLate(due, content)) return <span className="text-destructive text-xs font-medium">Overdue{bits ? ` · ${bits}` : ""}</span>;
    if (content.trim()) return <span className="text-xs text-muted-foreground">Planned{bits ? ` · ${bits}` : ""}</span>;
    return <span className="text-xs text-muted-foreground">{bits || "Not started"}</span>;
  };
  const channels = [f.promo_social && "Social", f.promo_como && "Loyalty", f.promo_email && "Email", f.promo_in_store && "Signage"].filter(Boolean).join(", ");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <SheetTrigger asChild>
          <Button variant="outline" size="sm">Open Details</Button>
        </SheetTrigger>
      )}
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader className="mb-5">
          <SheetTitle>{campaign.title}</SheetTitle>
          <SheetDescription>The basics are up top. Open only the planning areas this campaign needs.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 pb-24">
          {/* ---------- basics ---------- */}
          <div className="space-y-3 rounded-lg border p-4">
            <div>
              <Label>Campaign title</Label>
              <Input value={f.title} onChange={(e) => set("title", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={f.plan_status} onValueChange={(v) => set("plan_status", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_STATUSES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}<span className="text-muted-foreground ml-2 text-xs">{p.hint}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <EventDatesEditor
              value={{ start: f.target_date, end: f.end_date, extra: f.event_dates }}
              onChange={(v) => setF((prev) => ({ ...prev, target_date: v.start, end_date: v.end, event_dates: v.extra }))}
            />
            <div>
              <Label>Planning starts <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input type="date" value={f.planning_date} max={f.target_date} onChange={(e) => set("planning_date", e.target.value)} className="mt-1 sm:w-1/2" />
              <p className="text-[11px] text-muted-foreground mt-1">The day the team should begin working on this. Shows on the card and the calendar.</p>
            </div>
            {dayShift !== 0 && openDatedTasks.length > 0 && (
              <label className="flex items-start gap-2 text-sm rounded-md border bg-amber-50 dark:bg-amber-950/20 border-amber-200 p-3 cursor-pointer">
                <Checkbox checked={shiftTasks} onCheckedChange={(c) => setShiftTasks(!!c)} className="mt-0.5" />
                <span>
                  <span className="font-medium">Move {openDatedTasks.length} open task{openDatedTasks.length === 1 ? "" : "s"} too</span>
                  <span className="block text-xs text-muted-foreground">
                    The event moved {Math.abs(dayShift)} day{Math.abs(dayShift) === 1 ? "" : "s"} {dayShift > 0 ? "later" : "earlier"}. Shift their due dates by the same amount.
                  </span>
                </span>
              </label>
            )}
            <div>
              <Label>Location</Label>
              <Select value={f.location_id} onValueChange={(v) => set("location_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Goal / description</Label>
              <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} className="mt-1 min-h-[70px]" placeholder="What is this campaign for? What does success look like?" />
            </div>
          </div>

          {/* ---------- planning areas ---------- */}
          <Accordion type="multiple" className="rounded-lg border px-4">
            {PLAN_SECTIONS.map((s) => {
              const who = f[`${s.key}_assigned_to`], due = f[`${s.key}_due_date`], plan = f[`${s.key}_plan`];
              return (
                <AccordionItem key={s.key} value={s.key}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-1 items-center justify-between gap-3 pr-2 text-left">
                      <span className="font-semibold text-sm">{s.title}</span>
                      {summary(who, due, plan)}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Owner</Label>
                        <TeamMemberSelect value={who} onChange={(v) => set(`${s.key}_assigned_to`, v)} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Due date</Label>
                        <Input type="date" value={due} onChange={(e) => set(`${s.key}_due_date`, e.target.value)} className="mt-1 h-8 text-xs" />
                      </div>
                    </div>
                    <Textarea placeholder={s.placeholder} value={plan} onChange={(e) => set(`${s.key}_plan`, e.target.value)} className="min-h-[90px]" />
                  </AccordionContent>
                </AccordionItem>
              );
            })}

            <AccordionItem value="promo" className="border-b-0">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-1 items-center justify-between gap-3 pr-2 text-left">
                  <span className="font-semibold text-sm flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /> Promotion</span>
                  <span className="text-xs text-muted-foreground">{channels || "No channels picked"}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Promo lead</Label>
                    <TeamMemberSelect value={f.promo_assigned_to} onChange={(v) => set("promo_assigned_to", v)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Promo due date</Label>
                    <Input type="date" value={f.promo_due_date} onChange={(e) => set("promo_due_date", e.target.value)} className="mt-1 h-8 text-xs" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Channels</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    {([["promo_social", "Social media"], ["promo_como", "Como (loyalty members)"], ["promo_email", "Email broadcast"], ["promo_in_store", "In-store signage"]] as const).map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={f[k]} onCheckedChange={(c) => set(k, !!c)} /> {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">What needs promoting / creative guidance</Label>
                  <Textarea value={f.promo_notes} onChange={(e) => set("promo_notes", e.target.value)} className="mt-1 min-h-[80px]"
                    placeholder="What to promote, assets needed, tone. e.g. Energetic, feature the new cocktail." />
                </div>

                {f.promo_social && (
                  <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="text-sm font-medium">Social media creative request</div>
                    <p className="text-xs text-muted-foreground">Queues this in Creative Requests and emails the guidance above.</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <TeamMemberSelect value={f.social_email} onChange={(v) => set("social_email", v)} placeholder="Send to… (default: social team)" className="flex-1" />
                      <Button type="button" size="sm" variant="secondary" disabled={sendingCreative} onClick={sendCreativeRequest}>
                        {sendingCreative ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />} Send request
                      </Button>
                    </div>
                  </div>
                )}

                {f.promo_como && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs">Como (loyalty) plan</Label>
                      <TeamMemberSelect value={f.como_assigned_to} onChange={(v) => set("como_assigned_to", v)} className="w-[200px]" />
                    </div>
                    <Textarea value={f.como_notes} onChange={(e) => set("como_notes", e.target.value)} className="min-h-[60px] text-sm" placeholder="Points multipliers, push notifications, offers…" />
                  </div>
                )}
                {f.promo_email && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs">Email broadcast</Label>
                      <TeamMemberSelect value={f.email_assigned_to} onChange={(v) => set("email_assigned_to", v)} className="w-[200px]" />
                    </div>
                    <Textarea value={f.email_notes} onChange={(e) => set("email_notes", e.target.value)} className="min-h-[60px] text-sm" placeholder="Subject lines, audience, send dates…" />
                  </div>
                )}
                {f.promo_in_store && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs">In-store signage</Label>
                      <TeamMemberSelect value={f.in_store_assigned_to} onChange={(v) => set("in_store_assigned_to", v)} className="w-[200px]" />
                    </div>
                    <Textarea value={f.in_store_notes} onChange={(e) => set("in_store_notes", e.target.value)} className="min-h-[60px] text-sm" placeholder="Table tents, TV screens, posters…" />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-background border-t">
          <Button onClick={handleSave} className="w-full" disabled={updateCampaignDetails.isPending}>
            {updateCampaignDetails.isPending ? "Saving…" : "Save details"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
