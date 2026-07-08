# 📦 Clipixx - Database Setup Guide

## Prerequisites
- **PostgreSQL 15+** installed and running
- **Node.js 18+** installed
- **npm** installed

## 🗄️ Database Setup (Required First!)

### Option 1: Quick Setup (Recommended)
Run this single command to create the database with tables and seed data:

```bash
# Windows (PowerShell)
psql -U postgres -f backend/scripts/setup_database.sql

# Mac/Linux
sudo -u postgres psql -f backend/scripts/setup_database.sql
```

### Option 2: Full Database Restore
If you want an exact copy of the original database (with all existing data):

```bash
# Step 1: Create the database
psql -U postgres -c "CREATE DATABASE clipixx;"

# Step 2: Import the full dump
psql -U postgres -d clipixx -f backend/scripts/clipixx_full_dump.sql
```

## ⚙️ Backend Setup

```bash
# 1. Navigate to backend
cd backend

# 2. Copy the example env file
cp .env.example .env
# (Edit .env if your PostgreSQL password is different)

# 3. Install dependencies
npm install

# 4. Start the server
npm start
```

## 🖥️ Frontend Setup

```bash
# 1. From the project root
npm install

# 2. Start the dev server
npm run dev
```

## 🔐 Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | localhost | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_USER` | postgres | Database user |
| `DB_PASSWORD` | clipixx123 | Database password |
| `DB_NAME` | clipixx | Database name |
| `PORT` | 5000 | Backend server port |

## 📊 Database Tables
| Table | Description |
|-------|-------------|
| `stars` | Celebrity/creator profiles with pricing (16 seed records) |
| `profiles` | User profiles linked to Firebase Auth |
| `star_suggestions` | User-submitted celebrity suggestions |
| `creator_applications` | Creator signup applications |
| `feedback` | User feedback submissions |
