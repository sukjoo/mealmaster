<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/1bcc75f4-d3e3-47cf-85ec-5acbb9bdbd1a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create [.env.local](.env.local) from [.env.example](.env.example)
3. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
4. Set all `VITE_FIREBASE_*` values in [.env.local](.env.local) using your Firebase web app config
5. In Firebase Console, enable Google provider in Authentication > Sign-in method
6. Run the app:
   `npm run dev`
