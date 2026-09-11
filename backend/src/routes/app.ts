import express, { Request, Response } from "express";

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
  res.setHeader("Content-Disposition", 'attachment; filename="QuickTutor-v1.0.0.apk"');
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  
  // Note: When deployed, this can stream the compiled APK file.
  // Returning a clean mock JSON or file response for now.
  res.json({
    message: "Quick Tutor Flutter Android APK v1.0.0 ready for download.",
    instructions: "Install the APK on your Android device and enable 'Install from unknown sources' if prompted.",
    file: "QuickTutor-v1.0.0.apk",
    version: "1.0.0"
  });
});

export default router;
