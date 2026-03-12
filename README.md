<h1 align="center">💼 Smart Portfolio & Expense Manager</h1>

<p align="center">
  <strong>Track Your Wealth Journey with Ease</strong>
</p>

<p align="center">
  A fully responsive, offline-first personal finance application built with Vanilla JS, CSS, HTML, and Firebase. Efficiently track your investments (Stocks, Mutual Funds) and every-day expenses in one secure place!
</p>

<hr>

## ✨ Key Features
- **📈 Stock & Mutual Fund Tracking:** Maintain your investment portfolios, calculate running averages, realize P&L, and track unrealized gains in real-time.
- **💳 Wallet & Expense Management:** Categorize your day-to-day spending, track bank deposits, and maintain running balances for different accounts.
- **📊 Analytics & Graphs:** Visualize your wealth growth over time using interactive Chart.js graphs.
- **🌙 Dark Mode Support:** Easy on the eyes and completely native dark theme built with pure CSS.
- **🛡️ Private & Secure:** Configured as a private web app with Firebase backend handling robust email/password authentication.
- **📥 Import/Export & Reports:** Effortlessly generate PDF reports of your finances or backup/restore your complete database using JSON files.

---

## 🚀 Getting Started

Follow these step-by-step instructions to get the application running on your own local environment.

### Prerequisites

You need a minimal local web server to run this application since it utilizes ES6 modules (`import/export`). If you just double-click the `index.html` file, you might face CORS errors in the browser.

You can use:
- **VS Code Live Server Extension** (Recommended)
- Node.js `http-server`
- Python `http.server`

### 🛠️ 1. Setup Firebase Backend

This app requires a Firebase project for Authentication and Firestore Database.

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project (e.g., `smart-portfolio`).
3. Add a **Web App** to the project.
4. Go to **Authentication** -> **Sign-in method** and enable **Email/Password**.
5. Go to **Firestore Database** -> **Create Database** (Start in Test Mode for development).
6. Copy your **Firebase Config keys**.

### 🔑 2. Configure the App

1. Clone or download this repository.
2. Navigate to the `js` folder and open `firebase-config.js`.
3. Replace the placeholder values with your actual Firebase configuration keys:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};
```

### 🔐 3. Set Up Admin Access

By default, the application is strictly private and only allows pre-approved emails to authenticate and access the data.

1. Open `js/main.js`.
2. Locate the **SECURITY CONFIG** section right at the top.
3. Replace the placeholder email with the email address you plan to use:

```javascript
// --- SECURITY CONFIG ---
const ALLOWED_USERS = ['your.email@example.com']; 
```

### 💻 4. Run the Application

1. Open the project folder in VS Code.
2. Start your local server (e.g., click "Go Live" if using the Live Server extension).
3. Navigate to the local URL (e.g., `http://127.0.0.1:5500`).
4. **Sign up** using the exact email you added to the `ALLOWED_USERS` array.
5. You're in! Start adding your banks, executing transactions, and tracking your wealth!

---

## 🛠️ Built With

* **HTML5** (Semantics & Structure)
* **CSS3** (Custom Properties, Flexbox, Grid, Animations & Dark Mode)
* **Vanilla JavaScript (ES6)** (Modules, DOM manipulation, Async/Await logic)
* **Firebase V10** (Firestore & Auth)
* [**Chart.js**](https://www.chartjs.org/) (Data Visualization)
* [**jsPDF**](https://github.com/parallax/jsPDF) (Report Generation)

---

> **Note:** Since this app uses a pure front-end architecture to communicate directly with Firestore, it is highly recommended to eventually set up proper **Firestore Security Rules** before using it in a production environment with sensitive financial data.
