"use client";

import * as React from "react";
import { ClinicalOptionCategory } from "@/generated/prisma/enums";
import type { ClinicalOptionModel } from "@/generated/prisma/models";
import {
  toggleClinicalOptionStatusAction,
  getClinicalOptionsAction,
} from "@/actions/admin/clinical.action";
import { CreateClinicalOptionDialog } from "@/components/admin/clinical/create-clinical-option-dialog";
import { EditClinicalOptionDialog } from "@/components/admin/clinical/edit-clinical-option-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope,
  PlusCircle,
  Search,
  CheckCircle2,
  XCircle,
  Edit3,
  SlidersHorizontal,
  Flame,
  Activity,
  HeartPulse,
  TrendingUp,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface ClinicalOptionsManagementViewProps {
  initialOptions: ClinicalOptionModel[];
}

const CATEGORY_TABS: {
  key: ClinicalOptionCategory;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  {
    key: ClinicalOptionCategory.TREATMENT_PLAN,
    label: "Treatment Modalities",
    shortLabel: "Treatments",
    icon: Stethoscope,
    description:
      "Dynamic physiotherapy interventions (Hot pack, IFT/TENS, Ultrasound, etc.)",
  },
  {
    key: ClinicalOptionCategory.PAIN_AREA,
    label: "Pain Areas",
    shortLabel: "Pain Areas",
    icon: Flame,
    description:
      "Anatomical pain regions (Neck, Shoulder, Back, Knee, Heel, etc.)",
  },
  {
    key: ClinicalOptionCategory.PAIN_TYPE,
    label: "Pain Characteristics",
    shortLabel: "Pain Types",
    icon: Activity,
    description:
      "Pain sensation descriptors (Sharp, Dull, Burning, Radiating, etc.)",
  },
  {
    key: ClinicalOptionCategory.AGGRAVATING_FACTOR,
    label: "Aggravating Factors",
    shortLabel: "Increases With",
    icon: AlertCircle,
    description:
      "Activities or postures that increase pain (Movement, Sitting, etc.)",
  },
  {
    key: ClinicalOptionCategory.RELIEVING_FACTOR,
    label: "Relieving Factors",
    shortLabel: "Reduces With",
    icon: HeartPulse,
    description: "Factors that alleviate symptoms (Rest, Heat, Medicine, etc.)",
  },
  {
    key: ClinicalOptionCategory.FUNCTIONAL_LIMITATION,
    label: "Functional Limitations",
    shortLabel: "Difficulty In",
    icon: TrendingUp,
    description:
      "Everyday physical activity restrictions (Bending, Walking, Lifting, etc.)",
  },
];

