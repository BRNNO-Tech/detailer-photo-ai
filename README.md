<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DetailerPro AI - Content Studio

AI-powered content creation suite for auto detailing professionals. Generate social media content, enhance photos, and create stunning video clips with AI.

## Features

- 📸 **Photo Enhancement** - AI-powered image enhancement with brightness, contrast, and saturation adjustments
- 🎥 **Video Generation** - Create cinematic video clips from photos using Google's Veo model
- 📱 **Social Media Pack** - Auto-generate captions, hashtags, and TikTok scripts
- 🤖 **AI Photo Pairing** - Intelligent before/after photo detection
- 💾 **Project Management** - Save and manage your projects locally
- ⌨️ **Keyboard Shortcuts** - Fast navigation with keyboard shortcuts

## Run Locally

**Prerequisites:** Node.js 18+ and a Gemini API key

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3001`

## Deploy to Vercel

1. **Push your code to GitHub**

2. **Import your project to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

3. **Add Environment Variable:**
   - In Vercel project settings, go to "Environment Variables"
   - Add `GEMINI_API_KEY` with your API key value
   - Make sure it's available for Production, Preview, and Development

4. **Deploy:**
   - Vercel will automatically detect Vite and deploy
   - Your app will be live at `your-project.vercel.app`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Your Google Gemini API key | Yes |

Get your API key from: https://ai.google.dev/

## Keyboard Shortcuts

- `Escape` - Go back or return to dashboard
- `Ctrl/Cmd + S` - Save/Export current project
- `Ctrl/Cmd + K` - Open settings
- `1-6` - Quick select services from dashboard

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Google Gemini API** - AI content generation
- **Google Veo** - Video generation

## Project Structure

```
├── App.tsx              # Main application component
├── geminiService.ts     # AI content generation services
├── videoService.ts      # Video generation service
├── types.ts             # TypeScript type definitions
├── constants.tsx         # App constants and services
├── ErrorBoundary.tsx    # Error handling component
└── vercel.json          # Vercel deployment config
```

## License

Private - All rights reserved
