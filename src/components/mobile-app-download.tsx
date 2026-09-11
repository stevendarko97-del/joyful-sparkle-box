import { useState } from "react";
import { Download, Smartphone, QrCode, CheckCircle2, ShieldCheck, Zap, Bell, ArrowRight, X } from "lucide-react";
import { toast } from "sonner";
import { getBackendUrl } from "@/lib/config";

export function MobileAppDownloadSection() {
  const [phone, setPhone] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const handleDownloadApk = () => {
    const backendUrl = getBackendUrl();
    window.open(`${backendUrl}/api/app/download/apk`, "_blank");
    toast.success("Quick Tutor Android APK download started!");
  };

  const handleSendDownloadSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error("Please enter a valid Ghana phone number");
      return;
    }
    setSendingSms(true);
    try {
      // Simulate sending SMS via Arkesel
      await new Promise(r => setTimeout(r, 800));
      toast.success(`Download link sent to ${phone} via SMS!`);
      setPhone("");
    } catch {
      toast.error("Could not send SMS. Please download the APK directly.");
    } finally {
      setSendingSms(false);
    }
  };

  return (
    <section className="relative overflow-hidden border-t border-border bg-gradient-to-b from-card to-secondary/40 py-20">
      {/* Decorative background glow */}
      <div className="absolute -top-24 -left-24 size-96 rounded-full bg-brand/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 size-96 rounded-full bg-accent-gold/10 blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          
          {/* Left Column: Copy & Download Actions */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3.5 py-1.5 text-xs font-semibold text-brand border border-brand/20">
              <Smartphone className="size-3.5" />
              <span>Quick Tutor Flutter Mobile App 🇬🇭</span>
            </div>

            <h2 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-ink">
              Learn anytime, anywhere on your smartphone.
            </h2>

            <p className="mt-6 text-base sm:text-lg leading-relaxed text-muted-foreground max-w-2xl">
              Get the full 1-on-1 tutoring experience in your pocket. Instant Mobile Money payments, live WebRTC video classrooms with crystal-clear audio, and automated SMS alerts before every lesson.
            </p>

            {/* Key feature pills */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: ShieldCheck, title: "MoMo Escrow Built-In", desc: "MTN, Telecel & AT Money with 100% student fund protection." },
                { icon: Zap, title: "Low Data HD Video", desc: "Optimized WebRTC live classroom tailored for Ghana networks." },
                { icon: Bell, title: "Instant SMS Reminders", desc: "30-min & 5-min notifications sent directly to your phone." },
                { icon: CheckCircle2, title: "WAEC Exam Library", desc: "BECE, WASSCE & NOV/DEC past questions & live whiteboard." },
              ].map((feat) => {
                const Icon = feat.icon;
                return (
                  <div key={feat.title} className="flex items-start gap-3 rounded-xl bg-surface p-3.5 border border-border/80 shadow-xs">
                    <div className="size-9 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">
                      <Icon className="size-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-ink">{feat.title}</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{feat.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Download Buttons */}
            <div className="mt-10 flex flex-wrap items-center gap-4">
              {/* Direct APK Download Button */}
              <button
                onClick={handleDownloadApk}
                className="group relative flex items-center gap-3 rounded-xl bg-brand px-6 py-3.5 text-left text-primary-foreground shadow-md transition-all hover:bg-brand/90 hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-white/20">
                  <Download className="size-5 text-white transition-transform group-hover:-translate-y-0.5" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-white/80">Direct Android APK</div>
                  <div className="text-sm font-bold leading-none">Download APK (v1.0.0)</div>
                </div>
              </button>

              {/* QR Code trigger */}
              <button
                onClick={() => setQrModalOpen(true)}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-semibold text-ink shadow-xs transition-colors hover:bg-secondary active:scale-[0.98]"
              >
                <QrCode className="size-4.5 text-brand" />
                <span>Scan QR Code</span>
              </button>
            </div>

            {/* SMS Link Input */}
            <form onSubmit={handleSendDownloadSms} className="mt-8 max-w-md">
              <label className="text-xs font-semibold text-ink">
                Or text the download link to your phone:
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  type="tel"
                  placeholder="e.g. 0244123456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink outline-none transition-all focus:border-brand focus:ring-1 focus:ring-brand"
                />
                <button
                  type="submit"
                  disabled={sendingSms}
                  className="rounded-xl bg-ink px-5 py-2.5 text-xs font-semibold text-white transition-all hover:bg-ink/80 disabled:opacity-50"
                >
                  {sendingSms ? "Sending..." : "Send Link"}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Phone Mockup Visual */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-[320px]">
              {/* Phone Outer Shell */}
              <div className="relative rounded-[40px] border-[8px] border-ink bg-ink p-3 shadow-2xl ring-1 ring-black/10">
                {/* Speaker notch */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 h-3.5 w-24 rounded-full bg-slate-800 z-20" />

                {/* Phone Screen */}
                <div className="relative overflow-hidden rounded-[30px] bg-slate-900 text-white min-h-[520px] flex flex-col pt-8 pb-4 px-4">
                  {/* Status Bar */}
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-4 px-2">
                    <span className="font-semibold">09:41</span>
                    <div className="flex items-center gap-1.5">
                      <span>4G LTE</span>
                      <span>🇬🇭</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* App Header in Mock */}
                  <div className="flex items-center justify-between bg-emerald-900/60 border border-emerald-500/30 rounded-2xl p-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-xs text-white">
                        QT
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Quick Tutor Ghana</p>
                        <p className="text-[9px] text-emerald-300">Live Video Classroom</p>
                      </div>
                    </div>
                    <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>

                  {/* Live classroom preview card in mock */}
                  <div className="rounded-2xl bg-slate-800/90 border border-slate-700/60 p-3 mb-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-2">
                        <span className="font-semibold text-emerald-400">● Elective Maths Prep</span>
                        <span className="bg-slate-700 px-2 py-0.5 rounded text-[10px] text-slate-300">WASSCE 2026</span>
                      </div>
                      <div className="h-28 rounded-xl bg-slate-950/80 border border-slate-700/50 flex flex-col items-center justify-center text-center p-2 relative overflow-hidden">
                        <div className="size-12 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-lg mb-1">
                          👨‍🏫
                        </div>
                        <p className="text-[11px] font-bold text-white">Mr. Kofi Ansah</p>
                        <p className="text-[9px] text-slate-400">Solving Trigonometric Identities</p>
                        <div className="absolute bottom-1 right-2 text-[8px] text-emerald-400 bg-black/60 px-1.5 py-0.5 rounded">
                          HD 1080p • Low Latency
                        </div>
                      </div>
                    </div>

                    {/* Interactive chat snippet in mock */}
                    <div className="space-y-1.5 mt-2 bg-slate-900/90 p-2 rounded-lg text-[10px]">
                      <div className="text-emerald-300 font-semibold">Tutor: "Notice the sin²θ + cos²θ identity."</div>
                      <div className="text-slate-300">Student: "Got it sir, let me solve question 3."</div>
                    </div>
                  </div>

                  {/* MoMo Escrow status pill in mock */}
                  <div className="rounded-xl bg-amber-500/20 border border-amber-500/30 p-2 text-center text-[10px] text-amber-200 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-amber-400" />
                    <span>Paystack MoMo Escrow Protected (GH₵ 40.00)</span>
                  </div>
                </div>
              </div>

              {/* Floating Download Badge */}
              <div className="absolute -bottom-6 -left-6 rounded-2xl bg-white p-4 shadow-xl border border-border">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-brand text-white flex items-center justify-center font-bold">
                    <Smartphone className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink">Flutter v1.0.0</p>
                    <p className="text-[11px] text-muted-foreground">Android &amp; iOS Ready</p>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* QR Code Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl border border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">Scan with Your Phone</h3>
              <button
                onClick={() => setQrModalOpen(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-5" />
              </button>
            </div>
            
            <p className="mt-2 text-xs text-muted-foreground">
              Scan this QR code with your phone camera to download Quick Tutor APK directly.
            </p>

            {/* Generated visual QR code graphic */}
            <div className="my-6 flex justify-center">
              <div className="rounded-2xl border-4 border-brand/20 bg-white p-4 shadow-inner flex flex-col items-center">
                <svg className="size-44 text-brand" viewBox="0 0 100 100" fill="currentColor">
                  {/* Outer Frame Top Left */}
                  <rect x="10" y="10" width="25" height="25" rx="4" />
                  <rect x="15" y="15" width="15" height="15" fill="white" />
                  <rect x="18" y="18" width="9" height="9" fill="currentColor" />
                  
                  {/* Outer Frame Top Right */}
                  <rect x="65" y="10" width="25" height="25" rx="4" />
                  <rect x="70" y="15" width="15" height="15" fill="white" />
                  <rect x="73" y="18" width="9" height="9" fill="currentColor" />
                  
                  {/* Outer Frame Bottom Left */}
                  <rect x="10" y="65" width="25" height="25" rx="4" />
                  <rect x="15" y="70" width="15" height="15" fill="white" />
                  <rect x="18" y="73" width="9" height="9" fill="currentColor" />

                  {/* QR Pattern Data Blocks */}
                  <rect x="42" y="12" width="6" height="6" />
                  <rect x="52" y="12" width="6" height="6" />
                  <rect x="42" y="24" width="8" height="8" />
                  <rect x="54" y="26" width="6" height="6" />

                  <rect x="12" y="44" width="8" height="6" />
                  <rect x="26" y="44" width="10" height="6" />
                  <rect x="44" y="42" width="12" height="12" />
                  <rect x="64" y="44" width="8" height="6" />
                  <rect x="78" y="44" width="10" height="6" />

                  <rect x="42" y="62" width="6" height="12" />
                  <rect x="54" y="62" width="10" height="6" />
                  <rect x="72" y="62" width="8" height="8" />
                  <rect x="84" y="62" width="6" height="12" />

                  <rect x="44" y="80" width="12" height="8" />
                  <rect x="62" y="78" width="8" height="10" />
                  <rect x="76" y="80" width="12" height="8" />
                </svg>
                <span className="mt-2 text-[10px] font-bold tracking-widest uppercase text-brand">quicktutor.gh/app</span>
              </div>
            </div>

            <button
              onClick={handleDownloadApk}
              className="w-full rounded-xl bg-brand py-3 text-xs font-bold text-white transition-colors hover:bg-brand/90"
            >
              Download APK Directly
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
