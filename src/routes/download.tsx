import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { MobileAppDownloadSection } from "@/components/mobile-app-download";
import { ShieldCheck, Smartphone, Check, HelpCircle, Download } from "lucide-react";
import { getBackendUrl } from "@/lib/config";
import { toast } from "sonner";

export const Route = createFileRoute("/download")({
  component: DownloadPage,
  head: () => ({
    meta: [
      { title: "Download Quick Tutor App — Android APK & iOS" },
      { name: "description", content: "Download the Quick Tutor mobile application for BECE, WASSCE & NOV/DEC preparation in Ghana." },
    ],
  }),
});

function DownloadPage() {
  const handleDownloadApk = () => {
    const backendUrl = getBackendUrl();
    window.open(`${backendUrl}/api/app/download/apk`, "_blank");
    toast.success("Quick Tutor Android APK download started!");
  };

  return (
    <div className="min-h-screen bg-surface text-ink selection:bg-brand/10">
      <SiteNav />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-12 pb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3.5 py-1 text-xs font-semibold text-brand border border-brand/20">
          <Smartphone className="size-3.5" />
          <span>Official Flutter Mobile Client</span>
        </div>
        <h1 className="mt-4 font-serif text-4xl sm:text-5xl font-bold tracking-tight text-ink">
          Download Quick Tutor for Android &amp; iOS
        </h1>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          Get the ultimate Ghanaian exam preparation companion right on your phone. Built-in WebRTC classroom, Mobile Money escrow, and instant SMS reminders.
        </p>
      </section>

      {/* Main Download Section */}
      <MobileAppDownloadSection />

      {/* Installation Guide */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-center">
          How to install the APK on Android
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Download APK",
              desc: "Tap the 'Download APK' button above to get QuickTutor-v1.0.0.apk on your Android smartphone.",
            },
            {
              step: "02",
              title: "Allow Unknown Sources",
              desc: "If prompted by Android, enable 'Install Unknown Apps' for your browser or file manager.",
            },
            {
              step: "03",
              title: "Launch & Sign In",
              desc: "Open Quick Tutor, sign in with your student or tutor account, and start preparing for WAEC.",
            },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl bg-card p-6 border border-border shadow-xs">
              <span className="text-xs font-bold text-brand uppercase tracking-widest">{item.step}</span>
              <h3 className="mt-2 font-serif text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Verification Checksums & Requirements */}
        <div className="mt-12 rounded-2xl bg-secondary/70 p-6 border border-border">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <ShieldCheck className="size-4 text-brand" />
            System Requirements &amp; Verification
          </h4>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div>• <strong className="text-ink">Android:</strong> Version 7.0 (Nougat) or higher</div>
            <div>• <strong className="text-ink">iOS:</strong> Version 13.0 or higher</div>
            <div>• <strong className="text-ink">Package:</strong> com.quicktutor.ghana</div>
            <div>• <strong className="text-ink">File Size:</strong> ~18.4 MB (Fast install)</div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
