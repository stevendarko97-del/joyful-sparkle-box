# Quick Tutor — Ghana 1-on-1 Tutoring & Exam Preparation Platform 🇬🇭

A full-stack, real-time educational marketplace connecting Ghanaian students preparing for **BECE, WASSCE, NOV/DEC, and Remedials** with verified expert tutors. Features live WebRTC classrooms, Paystack Mobile Money escrow payments, automated Arkesel SMS reminders, and administrative payout dispatch.

---

## 🌟 Key Features

- **Tutor Discovery & Filtering**: Search by subject, curriculum exam, region, rate, and automatic star rating.
- **Paystack Mobile Money Escrow**: 100% of student funds are held securely in escrow until lesson completion.
- **Automated Payout Ledger (85% / 15%)**: 15% platform commission retained; 85% net take-home queued for tutor MoMo payout.
- **WebRTC Live Classroom**: Real-time peer-to-peer video & audio, interactive whiteboard, instant chat, screen sharing, and post-session wrap-up confirmation.
- **Payment-Gated Security**: Unpaid sessions are locked from entering the video classroom.
- **Automated SMS Alerts (Arkesel API)**: Automatic Ghanaian SMS reminders sent 30 minutes & 5 minutes prior to scheduled lessons, plus payment receipts and admin alerts.
- **Comprehensive Policies**: Terms of Service, Escrow Conditions, Tutor Code of Conduct, and Ghana Data Protection Act 2012 privacy terms.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- [Node.js (v18+)](https://nodejs.org/)
- [PostgreSQL](https://www.postgresql.org/) (or Supabase Postgres)

### 2. Clone the Repository
```bash
git clone https://github.com/stevendarko97-del/joyful-sparkle-box.git
cd joyful-sparkle-box
```

### 3. Install Dependencies
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 4. Configure Environment Variables
Copy `.env.example` to `.env` in both the root and `backend/` directories:
```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

Set your variables in `.env` and `backend/.env`:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Random secret string
- `PAYSTACK_SECRET_KEY` & `VITE_PAYSTACK_PUBLIC_KEY`: Paystack keys
- `ARKESEL_API_KEY` (Optional): Arkesel Ghana SMS API key

### 5. Initialize the Database
```bash
# Run PostgreSQL init script
psql "$DATABASE_URL" -f init.sql
```

### 6. Run the Application
In two separate terminals:

**Terminal 1 (Backend API & Socket Server):**
```bash
cd backend
npm run dev
# Server running at http://localhost:4000
```

**Terminal 2 (Frontend Client):**
```bash
npm run dev
# Frontend running at http://localhost:8080 (or http://localhost:5173)
```

---

## 🏗️ Tech Stack

- **Frontend**: React 18, Vite, TanStack Router & Query, TailwindCSS, Lucide Icons, Sonner.
- **Backend**: Node.js, Express, TypeScript, Socket.IO, PostgreSQL (`pg`), JWT, Bcrypt.
- **Real-Time Video**: WebRTC (STUN/ICE), Canvas Whiteboard.
- **Payments**: Paystack Inline Popup & Webhooks (MTN MoMo, Telecel Cash, AT Money, Debit Cards).
- **Notifications**: Arkesel Ghana SMS Gateway.

---

## 📄 License
MIT License. Built for education in Ghana.
