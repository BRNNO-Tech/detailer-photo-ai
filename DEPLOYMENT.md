# Deployment Checklist for Vercel

## Pre-Deployment Checklist

- [x] Error boundary added for crash protection
- [x] SEO meta tags added
- [x] Environment variable validation
- [x] Build optimizations configured
- [x] .gitignore updated (protects .env files)
- [x] vercel.json configuration created
- [x] README updated with deployment instructions

## Vercel Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Ready for production deployment"
git push origin main
```

### 2. Import to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Vite configuration

### 3. Configure Environment Variables
In Vercel project settings → Environment Variables:
- **Variable Name:** `GEMINI_API_KEY`
- **Value:** Your Gemini API key
- **Environment:** Production, Preview, Development (check all)

### 4. Deploy
- Vercel will automatically build and deploy
- First deployment may take 2-3 minutes
- You'll get a URL like: `your-project.vercel.app`

## Post-Deployment

### Verify
- [ ] App loads correctly
- [ ] API key is working (test photo upload)
- [ ] Video generation works
- [ ] Projects save/load correctly
- [ ] All features functional

### Optional Optimizations
- [ ] Add custom domain
- [ ] Enable Vercel Analytics
- [ ] Set up preview deployments for PRs
- [ ] Configure rate limiting if needed

## Troubleshooting

**Build fails:**
- Check that all dependencies are in package.json
- Verify Node.js version (18+)
- Check build logs in Vercel dashboard

**API key not working:**
- Verify environment variable is set in Vercel
- Check variable name matches exactly: `GEMINI_API_KEY`
- Redeploy after adding environment variable

**App crashes:**
- Check browser console for errors
- Verify ErrorBoundary is catching errors
- Check Vercel function logs

## Environment Variables Reference

| Variable | Description | Where to Set |
|----------|-------------|--------------|
| `GEMINI_API_KEY` | Google Gemini API key (server-side only; never exposed to the client) | Vercel Dashboard → Settings → Environment Variables |

Get your API key: https://ai.google.dev/

## Local development with AI

The app calls Gemini via server API routes (`/api/gemini`, `/api/video`). The API key is only used on the server. For local development with AI features, run:

```bash
vercel dev
```

This serves both the Vite app and the API routes; set `GEMINI_API_KEY` in `.env.local` and Vercel will inject it into the API routes.
