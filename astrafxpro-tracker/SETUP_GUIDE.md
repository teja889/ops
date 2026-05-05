# AstraFXPro Payment Tracker — Setup Guide

## What's in this package
```
astrafxpro-tracker/
├── server.js                         ← Backend (Node.js)
├── package.json
├── railway.toml                      ← Railway deploy config
├── public/
│   └── dashboard.html                ← Your admin dashboard
└── astrafxpro-workshop-tracked.html  ← Updated payment page (with tracking)
```

---

## STEP 1: Deploy Backend to Railway (Free)

1. Go to https://railway.app and sign up (free)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
   - OR click **"New Project"** → **"Empty Project"** → drag & drop this folder
3. Upload the entire `astrafxpro-tracker/` folder
4. Railway will auto-detect Node.js and run `node server.js`
5. Once deployed, click **"Generate Domain"** — you'll get a URL like:
   ```
   https://astrafxpro-tracker-production.up.railway.app
   ```
   **Copy this URL — you need it in Step 3.**

---

## STEP 2: Set Environment Variables on Railway

In your Railway project → **Variables** tab, add these:

| Variable | Value |
|---|---|
| `RAZORPAY_KEY_ID` | `rzp_live_SfgmYpvpywG10z` |
| `RAZORPAY_KEY_SECRET` | `Qz3rmpn3vqoAct7LKWwefvV7` |
| `WEBHOOK_SECRET` | `9490655953` |
| `TELEGRAM_BOT_TOKEN` | `8739190401:AAEYLj3eAddOxOpWXPdynOHQjBIPjNmWdWQ` |
| `TELEGRAM_CHAT_ID` | `2103157568` |
| `DASHBOARD_PASSWORD` | `2026` |
| `PORT` | `3000` |

---

## STEP 3: Update Your Payment Page

Open `astrafxpro-workshop-tracked.html` and find line ~22:

```javascript
trackerUrl: "https://YOUR-RAILWAY-APP.up.railway.app",
```

Replace with your actual Railway URL from Step 1:

```javascript
trackerUrl: "https://astrafxpro-tracker-production.up.railway.app",
```

---

## STEP 4: Set Up Razorpay Webhook

1. Go to Razorpay Dashboard → **Settings** → **Webhooks**
2. Click **"Add New Webhook"**
3. Set **Webhook URL** to:
   ```
   https://YOUR-RAILWAY-URL.up.railway.app/webhook/razorpay
   ```
4. Set **Webhook Secret** to: `9490655953`
5. Enable these events:
   - ✅ `payment.captured`
   - ✅ `payment.failed`
6. Click **Save**

---

## STEP 5: Access Your Dashboard

Go to:
```
https://YOUR-RAILWAY-URL.up.railway.app/dashboard.html
```

Password: `2026`

---

## STEP 6: Upload Payment Page

Upload `astrafxpro-workshop-tracked.html` to your website (Netlify/Vercel/wherever).

---

## How Tracking Works

| User Action | What Happens |
|---|---|
| Clicks "Enroll Now" | Lead capture form pops up |
| Fills name/phone/email | 🎯 **LEAD** event → Telegram + Dashboard |
| Razorpay opens | 💳 **INITIATED** event → Telegram + Dashboard |
| Payment succeeds | ✅ **SUCCESS** event → Telegram + Dashboard |
| Payment fails | ❌ **FAILED** event (with reason) → Telegram + Dashboard |
| Closes Razorpay popup | 🚪 **ABANDONED** event → Telegram + Dashboard |
| Razorpay webhook fires | Double-confirms SUCCESS/FAILED server-side |

---

## Telegram Bot Setup Check

Make sure you:
1. Have started a conversation with @astrafxpro_bot (send it `/start`)
2. The bot is in your chat/group

Test it by visiting:
```
https://YOUR-RAILWAY-URL.up.railway.app/track
```
(POST a test event — or just make a test payment on the page)
