# YouTube Downloader API

## Overview

This is a YouTube video downloader service that provides both a web interface and REST API. The application allows users to fetch YouTube video information and download links in various quality formats. It uses yt-dlp (a YouTube download tool) under the hood to extract video metadata and generate download URLs. The service exposes an OpenAPI-documented REST API and serves a simple, modern web UI for end users.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture

**Framework**: Express.js (v5.2.1)
- **Decision**: Use Express as the web framework for its simplicity and wide ecosystem support
- **Rationale**: Express provides minimal overhead while offering robust routing, middleware support, and static file serving
- **Approach**: Single-file Node.js application (index.js) handling both API endpoints and static content serving

**API Design**: RESTful API with OpenAPI 3.0 specification
- **Decision**: Implement OpenAPI specification directly in code for API documentation
- **Rationale**: Provides self-documenting API that can be consumed by tools and developers
- **Key Endpoints**:
  - `/api/info` - GET endpoint for fetching video metadata and available formats
  - `/api/docs` - API documentation endpoint
- **Response Format**: JSON with video metadata including title, thumbnail, duration, channel, view count, and available download formats

**Video Processing**: Child process execution using Node.js `child_process` module
- **Decision**: Use `execSync` and `spawn` to interact with external yt-dlp command-line tool
- **Rationale**: Leverages battle-tested yt-dlp library without requiring native bindings
- **Trade-offs**: 
  - Pros: Isolated process, easy to update yt-dlp independently, robust error handling
  - Cons: Additional process overhead, requires yt-dlp to be installed on system

### Frontend Architecture

**Technology**: Vanilla HTML/CSS/JavaScript (no framework)
- **Decision**: Use plain JavaScript without frameworks
- **Rationale**: Simple use case doesn't warrant framework overhead; improves load times and reduces complexity
- **UI Features**:
  - Single-page application with dynamic content rendering
  - Real-time format fetching and display
  - Download button generation for each available format
  
**Styling Approach**: Custom CSS with modern design
- **Color Scheme**: Dark theme (#1a1a2e background, #e94560 accent)
- **Layout**: Responsive design with centered container (max-width: 800px)
- **Component Structure**: Modular CSS classes for reusability

**State Management**: DOM-based state handling
- **Approach**: Direct DOM manipulation using vanilla JavaScript
- **Loading States**: Toggle visibility of loading/error/result sections based on API response

### Static Asset Serving

**Decision**: Use Express static middleware for serving public directory
- **Rationale**: Built-in Express feature provides efficient static file serving
- **Structure**: All client-side assets (HTML, CSS, JS) served from `/public` directory

### Error Handling

**API Error Responses**: Structured error objects
- **Approach**: Catch exceptions during video processing and return appropriate HTTP status codes
- **Client-Side**: Display user-friendly error messages in dedicated error section

## External Dependencies

### Runtime Dependencies

**express** (v5.2.1)
- **Purpose**: Web framework for HTTP server and routing
- **Usage**: Core application framework, middleware support, static file serving

**@types/node** (v22.13.11)
- **Purpose**: TypeScript definitions for Node.js
- **Usage**: Development support for IDE autocomplete and type checking

### System Dependencies (External Binary)

**yt-dlp** (Not in package.json - system-level dependency)
- **Purpose**: YouTube video information extraction and download URL generation
- **Integration Method**: Executed via Node.js child processes
- **Critical Requirement**: Must be installed on the system PATH
- **Alternatives Considered**: 
  - youtube-dl: Less actively maintained
  - Native YouTube API: Doesn't provide direct download capabilities

### Third-Party Services

**YouTube**
- **Purpose**: Source platform for video content
- **Integration**: Indirect through yt-dlp tool
- **Data Retrieved**: Video metadata, thumbnail URLs, download streams

### Browser APIs (Client-Side)

**Fetch API**
- **Purpose**: HTTP requests from browser to backend API
- **Usage**: Asynchronous video information retrieval

**DOM API**
- **Purpose**: Dynamic UI updates and user interaction
- **Usage**: Rendering video information and format options