export function ClinicalOptionsManagementView({
  initialOptions,
}: ClinicalOptionsManagementViewProps) {
  const [options, setOptions] =
    React.useState<ClinicalOptionModel[]>(initialOptions);
  const [selectedCategory, setSelectedCategory] =
    React.useState<ClinicalOptionCategory>(
      ClinicalOptionCategory.TREATMENT_PLAN,
    );
  const [searchQuery, setSearchQuery] = React.useState("");

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingOption, setEditingOption] =
    React.useState<ClinicalOptionModel | null>(null);

  const [, startTransition] = React.useTransition();

  const refreshOptions = React.useCallback(() => {
    startTransition(async () => {
      const res = await getClinicalOptionsAction();
      if (res.success) {
        setOptions(res.options);
      }
    });
  }, []);

  // Filter options by category and search
  const filteredOptions = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return options
      .filter((opt) => opt.category === selectedCategory)
      .filter((opt) => {
        if (!q) return true;
        return (
          opt.name.toLowerCase().includes(q) ||
          (opt.description || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }, [options, selectedCategory, searchQuery]);

  // Counts by category
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, { total: number; active: number }> = {};
    for (const cat of Object.values(ClinicalOptionCategory)) {
      counts[cat] = { total: 0, active: 0 };
    }
    for (const opt of options) {
      if (!counts[opt.category]) counts[opt.category] = { total: 0, active: 0 };
      counts[opt.category].total++;
      if (opt.isActive) counts[opt.category].active++;
    }
    return counts;
  }, [options]);

  const handleToggleStatus = async (opt: ClinicalOptionModel) => {
    try {
      const res = await toggleClinicalOptionStatusAction(opt.id);
      if (res.success) {
        toast.success(res.message);
        refreshOptions();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to toggle option status.");
    }
  };

  const activeCategoryMeta = CATEGORY_TABS.find(
    (t) => t.key === selectedCategory,
  )!;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:p-4 rounded-xl bg-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <SlidersHorizontal className="size-4" />
            </span>
            <h1 className="text-sm sm:text-base font-black tracking-tight text-foreground">
              Clinical Assessment &amp; Treatment Master
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure dynamic pain areas, physical symptoms, and physiotherapy
            treatment plans for doctors.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="h-8 px-3 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer gap-1.5 self-start sm:self-auto"
        >
          <PlusCircle className="size-3.5" />
          <span>Add New Option</span>
        </Button>
      </div>

      {/* Category Pills Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
        {CATEGORY_TABS.map((tab) => {
          const isSelected = selectedCategory === tab.key;
          const Icon = tab.icon;
          const count = categoryCounts[tab.key] || { total: 0, active: 0 };

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedCategory(tab.key)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                isSelected
                  ? "bg-sky-500/10 border-sky-500/50 text-sky-900 dark:text-sky-200 shadow-xs ring-1 ring-sky-500/30 font-bold"
                  : "bg-card border-border/80 text-foreground hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`p-1 rounded-md ${
                    isSelected
                      ? "bg-sky-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="size-3" />
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-muted border border-border">
                  {count.active}/{count.total}
                </span>
              </div>
              <div className="truncate">
                <div className="text-xs tracking-tight truncate">
                  {tab.shortLabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="p-3 sm:p-4 rounded-xl bg-card border border-border shadow-xs space-y-3">
        {/* Category Header & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
              <span>{activeCategoryMeta.label}</span>
              <Badge variant="secondary" className="text-[10px] font-mono py-0">
                {filteredOptions.length} items
              </Badge>
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {activeCategoryMeta.description}
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search options..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {/* Options List / Grid */}
        {filteredOptions.length === 0 ? (
          <div className="py-10 text-center space-y-2 border border-dashed border-border rounded-xl">
            <div className="size-9 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <Sparkles className="size-4" />
            </div>
            <p className="text-xs font-semibold text-foreground">
              No options found
            </p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              {searchQuery
                ? "No matching items for your search term."
                : "No options configured under this category yet."}
            </p>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setIsCreateOpen(true)}
              className="text-xs cursor-pointer gap-1 mt-1"
            >
              <PlusCircle className="size-3" />
              <span>Add First Option</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredOptions.map((opt) => (
              <div
                key={opt.id}
                className={`p-2.5 rounded-lg border transition-all flex items-start justify-between gap-2 ${
                  opt.isActive
                    ? "bg-background border-border hover:border-border/80"
                    : "bg-muted/40 border-border/50 opacity-60"
                }`}
              >
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-foreground truncate">
                      {opt.name}
                    </span>
                    <span className="text-[9.5px] font-mono px-1 rounded bg-muted text-muted-foreground border border-border/50">
                      #{opt.order}
                    </span>
                    {!opt.isActive && (
                      <span className="text-[9px] font-bold px-1 rounded bg-rose-500/10 text-rose-600 border border-rose-500/20">
                        Disabled
                      </span>
                    )}
                  </div>
                  {opt.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {opt.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(opt)}
                    title={opt.isActive ? "Disable option" : "Enable option"}
                    className={`p-1 rounded hover:bg-muted transition-colors cursor-pointer ${
                      opt.isActive
                        ? "text-emerald-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {opt.isActive ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <XCircle className="size-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingOption(opt)}
                    title="Edit option"
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Edit3 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <CreateClinicalOptionDialog
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        defaultCategory={selectedCategory}
        onSuccess={refreshOptions}
      />

      {/* Edit Dialog */}
      <EditClinicalOptionDialog
        isOpen={!!editingOption}
        onOpenChange={(open) => !open && setEditingOption(null)}
        option={editingOption}
        onSuccess={refreshOptions}
      />
    </div>
  );
}
