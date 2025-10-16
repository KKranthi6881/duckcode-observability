# DuckCode Project Installation Guide

This guide provides step-by-step instructions for developers to clone, install, and set up the DuckCode project for development and enhancements.

## 📋 Prerequisites

Before starting, ensure you have the following installed on your system:

- **Node.js** (v18.0.0 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** - [Download here](https://git-scm.com/)
- **VS Code** - [Download here](https://code.visualstudio.com/) (recommended for development)
- **Supabase CLI** (optional, for local database development) - [Installation guide](https://supabase.com/docs/guides/cli)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd duck-main
```

### 2. Project Structure Overview

The project contains three main components:

```
duck-main/
├── duck-code/                    # VS Code Extension
├── duckcode-observability/       # SaaS Web Application
│   ├── frontend/                 # React Frontend
│   ├── backend/                  # Node.js Backend
│   └── supabase/                 # Database & Auth
└── INSTALLATION.md               # This file
```

## 🔧 Component Installation

### A. DuckCode VS Code Extension

The main AI coding assistant extension for VS Code.

```bash
# Navigate to extension directory
cd duck-code

# Install dependencies for all components
npm run install:all

# This installs:
# - Extension dependencies
# - WebView UI dependencies  
# - E2E test dependencies
```

**Build the Extension:**

```bash
# Build Tantivy search components (Rust-based)
npm run build:tantivy:platform

# Build WebView UI
npm run build:webview

# Compile TypeScript and bundle
npm run compile

# Create extension package
npm run vsix
```

**Development Mode:**

```bash
# Watch mode for development
npm run watch

# Run tests
npm run test

# Lint code
npm run lint
```

### B. DuckCode Observability (SaaS Platform)

The web-based SaaS platform for authentication and observability.

#### Backend Setup

```bash
# Navigate to backend directory
cd duckcode-observability/backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your configuration:
# SUPABASE_URL=your_supabase_url
# SUPABASE_ANON_KEY=your_supabase_anon_key
# JWT_SECRET=your_jwt_secret
# PORT=3001
```

**Start Backend Development Server:**

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build
npm start
```

#### Frontend Setup

```bash
# Navigate to frontend directory
cd duckcode-observability/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5175`

#### Supabase Setup (Optional)

For local database development:

```bash
# Navigate to supabase directory
cd duckcode-observability/supabase

# Start local Supabase (requires Docker)
supabase start

# Apply migrations
supabase db reset

# Generate types (optional)
supabase gen types typescript --local > types/database.types.ts
```

## 🔑 Authentication Flow Setup

The project includes OAuth authentication between the VS Code extension and the SaaS platform.

### Environment Variables

**Backend (.env):**
```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret_minimum_32_characters
PORT=3001
NODE_ENV=development
```

**Frontend (.env):**
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_BASE_URL=http://localhost:3001
```

### OAuth Configuration

The authentication flow uses these endpoints:
- **Login:** `http://localhost:5175/ide/login`
- **Register:** `http://localhost:5175/ide/register`
- **Authorization:** `http://localhost:3001/api/auth/ide/authorize`
- **Token Exchange:** `http://localhost:3001/api/auth/ide/token`

### Waitlist Mode (Early Access)

For a limited time, registration is routed to a waitlist so you can approve users before granting access.

1. Configure backend environment variables in `duckcode-observability/backend/.env`:

```env
ADMIN_EMAILS=founder@company.com,admin@company.com
JWT_SECRET=your_jwt_secret_minimum_32_characters
```

2. Apply the Supabase migration for the waitlist table:

```bash
cd duckcode-observability/supabase
# This will start local Supabase (if not running) and apply all migrations
supabase db reset
```

3. Endpoints:

- Public join: `POST http://localhost:3001/api/waitlist/join`
  - Body: `{ email, full_name?, plan_choice: 'own_api_key'|'free_50_pro', agent_interests: string[], source?: 'web'|'ide' }`
- Admin list: `GET http://localhost:3001/api/waitlist?status=pending|approved|rejected`
- Admin approve: `PUT http://localhost:3001/api/waitlist/:id/approve` (sends Supabase invite or magic link)
- Admin reject: `PUT http://localhost:3001/api/waitlist/:id/reject`

4. Frontend behavior:

- The SaaS `/register` and `/ide-register` pages now collect extra fields (plan choice and agent interest) and submit to the waitlist instead of creating an auth user.
- The IDE webview's Sign Up opens the waitlist page and does not wait for an auth callback.
- Users see a confirmation message that they are on the waitlist and should watch email.

## 🛠️ Development Workflow

### 1. Start All Services

```bash
# Terminal 1: Backend
cd duckcode-observability/backend
npm run dev

# Terminal 2: Frontend  
cd duckcode-observability/frontend
npm run dev

# Terminal 3: Supabase (if using local)
cd duckcode-observability/supabase
supabase start

# Terminal 4: Extension Development
cd duck-code
npm run watch
```

### 2. Load Extension in VS Code

1. Open VS Code
2. Press `F5` or go to **Run > Start Debugging**
3. Select **VS Code Extension Development Host**
4. A new VS Code window opens with the extension loaded
5. Open the DuckCode panel from the Activity Bar

### 3. Test Authentication Flow

1. Click "Sign In" in the DuckCode extension
2. Browser opens to `http://localhost:5175/ide/login`
3. Enter credentials and submit
4. Browser redirects back to VS Code
5. Extension shows authenticated state

## 📦 Building for Production

### Extension Package

```bash
cd duck-code

# Full production build
npm run build

# This creates duck-code-x.x.x.vsix in the bin/ directory
```

### SaaS Platform

```bash
# Backend
cd duckcode-observability/backend
npm run build

# Frontend
cd duckcode-observability/frontend
npm run build
```

## 🧪 Testing

### Extension Tests

```bash
cd duck-code

# Run all tests
npm run test

# Run specific test suites
npm run test:extension
npm run test:webview

# E2E tests
cd e2e
npm run test
```

### Backend Tests

```bash
cd duckcode-observability/backend
npm run test
```

## 🔍 Troubleshooting

### Common Issues

**1. Extension not loading:**
- Ensure all dependencies are installed: `npm run install:all`
- Check VS Code version compatibility (v1.95.0+)
- Rebuild Tantivy components: `npm run build:tantivy:platform`

**2. Authentication not working:**
- Verify backend is running on port 3001
- Check JWT_SECRET is properly configured
- Ensure Supabase is running and accessible

**3. Build failures:**
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version (18.0.0+)
- Verify all environment variables are set

**4. WebView not displaying:**
- Rebuild WebView UI: `npm run build:webview`
- Check browser console for errors
- Verify React dependencies are installed

### Debug Mode

Enable debug logging:

```bash
# Extension debug mode
export DEBUG=duck-code:*

# Backend debug mode
export NODE_ENV=development
export DEBUG=backend:*
```

## 🚀 Ready for Enhancements

Once installation is complete, you can:

1. **Modify Extension Features:** Edit files in `duck-code/src/`
2. **Enhance WebView UI:** Modify `duck-code/webview-ui/src/`
3. **Add Backend APIs:** Extend `duckcode-observability/backend/src/routes/`
4. **Update Frontend:** Enhance `duckcode-observability/frontend/src/`
5. **Database Changes:** Add migrations in `duckcode-observability/supabase/migrations/`

## 📚 Key Files for Development

### Extension Core
- `duck-code/src/extension.ts` - Main extension entry point
- `duck-code/src/core/webview/ClineProvider.ts` - WebView provider
- `duck-code/src/services/cloud/DuckCodeCloudService.ts` - Cloud integration

### Authentication
- `duck-code/src/activate/handleUri.ts` - OAuth URI handler
- `duckcode-observability/backend/src/routes/auth.ts` - Auth endpoints
- `duckcode-observability/frontend/src/pages/IDELoginPage.tsx` - Login UI

### WebView UI
- `duck-code/webview-ui/src/App.tsx` - Main React app
- `duck-code/webview-ui/src/services/authService.ts` - Auth service

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Test thoroughly using the development workflow
4. Commit with clear messages
5. Push and create a pull request

## 📞 Support

For development questions or issues:
- Check existing GitHub issues
- Review the authentication flow documentation
- Test with the provided OAuth endpoints
- Verify all environment variables are correctly configured

---

**Happy coding with DuckCode! 🦆**
