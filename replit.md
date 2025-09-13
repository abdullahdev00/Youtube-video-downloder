# YouTube Video Downloader - YTDownloader Pro

## Overview

YTDownloader Pro is a modern, full-stack web application that enables users to download YouTube videos in various formats and qualities. The application features a sleek, YouTube-inspired design with a React frontend and Express.js backend, emphasizing user experience with fast downloads, multiple format support, and a premium aesthetic.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom color variables and YouTube-inspired theme
- **State Management**: TanStack React Query for server state and data fetching
- **Routing**: Wouter for lightweight client-side routing
- **Theme System**: Custom light/dark mode implementation with system preference detection

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript for type safety across the stack
- **Video Processing**: ytdl-core library for YouTube video information extraction and download handling
- **API Design**: RESTful endpoints for video info retrieval and download requests
- **Error Handling**: Centralized error middleware with structured error responses

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema versioning
- **Session Storage**: PostgreSQL-based session storage with connect-pg-simple
- **User Management**: Basic user authentication with username/password storage

### Authentication and Authorization
- **Session-based Authentication**: Server-side session management
- **User Schema**: Simple user model with username and password fields
- **Storage Interface**: Abstracted storage layer with memory and database implementations
- **Security**: Password hashing and session-based user identification

### Component Architecture
- **Design System**: Comprehensive UI component library with consistent styling
- **Component Organization**: Modular components with example implementations
- **Form Handling**: React Hook Form with Zod validation for type-safe form processing
- **Toast Notifications**: Radix UI toast system for user feedback
- **Responsive Design**: Mobile-first approach with Tailwind responsive utilities

### Development and Build System
- **Module System**: ESM modules throughout the application
- **Development Server**: Vite dev server with HMR for frontend development
- **Production Build**: Optimized builds with code splitting and asset optimization
- **Path Aliases**: Configured path aliases for clean imports (@/, @shared/, @assets/)
- **TypeScript Configuration**: Strict type checking with modern ES features

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React 18, React DOM, React Router (Wouter)
- **Build Tools**: Vite, TypeScript, PostCSS, Autoprefixer
- **UI Libraries**: Radix UI primitives, Shadcn/ui components, Lucide React icons

### Backend Dependencies
- **Server Framework**: Express.js with TypeScript support
- **Database**: PostgreSQL via @neondatabase/serverless, Drizzle ORM
- **Video Processing**: ytdl-core for YouTube video handling
- **Session Management**: express-session with connect-pg-simple

### Development and Utility Libraries
- **Styling**: Tailwind CSS, class-variance-authority for component variants
- **Form Handling**: React Hook Form, @hookform/resolvers, Zod validation
- **State Management**: TanStack React Query for server state
- **Date Handling**: date-fns for date manipulation
- **Utility Libraries**: clsx for conditional classes, nanoid for ID generation

### Optional Integrations
- **Payment Processing**: Stripe integration (@stripe/stripe-js, @stripe/react-stripe-js)
- **Development Tools**: Replit-specific development plugins and error handling
- **Code Quality**: ESBuild for production bundling, source map support

The application is designed for deployment on platforms like Replit with database provisioning through Neon PostgreSQL, though it can be adapted for other hosting environments.