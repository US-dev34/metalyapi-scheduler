#!/usr/bin/env bash
set -euo pipefail

echo "============================================"
echo " MetalYapi Deployment Script"
echo "============================================"
echo

# -----------------------------------------------
# 1. Deploy Backend to Railway
# -----------------------------------------------
echo "[1/3] Deploying backend to Railway..."
if command -v railway &>/dev/null; then
    railway up --detach
    echo "  Backend deployed. Check Railway dashboard for URL."
else
    echo "  SKIP: Railway CLI not installed."
    echo "  Install: npm i -g @railway/cli && railway login"
fi

echo

# -----------------------------------------------
# 2. Deploy Frontend to Vercel
# -----------------------------------------------
echo "[2/3] Deploying frontend to Vercel..."
if command -v vercel &>/dev/null; then
    cd frontend
    vercel --prod --yes
    cd ..
    echo "  Frontend deployed. Check Vercel dashboard for URL."
else
    echo "  SKIP: Vercel CLI not installed."
    echo "  Install: npm i -g vercel && vercel login"
fi

echo

# -----------------------------------------------
# 3. Post-deploy checks
# -----------------------------------------------
echo "[3/3] Post-deployment checklist:"
echo "  [ ] Set backend env vars in Railway:"
echo "      SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY"
echo "      CLAUDE_API_KEY, CLAUDE_MODEL, CORS_ORIGINS, ENVIRONMENT=production"
echo "  [ ] Set frontend env vars in Vercel:"
echo "      VITE_API_BASE_URL (Railway backend URL)"
echo "      VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY"
echo "  [ ] Update CORS_ORIGINS to include Vercel frontend URL"
echo "  [ ] Run Supabase migrations (004, 005) via SQL editor"
echo "  [ ] Create admin user in Supabase Auth"
echo "  [ ] Add admin to project_members table"
echo

echo "Done."
