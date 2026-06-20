# 💰 Money Record

Money Record is a feature-rich, offline-first Progressive Web App (PWA) designed to help students manage their personal finances, track academic deadlines, and monitor their health in one unified platform. 

Built with entirely vanilla web technologies, the application demonstrates advanced browser capabilities including Service Workers for offline sync, local storage management, and client-side image compression, all backed by a cloud database and AI integrations.

## ✨ Key Features

* **Offline-First Architecture:** Utilizes a Service Worker (`sw.js`) and `localStorage` to allow users to add transactions even without an internet connection. Data is queued and automatically synced with the backend once the connection is restored.
* **Comprehensive Finance Tracking:** Log income and expenses, set monthly category budgets, create custom categories, and track progress toward savings goals.
* **Smart Receipt & Photo Uploads:** Users can attach photos to transactions. Images are efficiently compressed on the client-side (via Canvas API) before uploading to save bandwidth and storage.
* **AI Food Calorie Estimation:** Users can snap a photo of their meal, and the app leverages Google's Gemini AI (via a secure serverless Edge Function) to automatically identify the food and estimate its caloric value.
* **Student Productivity Tools:** Includes a built-in Homework tracker to manage assignments and due dates alongside financial responsibilities.
* **Data Visualizations:** Interactive doughnut and bar charts (using lazy-loaded Chart.js) provide a clear breakdown of spending habits over time.
* **PWA Installable:** Can be installed directly to a device's home screen as a native-feeling app with a customized manifest.

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (No frameworks like React or Vue were used, demonstrating strong foundational web development skills).
* **Backend/Database:** [Supabase](https://supabase.com/) (PostgreSQL, Supabase Auth, and Supabase Storage for photos).
* **Serverless Functions:** Deno-based Supabase Edge Functions (`index.ts`).
* **Artificial Intelligence:** Google Gemini 2.5 Flash API.
* **Data Visualization:** [Chart.js](https://www.chartjs.org/).

## 🚀 Setup & Installation

### 1. Database Setup (Supabase)
Create a new Supabase project and set up the following tables:
* `transactions` (id, description, amount, type, category, date, photo_url, created_at)
* `homework` (id, title, subject, due_date, done)
* `food_logs` (id, date, photo_url, food_name, calories, created_at)
* `calorie_burn` (burn_date, calories)
* Create a public storage bucket named `app-photos` for storing receipt and food images.

### 2. Edge Function Setup (AI Calorie Tracker)
To enable the Gemini AI food tracking feature, deploy the Edge Function:
1. Ensure the Supabase CLI is installed.
2. Navigate to your project root and deploy the function:
   ```bash
   supabase functions deploy estimate-calories
