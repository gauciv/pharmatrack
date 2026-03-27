# PharmaTrack

PharmaTrack is a desktop pharmaceutical inventory management system built with Electron, React, TypeScript, Tailwind CSS, and Firebase. It helps teams monitor stock, review vendors, export reports, and track product expiry with FIFO-aware inventory visibility.

## Highlights

- Secure Firebase-backed authentication and Firestore data storage
- Inventory management with searchable and filterable product records
- Expiry tracking with FIFO lot visibility and expired-product monitoring
- Forecast and vendor management dashboards
- CSV and PDF export support for operational reporting
- Desktop-first Electron experience with light and dark theme support

## Tech Stack

- Electron
- React
- TypeScript
- Vite / Electron Vite
- Tailwind CSS
- Firebase Authentication
- Cloud Firestore
- jsPDF

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A Firebase project with Authentication and Firestore enabled

### Installation

```bash
npm install
```

### Environment Setup

Copy `.env.example` to `.env` in the project root and provide your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

If Firebase is not configured, the app will show an in-app setup prompt on launch.

## Available Scripts

```bash
npm run dev
```

Starts the Electron app in development mode.

```bash
npm run build
```

Builds the Electron main process, preload script, and renderer for production.

```bash
npm run preview
```

Runs the production preview build.

```bash
npm run typecheck
```

Runs TypeScript type checking without emitting files.

## Project Structure

```text
src/
  main/              Electron main process
  preload/           Electron preload bridge
  renderer/src/      React application
    components/      Shared UI and feature components
    contexts/        Auth and theme providers
    hooks/           Data hooks
    lib/             Firebase, export, inventory, and expiry logic
    pages/           Dashboard pages
resources/           App icons and packaging assets
scripts/             Local project helper scripts
```

## Core Modules

- `Inventory`: product records, filters, detail view, expiry/FIFO tracking
- `Dashboard`: operational summary and expired-product monitoring
- `Forecast`: stock planning support
- `Vendors`: vendor-related inventory views
- `Settings`: export tools and app configuration surfaces

## Notes

- The project uses a small `postinstall` compatibility script for `cac` to avoid install/runtime issues in some environments.
- The helper launcher in `scripts/unset-electron-node.js` ensures Electron-related commands run reliably across environments.

## Build Output

Production output is generated in the `out/` directory.

