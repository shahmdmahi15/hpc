"use client";

import * as React from "react";
import {
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  Edit,
  Tv,
  Users,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  getBulletinNoticesAction,
  createBulletinNoticeAction,
  updateBulletinNoticeAction,
  deleteBulletinNoticeAction,
  toggleBulletinNoticeAction,
  type BulletinNoticeData,
} from "@/actions/admin/bulletin-notice.action";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";

interface BulletinNoticesViewProps {
  initialNotices: BulletinNoticeData[];
}

export function BulletinNoticesView({
  initialNotices = [],
}: BulletinNoticesViewProps) {
  const [notices, setNotices] = React.useState<BulletinNoticeData[]>(initialNotices);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("ALL");
  const [audienceFilter, setAudienceFilter] = React.useState<string>("ALL");
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingNotice, setEditingNotice] = React.useState<BulletinNoticeData | null>(null);
  const [deletingNotice, setDeletingNotice] = React.useState<BulletinNoticeData | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = React.useState("");
  const [formMessage, setFormMessage] = React.useState("");
  const [formPriority, setFormPriority] = React.useState("NORMAL");
  const [formAudience, setFormAudience] = React.useState("ALL");
  const [formIsActive, setFormIsActive] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const refreshNotices = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await getBulletinNoticesAction();
      if (res.success && res.data) {
        setNotices(res.data);
      }
    } catch {
      toast.error("Failed to load notices.");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useRealtimeEvents({
    onEvent: (event) => {
      const type = (event?.type || "").toUpperCase();
      if (
        type === "BULLETIN_NOTICE_CREATED" ||
        type === "BULLETIN_NOTICE_UPDATED" ||
        type === "BULLETIN_NOTICE_DELETED"
      ) {
        void refreshNotices();
      }
    },
  });

  const handleOpenCreate = () => {
    setFormTitle("");
    setFormMessage("");
    setFormPriority("NORMAL");
    setFormAudience("ALL");
    setFormIsActive(true);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (notice: BulletinNoticeData) => {
    setEditingNotice(notice);
    setFormTitle(notice.title || "");
    setFormMessage(notice.message);
    setFormPriority(notice.priority || "NORMAL");
    setFormAudience(notice.targetAudience || "ALL");
    setFormIsActive(notice.isActive);
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMessage.trim()) {
      toast.error("Message is required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await createBulletinNoticeAction({
        title: formTitle.trim() || undefined,
        message: formMessage.trim(),
        priority: formPriority,
        targetAudience: formAudience,
        isActive: formIsActive,
      });
      if (res.success) {
        toast.success(res.message);
        setIsCreateOpen(false);
        void refreshNotices();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to create notice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNotice || !formMessage.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await updateBulletinNoticeAction(editingNotice.id, {
        title: formTitle.trim() || undefined,
        message: formMessage.trim(),
        priority: formPriority,
        targetAudience: formAudience,
        isActive: formIsActive,
      });
      if (res.success) {
        toast.success(res.message);
        setEditingNotice(null);
        void refreshNotices();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to update notice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (notice: BulletinNoticeData) => {
    const nextState = !notice.isActive;
    try {
      const res = await toggleBulletinNoticeAction(notice.id, nextState);
      if (res.success) {
        toast.success(res.message);
        setNotices((prev) =>
          prev.map((n) => (n.id === notice.id ? { ...n, isActive: nextState } : n))
        );
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to toggle notice status.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingNotice) return;
    try {
      const res = await deleteBulletinNoticeAction(deletingNotice.id);
      if (res.success) {
        toast.success(res.message);
        setDeletingNotice(null);
        void refreshNotices();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to delete notice.");
    }
  };

  const filteredNotices = React.useMemo(() => {
    return notices.filter((n) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (n.title && n.title.toLowerCase().includes(q)) ||
        n.message.toLowerCase().includes(q);
      const matchesPriority =
        priorityFilter === "ALL" || n.priority === priorityFilter;
      const matchesAudience =
        audienceFilter === "ALL" ||
        n.targetAudience === audienceFilter ||
        n.targetAudience === "ALL";

      return matchesSearch && matchesPriority && matchesAudience;
    });
  }, [notices, searchQuery, priorityFilter, audienceFilter]);

  const activeCount = notices.filter((n) => n.isActive).length;
  const waitingRoomCount = notices.filter(
    (n) => n.isActive && (n.targetAudience === "WAITING_ROOM" || n.targetAudience === "ALL")
  ).length;

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
            <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
            URGENT
          </span>
        );
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            HIGH
          </span>
        );
      case "LOW":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-muted text-muted-foreground border border-border">
            LOW
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
            NORMAL
          </span>
        );
    }
  };

  const getAudienceBadge = (audience: string) => {
    switch (audience) {
      case "WAITING_ROOM":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
            <Tv className="size-3" /> Waiting TV Only
          </span>
        );
      case "STAFF":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            <Shield className="size-3" /> Staff Only
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <Users className="size-3" /> Everywhere (All)
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border border-border/70 p-4 rounded-xl shadow-xs">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Megaphone className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">
              Bulletin & Notice Board
            </h1>
            <p className="text-xs text-muted-foreground">
              Broadcast announcements, waiting room guidelines, and urgent notifications live across all displays.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshNotices}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs font-bold cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-xs cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Add Notice</span>
          </Button>
        </div>
      </div>

      {/* 2. Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="border-border/70 shadow-2xs">
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Notices
            </CardTitle>
            <Layers className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">
              {notices.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Notice board entries registered
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-2xs">
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Broadcasts
            </CardTitle>
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {activeCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Currently broadcasting in real time
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-2xs">
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Waiting Room TV Display
            </CardTitle>
            <Tv className="size-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
              {waitingRoomCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Cycling on lobby TV ticker
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/30 p-2.5 rounded-lg border border-border/60">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notices by title or content..."
            className="pl-8 h-8 text-xs bg-background"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-8 px-2 rounded-md border border-border bg-background text-xs font-medium cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
            className="h-8 px-2 rounded-md border border-border bg-background text-xs font-medium cursor-pointer"
          >
            <option value="ALL">All Audiences</option>
            <option value="WAITING_ROOM">Waiting Hall TV</option>
            <option value="STAFF">Staff Only</option>
          </select>
        </div>
      </div>

      {/* 4. Notices Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredNotices.length === 0 ? (
          <div className="col-span-full p-12 text-center border border-dashed rounded-xl bg-card">
            <Megaphone className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <h3 className="text-sm font-bold text-foreground">No notices found</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Create a new bulletin notice to broadcast across waiting hall TVs and clinic dashboards.
            </p>
            <Button
              size="sm"
              onClick={handleOpenCreate}
              className="mt-4 text-xs font-bold"
            >
              <Plus className="size-3.5 mr-1" /> Create Notice
            </Button>
          </div>
        ) : (
          filteredNotices.map((notice) => (
            <Card
              key={notice.id}
              className={`border transition-all shadow-xs ${
                notice.isActive
                  ? "border-border/80 bg-card"
                  : "border-border/40 bg-muted/20 opacity-75"
              }`}
            >
              <CardHeader className="p-4 pb-2.5 flex flex-row items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {getPriorityBadge(notice.priority)}
                    {getAudienceBadge(notice.targetAudience)}
                  </div>
                  <h3 className="font-bold text-sm text-foreground leading-tight pt-1">
                    {notice.title || "Clinic Announcement"}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10.5px] font-semibold text-muted-foreground">
                    {notice.isActive ? "Active" : "Off"}
                  </span>
                  <Switch
                    checked={notice.isActive}
                    onCheckedChange={() => handleToggle(notice)}
                  />
                </div>
              </CardHeader>

              <CardContent className="p-4 pt-1 space-y-3">
                <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  {notice.message}
                </p>

                <div className="flex items-center justify-between text-[10.5px] text-muted-foreground pt-1 border-t border-border/50">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    <span>
                      {new Date(notice.createdAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(notice)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <Edit className="size-3 mr-1" /> Edit
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingNotice(notice)}
                      className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      <Trash2 className="size-3 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Megaphone className="size-4 text-primary" />
              <span>Create Bulletin Notice</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveCreate} className="space-y-3.5 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Title (Optional)</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Keep Prescription Slip Ready"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Announcement Message *</Label>
              <Textarea
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                placeholder="Type the message that will display on the waiting room TV ticker and staff screens..."
                rows={4}
                className="text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Priority</Label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-border bg-background text-xs font-medium"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Audience</Label>
                <select
                  value={formAudience}
                  onChange={(e) => setFormAudience(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-border bg-background text-xs font-medium"
                >
                  <option value="ALL">All Screens</option>
                  <option value="WAITING_ROOM">Waiting TV Only</option>
                  <option value="STAFF">Staff Only</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <Label className="text-xs font-semibold">Active Immediately</Label>
                <p className="text-[11px] text-muted-foreground">
                  Starts broadcasting upon saving
                </p>
              </div>
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs font-bold"
              >
                {isSubmitting ? "Broadcasting..." : "Save & Broadcast"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog
        open={Boolean(editingNotice)}
        onOpenChange={(open) => !open && setEditingNotice(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Edit className="size-4 text-primary" />
              <span>Edit Bulletin Notice</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-3.5 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Title (Optional)</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Announcement Message *</Label>
              <Textarea
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                rows={4}
                className="text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Priority</Label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-border bg-background text-xs font-medium"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Audience</Label>
                <select
                  value={formAudience}
                  onChange={(e) => setFormAudience(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-border bg-background text-xs font-medium"
                >
                  <option value="ALL">All Screens</option>
                  <option value="WAITING_ROOM">Waiting TV Only</option>
                  <option value="STAFF">Staff Only</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <Label className="text-xs font-semibold">Status Active</Label>
                <p className="text-[11px] text-muted-foreground">
                  Toggle broadcast visibility
                </p>
              </div>
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingNotice(null)}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs font-bold"
              >
                {isSubmitting ? "Updating..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={Boolean(deletingNotice)}
        onOpenChange={(open) => !open && setDeletingNotice(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-rose-600">
              <Trash2 className="size-4" />
              <span>Delete Notice</span>
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground py-2">
            Are you sure you want to permanently remove this notice? It will immediately stop displaying across all waiting room TVs and staff dashboards.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingNotice(null)}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              className="text-xs font-bold"
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
