#!/bin/bash
# MetalYapi Scheduling Platform — Database Seed Script

set -e

echo "=== Seeding Database ==="

if command -v supabase &> /dev/null; then
    echo "Using Supabase CLI..."
    supabase db reset
    echo "Database reset and seeded."
else
    echo "Supabase CLI not found."
    echo "Please install: npm install -g supabase"
    echo "Or manually run: supabase/seed.sql against your database"
    exit 1
fi

echo "Seed complete."
