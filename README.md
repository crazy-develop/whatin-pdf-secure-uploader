# 🔒 Surakshit PDF Portal - Secure PDF Storage & Document Vault

A highly secure, full-stack document portal built with **React, TypeScript, Express / Node.js, and PDF.js**. It categorizes study materials subject-wise, allowing students to securely read documents within the application on an HTML5 canvas layer while completely restricting downloads, print shortcuts, saves, and right-clicks.

---

## 🚀 Key Security Features
1. **HTML5 Canvas PDF Rendering**: No absolute `blob:` references or native browser PDF plug-ins are exposed inside the frame. Chrome sandbox triggers are bypassed and reading happens purely inside a protective sandbox container.
2. **Restrictive Security Policies**: 
   - Right-click Context Menu is fully custom-logged and intercepted.
   - Print hotkeys (`Ctrl+P` / `Cmd+P`), dev-tools (`F12`), and page-save commands (`Ctrl+S` / `Cmd+S`) are caught dynamically and disabled.
   - Dynamic injection of CSS `@media print` hidden rules fully blanks the page if a print spooler is invoked.
3. **One-Time Session Tickets (OTT)**: PDF streams are authorized with single-use server-side tickets that expire in 15 seconds. Direct links cannot be shared, scraped, or curl'd.
4. **Dynamic Transparency Watermarks**: Real-time user email and telemetry IP footprints are overlaid across the viewing stage to prevent physical camera capture leakages.

---

## 🛠️ Prerequisite Tools (Kya-Kya Install Hona Chahiye)
Bina kisi error ke local system par portal run karne ke liye neeche diye gaye tools installed hone chahiye:

1. **Node.js** (v18 or higher recommended)  
   👉 [Node.js Official Website](https://nodejs.org/) se compile and install karein.
2. **NPM** (Node Package Manager - auto-installed with Node)

---

## 💻 Local Installation Steps (Apne Computer Me Run Karne Ka Tarika)

Sabhi commands step-by-step follow karein:

### Step 1: Extract / Clone project files
Sabse pehle project folder ko apne computer me extract ya open karein aur folder ke root directory par terminal/cmd launch karein.

### Step 2: Install Dependencies (NPM Package files install karein)
Apne terminal me niche di gayi command run karein:
```bash
npm install
```
*Yeh command saare components, server plugins (`express`, `@google/genai`, `esbuild`, `tsx`), styles, aur utilities (`lucide-react`, `motion`) automatically download karke `node_modules` me set kar degi.*

### Step 3: Setup Environment Variables (Optional)
Apne root directory me ek `.env` naam ki copy banayein `.env.example` se:
- Windows: `copy .env.example .env`
- Mac/Linux: `cp .env.example .env`

---

## 🏃‍♂️ Commands to Run Locally (Run Karne Ki Commands)

### 1. Developer Mode (Instant Dev Server)
Agar aap features test aur modify karna chahte hain toh continuous auto-refresh ke liye is command ka use karein:
```bash
npm run dev
```
- Is command ko run karne ke baad browser me open karein: `http://localhost:3000`
- Yeh command internal file execution script (Vite dev proxy + `tsx server.ts`) se system boot kar degi.

---

### 2. Production Build and Execution (Production ke liye heavy compilation)
Yeh setup code ko compile, compress aur secure karke build directory taiyaar karein:

**A. React Static aur Express Server Build karein:**
```bash
npm run build
```
*Yeh automatic React app ko standard `dist/` folder me minify karegi, aur `esbuild` framework ke through server-side `server.ts` ko raw CommonJS standard (`dist/server.cjs`) standard me convert kar degi to bypass path errors.*

**B. Built Application and Vault launch karein:**
```bash
npm run start
```
- Is command ko run karne ke baad application **Port 3000** pe host safe start hogi: `http://localhost:3000`

---

## 📂 Physical Storage Folder Setup
- **Storage Path**: Jab aap pahli baar files upload karenge, portal automatically root directory me ek naya folder create karega: `/pdf_storage/`
- **Metadata Management**: `/pdf_storage/metadata.json` me saare Security logs, Subjects details, aur documents list dynamically written aur saved hongi, jisse system restarts par logs aur subjects loose nahi hotey.

Enjoy your secure reading workspace! 🛡️
