import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";

const router = express.Router();

// App metadata & download links
router.get("/info", (req: Request, res: Response) => {
  res.json({
    appName: "Quick Tutor Ghana",
    version: "1.0.0",
    buildNumber: 1,
    releaseDate: "2026-09-11",
    packageName: "com.quicktutor.ghana",
    minAndroidVersion: "7.0 (API 24)",
    minIosVersion: "13.0",
    features: [
      "1-on-1 WebRTC Live Video Classroom",
      "Paystack Mobile Money Escrow (MTN MoMo, Telecel Cash, AT Money)",
      "Instant Arkesel SMS lesson reminders",
      "BECE, WASSCE & NOV/DEC exam curriculum prep",
      "Tutor earnings ledger & instant payout requests"
    ],
    downloadLinks: {
      androidApk: "/api/app/download/apk",
      googlePlay: "https://play.google.com/store/apps/details?id=com.quicktutor.ghana",
      appleAppStore: "https://apps.apple.com/app/quick-tutor-ghana/id6400000000"
    }
  });
});

// Direct APK download route
router.get("/download/apk", (req: Request, res: Response) => {
  const possiblePaths = [
    path.join(__dirname, "../../../mobile/build/app/outputs/flutter-apk/app-release.apk"),
    path.join(__dirname, "../../../mobile/build/app/outputs/apk/release/app-release.apk"),
    path.join(__dirname, "../../public/downloads/QuickTutor.apk"),
    path.join(__dirname, "../../../public/downloads/QuickTutor.apk"),
  ];

  for (const apkPath of possiblePaths) {
    if (fs.existsSync(apkPath)) {
      return res.download(apkPath, "QuickTutor-v1.0.0.apk");
    }
  }

  // If the binary hasn't been compiled yet with `flutter build apk`
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Quick Tutor APK Build Required</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0e1512; color: #fff; padding: 2rem; max-width: 600px; margin: 0 auto; line-height: 1.6; }
        .card { background: #16211c; border: 1px solid #24332b; border-radius: 16px; padding: 24px; margin-top: 20px; }
        code { background: #090e0c; padding: 3px 8px; border-radius: 6px; color: #e5a93c; font-size: 14px; }
        pre { background: #090e0c; padding: 14px; border-radius: 10px; overflow-x: auto; color: #4ade80; font-size: 13px; }
        h1 { font-size: 22px; color: #e5a93c; }
        .badge { display: inline-block; background: #0d5c3a; color: #fff; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; }
      </style>
    </head>
    <body>
      <span class="badge">Quick Tutor Flutter Mobile App 🇬🇭</span>
      <div class="card">
        <h1>APK Binary Not Compiled Yet</h1>
        <p>The Flutter source code is located in the <code>mobile/</code> folder. To generate the real installable Android <code>.apk</code> binary file, run this command on your machine with Flutter installed:</p>
        <pre>cd mobile
flutter pub get
flutter build apk --release</pre>
        <p>Once built, this download link will automatically serve the compiled binary APK (approx 18-25 MB).</p>
      </div>
    </body>
    </html>
  `);
});

export default router;
