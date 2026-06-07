# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SilenceAI is a local-first video editing application that removes silence from videos using browser-based processing. It uses FFmpeg WASM and WebCodecs API to process videos entirely in the browser - no uploading to servers.

## Commands

```bash
npm run dev     # Start development server
npm run build   # Build for production
npm run start   # Run production server
npm run lint   # Run ESLint
```

## Architecture

The app consists of:
- **Browser-based video processing** (`lib/ffmpeg.ts`, `lib/ffmpeg-processor.ts`, `lib/audio-processor.ts`): Uses FFmpeg WASM loaded from unpkg.com to process video files entirely client-side
- **Authentication** (`app/api/auth/[...nextauth]/route.ts`): NextAuth with Google provider, stores users in MongoDB
- **User data** (`lib/mongodb.ts`, `lib/models.ts`): MongoDB/Mongoose for persisting user accounts and pro status

### Key Files

- `components/Dropzone.tsx`: File upload component accepting video files (MP4, MOV, AVI, WebM, MKV)
- `components/Editor.tsx`: Main editing interface with waveform visualization and timeline
- `lib/audio-processor.ts`: Analyzes audio to detect silence using Web Audio API
- `lib/ffmpeg-processor.ts`: Applies edits using FFmpeg (cuts silence, speed ramping)
- `hooks/useHistory.ts`: Undo/redo state management for editor

## Important Notes

### Next.js 16

This project uses Next.js 16, which has breaking changes from earlier versions. Before writing code, read the relevant guide in `node_modules/next/dist/docs/`.

### SharedArrayBuffer Requirement

FFmpeg WASM requires `SharedArrayBuffer`, which necessitates specific CORS headers. The app configures these in `next.config.ts`:

- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

These headers are required for the FFmpeg WASM to load.

### Demo Mode

Set `NEXT_PUBLIC_DEMO_MODE=true` in environment variables to enable demo mode (simulates pro features without authentication).

### Environment Variables

Required for production:
- `MONGODB_URI`: MongoDB connection string
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `NEXTAUTH_SECRET`: NextAuth secret for JWT encryption
- `NEXT_PUBLIC_DEMO_MODE`: Set to "true" for demo mode