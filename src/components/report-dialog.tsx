import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const BACKEND = (import.meta as any).env.VITE_BACKEND_URL || "http://localhost:4000";

const CATEGORIES = [
  { value: "tutor_no_show", label: "Tutor No-Show (Tutor did not attend)" },
  { value: "student_no_show", label: "Student No-Show (Student did not attend)" },
  { value: "technical_issue", label: "Technical & Video/Audio Problem" },
  { value: "payment_dispute", label: "Payment or Payout Dispute" },
  { value: "lesson_quality", label: "Lesson Quality or Incomplete Session" },
  { value: "inappropriate_behavior", label: "Inappropriate Behavior / Safety Concern" },
  { value: "other", label: "Other Issue / Help Request" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  bookingId?: string | null;
  bookingLabel?: string | null;
  defaultCategory?: string;
};

export function ReportDialog({ open, onClose, bookingId, bookingLabel, defaultCategory }: Props) {
  const [category, setCategory] = useState(defaultCategory || "technical_issue");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error("Please provide a subject and details for your report");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please sign in to submit a report");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND}/api/support/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          description: description.trim(),
          booking_id: bookingId || null,
        }),
      });

      const data = await res.json();
      setSubmitting(false);

      if (res.ok) {
        toast.success("Problem reported! Admin will review your ticket.");
        setSubject("");
        setDescription("");
        onClose();
      } else {
        toast.error(data?.error || "Failed to submit report");
      }
    } catch (err) {
      setSubmitting(false);
      toast.error("An error occurred while submitting your report");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-card border border-border p-6 sm:p-8 shadow-2xl space-y-6 relative">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-ink transition-colors"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-start gap-3.5">
          <div className="size-11 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
            <AlertCircle className="size-5" />
          </div>
          <div>
            <h3 className="font-serif text-xl font-bold text-ink">Report a Problem</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Submit your dispute or issue directly to the QuickTutor admin team.
            </p>
          </div>
        </div>

        {bookingLabel && (
          <div className="rounded-xl bg-secondary/60 border border-border px-3.5 py-2 text-xs text-muted-foreground">
            Related Session: <strong className="text-ink">{bookingLabel}</strong>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-ink block mb-1.5">Problem Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-input bg-surface px-3.5 py-2.5 text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink block mb-1.5">Subject / Summary</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Tutor was 20 minutes late and video disconnected"
              className="w-full rounded-xl border border-input bg-surface px-3.5 py-2.5 text-xs text-ink placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink block mb-1.5">Detailed Description</label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide specific details so admin can investigate and resolve your issue quickly..."
              className="w-full rounded-xl border border-input bg-surface p-3 text-xs text-ink placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="bg-destructive hover:bg-destructive/90 text-white font-semibold">
              {submitting ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
