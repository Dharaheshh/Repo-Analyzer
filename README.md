# Repo Analyzer

A full-stack repository analysis tool that connects to GitHub repositories and processes repository information through a web application.

## Why it exists

The project explores practical GitHub API integration, backend service design, and frontend-to-backend workflows for developer tooling.

## Architecture

```text
React Client
     │
     ▼
Node.js / Express Server
     │
     ▼
GitHub API
     │
     ▼
Repository Data
```

## Tech Stack

**Frontend:** React / JavaScript  
**Backend:** Node.js, Express.js  
**Integration:** GitHub API  
**Configuration:** Environment variables

## Project Structure

```text
Repo-Analyzer/
├── client/       # Frontend
├── server/       # Backend and GitHub services
├── .env.example
├── package.json
└── test.js
```

## Getting Started

1. Clone the repository.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and configure the required values.
4. Start the application using the scripts defined in `package.json`.

> A developer-tooling project focused on API integration and full-stack application architecture.
