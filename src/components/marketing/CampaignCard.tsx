import { useState } from "react";
import { format, parseISO, addDays } from "date-fns";
import { Archive, ArchiveRestore, CalendarDays, CheckCircle2, Circle, MapPin, Pencil, Plus, Trash2, UserCircle2, AlertTriangle, NotebookPen } from "lucide-react";
import { locations } from "@/lib/data";
import { campaignRisk, isTaskOverdue, daysUntil } from "@/lib/marketing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CampaignDetailsSheet } from "./CampaignDetailsSheet";
import { TeamMemberSelect, memberLabel, useTeamMembers } from "./TeamMemberSelect";

export const dateRangeLabel = (c: { target_date: string; end_date?: string | null }) =>
  c.end_date && c.end_date > c.target_date
    ? `${format(parseISO(c.target_date), "MMM d")} – ${format(parseISO(c.end_date), "MMM d, yyyy")}`
    : format(parseISO(c.target_date), "MMM d, yyyy");

const dueLabel = (due: string) => {
  const d = daysUntil(due);
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  if (d < 0) return `${-d} day${d === -1 ? "" : "s"} overdue`;
  return `Due ${format(parseISO(due), "MMM d")}`;
};

function TaskDialog({ open, onOpenChange, initial, campaignTitle, defaultDue, onSubmit, busy }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initial?: { title: string; assigned_to: string; due_date: string };
  campaignTitle: string; defaultDue: string; busy?: boolean;
  onSubmit: (t: { title: string; assigned_to: string; due_date: string }) => void;
}) {
  const [t, setT] = useState(initial ?? { title: "", assigned_to: "", due_date: defaultDue });
  // Reset each time it opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) { setWasOpen(true); setT(initial ?? { title: "", assigned_to: "", due_date: defaultDue }); }
  if (!open && wasOpen) setWasOpen(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit task" : "Add a task"}</DialogTitle>
          <DialogDescription>{campaignTitle}{initial ? "" : " · the person you pick gets an email"}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (t.title.trim() && t.due_date) onSubmit({ ...t, title: t.title.trim() }); }}>
          <div>
            <Label>Task</Label>
            <Input autoFocus value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} placeholder="e.g. Design the table tents" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Who</Label>
              <TeamMemberSelect value={t.assigned_to} onChange={(v) => setT({ ...t, assigned_to: v })} className="mt-1" />
            </div>
            <div>
              <Label>Due</Label>
              <Input type="date" required value={t.due_date} onChange={(e) => setT({ ...t, due_date: e.target.value })} className="mt-1 h-8 text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !t.title.trim() || !t.due_date}>{initial ? "Save" : "Add task"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CampaignCard({ campaign, status, tasks, progress, createTask, toggleTask, updateTask, deleteTask, updateCampaignDetails, archiveCampaign }: any) {
  const { data: members } = useTeamMembers();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [remember, setRemember] = useState(true);
  const [recap, setRecap] = useState({ worked: "", improve: "", results: "" });

  const risk = campaignRisk(campaign, tasks);
  const archived = !!campaign.archived_at;
  const sorted = [...tasks].sort((a: any, b: any) =>
    Number(a.is_completed) - Number(b.is_completed) || String(a.due_date || "").localeCompare(String(b.due_date || "")));
  const today = format(new Date(), "yyyy-MM-dd");
  const weekBefore = format(addDays(parseISO(campaign.target_date), -7), "yyyy-MM-dd");
  const defaultDue = weekBefore > today ? weekBefore : today;
  const locName = campaign.location_id ? locations.find((l) => l.id === campaign.location_id)?.name : null;
  const hasRecap = campaign.recap_worked || campaign.recap_improve || campaign.recap_results;

  return (
    <Card className={`overflow-hidden ${risk?.level === "risk" ? "border-red-300" : ""}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 border-b bg-muted/10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-semibold text-lg">{campaign.title}</h3>
            {archived
              ? <Badge variant="outline" className="bg-muted text-muted-foreground">Archived</Badge>
              : <Badge className={status.color} variant="outline">{status.label}</Badge>}
            {risk && (
              <Badge variant="outline" className={risk.level === "risk" ? "bg-red-600 text-white border-red-600" : "bg-amber-100 text-amber-900 border-amber-200"}>
                <AlertTriangle className="w-3 h-3 mr-1" />{risk.label}
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />{dateRangeLabel(campaign)}</span>
            {locName && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{locName}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:justify-end">
          <div className="flex items-center gap-2" title={`${tasks.filter((t: any) => t.is_completed).length} of ${tasks.length} tasks done`}>
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-semibold tabular-nums">{tasks.length ? `${progress}%` : "No tasks"}</span>
          </div>
          <CampaignDetailsSheet campaign={campaign} updateCampaignDetails={updateCampaignDetails} />
          {archived ? (
            <Button variant="outline" size="sm" disabled={archiveCampaign?.isPending} onClick={() => archiveCampaign.mutate({ campaign, archive: false })}>
              <ArchiveRestore className="w-4 h-4 mr-2" /> Restore
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => { setRemember(true); setRecap({ worked: campaign.recap_worked || "", improve: campaign.recap_improve || "", results: campaign.recap_results || "" }); setConfirmArchive(true); }}>
              <Archive className="w-4 h-4 mr-2" /> Archive
            </Button>
          )}
        </div>
      </div>

      <div className="p-4">
        {campaign.description && <p className="text-sm text-muted-foreground mb-4 whitespace-pre-line">{campaign.description}</p>}

        {archived && hasRecap && (
          <div className="rounded-md border bg-muted/30 p-3 mb-4 text-sm space-y-1.5">
            <div className="font-medium flex items-center gap-2"><NotebookPen className="w-4 h-4" /> Recap</div>
            {campaign.recap_results && <div><span className="text-muted-foreground">Results: </span>{campaign.recap_results}</div>}
            {campaign.recap_worked && <div><span className="text-muted-foreground">What worked: </span>{campaign.recap_worked}</div>}
            {campaign.recap_improve && <div><span className="text-muted-foreground">Do differently: </span>{campaign.recap_improve}</div>}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tasks</h4>
            {!archived && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setAdding(true)}><Plus className="w-3 h-3" /> Add task</Button>
            )}
          </div>

          {sorted.length === 0 ? (
            <div className="text-xs italic text-muted-foreground">No tasks yet.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {sorted.map((task: any) => {
                const late = isTaskOverdue(task);
                return (
                  <div key={task.id} className={`group flex items-start gap-2 p-2 rounded border text-sm ${task.is_completed ? "bg-muted/30" : late ? "border-red-300 bg-red-50 dark:bg-red-950/20" : "bg-background"}`}>
                    <button type="button" aria-label={task.is_completed ? "Mark not done" : "Mark done"}
                      onClick={() => toggleTask.mutate({ task_id: task.id, is_completed: !task.is_completed })}
                      className={`mt-0.5 shrink-0 ${task.is_completed ? "text-primary" : "text-muted-foreground hover:text-primary"}`}>
                      {task.is_completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={`font-medium leading-snug ${task.is_completed ? "line-through text-muted-foreground" : ""}`}>{task.title}</div>
                      <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 mt-0.5">
                        <span className="flex items-center gap-1"><UserCircle2 className="w-3 h-3" />{memberLabel(members, task.assigned_to)}</span>
                        {task.due_date && !task.is_completed && (
                          <span className={late ? "text-red-700 dark:text-red-400 font-semibold" : ""}>{dueLabel(task.due_date)}</span>
                        )}
                      </div>
                    </div>
                    {!archived && (
                      <div className="flex shrink-0 opacity-60 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button type="button" aria-label="Edit task" className="p-1 text-muted-foreground hover:text-foreground" onClick={() => setEditing(task)}><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" aria-label="Delete task" className="p-1 text-muted-foreground hover:text-destructive"
                          onClick={() => { if (window.confirm(`Delete the task "${task.title}"?`)) deleteTask.mutate(task.id); }}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <TaskDialog open={adding} onOpenChange={setAdding} campaignTitle={campaign.title} defaultDue={defaultDue} busy={createTask.isPending}
        onSubmit={(t) => createTask.mutate({ ...t, campaign_id: campaign.id }, { onSuccess: () => setAdding(false) })} />
      <TaskDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} campaignTitle={campaign.title} defaultDue={defaultDue} busy={updateTask.isPending}
        initial={editing ? { title: editing.title, assigned_to: editing.assigned_to || "", due_date: editing.due_date || defaultDue } : undefined}
        onSubmit={(t) => updateTask.mutate({ task: editing, updates: t, campaignTitle: campaign.title }, { onSuccess: () => setEditing(null) })} />

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive "{campaign.title}"?</AlertDialogTitle>
            <AlertDialogDescription>It moves out of the active list. You can find it anytime under Archived and restore it.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="text-sm font-medium flex items-center gap-2"><NotebookPen className="w-4 h-4" /> Quick recap <span className="font-normal text-muted-foreground">(optional, shown when you repeat it next year)</span></div>
            <div>
              <Label className="text-xs">Results</Label>
              <Input value={recap.results} onChange={(e) => setRecap({ ...recap, results: e.target.value })} placeholder="e.g. Sales up ~12%, 40 covers on the night" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">What worked</Label>
              <Textarea value={recap.worked} onChange={(e) => setRecap({ ...recap, worked: e.target.value })} className="mt-1 min-h-[56px]" />
            </div>
            <div>
              <Label className="text-xs">What to do differently</Label>
              <Textarea value={recap.improve} onChange={(e) => setRecap({ ...recap, improve: e.target.value })} className="mt-1 min-h-[56px]" />
            </div>
            <label className="flex items-start gap-2 text-sm rounded-md border p-3 bg-muted/30">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} className="mt-0.5" />
              <span>
                <span className="font-medium">Remind us next year</span>
                <span className="block text-xs text-muted-foreground">
                  Adds it to Seasonal Prompts around {format(parseISO(campaign.target_date), "MMM d")}, with a one-click "Repeat" that copies this campaign and its tasks.
                </span>
              </span>
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveCampaign.mutate({ campaign, archive: true, remember, recap })}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
