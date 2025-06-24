# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start development server with host binding for external access
- `npm run build` - Build for production (runs TypeScript check first with `tsc -b`)
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint on codebase

### Type Checking
- `tsc -b` - Run TypeScript compiler in build mode for type checking

## Architecture Overview

### Application Structure
This is a React 19 + TypeScript application built with Vite for decentralized media management using Nostr and Blossom protocols.

**Core Flow:**
1. **Authentication** - Users authenticate via Nostr browser extension (Alby, nos2x) or manual private key
2. **Server Management** - Users configure multiple Blossom servers for redundancy 
3. **Media Upload** - Files uploaded simultaneously to ALL configured servers (BUD-03 protocol)
4. **Privacy Processing** - Images automatically stripped of EXIF metadata before upload

### Key Components

**Authentication System** (`src/hooks/useAuth.tsx`)
- Manages Nostr authentication state
- Supports both browser extension and manual private key login
- Tracks signing method for API calls

**Blossom API Layer** (`src/services/blossom.ts`)
- `BlossomAPI` - Basic server operations (upload, list, delete, mirror)  
- `EnhancedBlossomAPI` - Multi-server operations with BUD-03 support
- Implements parallel uploads to all servers for maximum redundancy
- Handles fallback strategies for downloads and API calls

**Server Management** (`src/services/serverList.ts`)
- BUD-03 server list management via Nostr kind 10063 events
- Fetches user's preferred servers from Nostr relays
- Manages server configuration and availability

**Privacy Features**
- **Enhanced EXIF removal** with binary + canvas hybrid approach
- **Profile image security** - mandatory privacy warnings for metadata failures
- **Video/audio metadata warnings** - alerts users about non-removable metadata  
- **Memory protection** - 50MB size limit prevents browser crashes
- **Quality preservation** - binary removal for JPEG files, canvas fallback
- User can disable EXIF removal with informed consent warnings

### Protocol Implementation

**BUD-03 Multi-Server Strategy:**
- Uploads sent to ALL configured servers simultaneously (not fallback)
- Downloads use intelligent fallback through server list
- Server availability tracked and displayed to users

**Nostr Integration:**
- Authentication via NIP-07 browser extensions or manual keys
- Server lists stored as kind 10063 events (BUD-03)
- Auth events signed for Blossom API calls (kind 24242)

### File Processing Pipeline
1. File selected via drag-drop or file picker
2. Images processed through canvas to strip EXIF data
3. File hash calculated (SHA-256) for Blossom auth
4. Simultaneous upload to all configured servers
5. Results tracked with server-specific success/failure status

### State Management
- React Context for authentication (`AuthProvider`)
- Local state management in components
- Server lists cached and synced with Nostr relays

## Technology Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS 4
- **Build:** Vite with React plugin
- **Crypto:** nostr-tools, crypto-js
- **File Handling:** react-dropzone, exifr (EXIF removal)
- **UI:** Radix UI primitives, Lucide React icons
- **Protocols:** Nostr (auth), Blossom (storage), BUD-03 (server lists)

## Error Handling System

### Private Key Security
The application uses **user-controlled password-based AES-256-CBC encryption** for storing private keys (nsec):

**Encryption Details:**
- Algorithm: AES-256-CBC with PBKDF2 key derivation
- Key derivation: 10,000 iterations with random salt (128-bit)
- Initialization Vector: Random 16-byte IV for each encryption
- Password: User-chosen password (minimum 8 characters)
- Storage: LocalStorage with encrypted data + salt + IV
- Session: Decrypted key stored in memory during active session

**Security Features:**
- ✅ **User-controlled passwords** (not predictable public keys)
- ✅ Strong cryptographic encryption (AES-256-CBC)
- ✅ Salt prevents rainbow table attacks  
- ✅ Random IV prevents pattern analysis
- ✅ PBKDF2 slows down brute force attacks (10k iterations)
- ✅ Session-based decryption (password not stored)
- ✅ Memory-only session keys (cleared on logout)

### Enhanced Error Management
The application includes a comprehensive error handling system implemented in Phase 1.2:

**Core Components:**
- `src/utils/errorHandling.ts` - Error classification and user-friendly messaging
- `src/utils/retry.ts` - Retry logic with exponential backoff and jitter  
- `src/components/ErrorToast.tsx` - Global toast notification system
- `src/components/EnhancedErrorDisplay.tsx` - User-friendly error display
- `src/components/TroubleshootingGuide.tsx` - Interactive troubleshooting guides
- `src/hooks/useErrorRecovery.tsx` - Error recovery and graceful degradation

**Error Categories:**
- Network errors (connection issues, timeouts)
- Authentication errors (Nostr extension, signing failures)
- Server errors (Blossom server unavailable, 500/503 responses)
- Validation errors (invalid input, file format issues)
- Configuration errors (missing relays/servers)
- Permission errors (authorization failures)

**Recovery Strategies:**
- Automatic retry with exponential backoff for transient failures
- Graceful degradation when services are unavailable
- User-friendly error messages with actionable suggestions
- Troubleshooting guides for complex error scenarios

## Development Notes

- Uses ESModule configuration (`"type": "module"`)
- TypeScript with strict configuration across multiple tsconfig files
- ESLint with React hooks and refresh plugins
- Development server runs with `--host` flag for external access
- No test framework currently configured
- Comprehensive error handling with user-controlled infrastructure principles