# El Wendi Sport Tournament Management System

A full-featured web application for managing sports tournaments, dedicated to the memory of Bechachiya Ahsan, under the slogan "No to Drugs".

## Overview

El Wendi Sport is a comprehensive tournament management system built to handle all aspects of sporting events from team registration to match scheduling and results tracking. It provides both an admin dashboard for tournament organizers and a public interface for participants and spectators.

## Features

### Admin Dashboard
- **Team Management**: Register teams, add players, track registration fees
- **Match Scheduling**: Create and manage matches with full information
- **Tournament Structure**: Organize teams into groups, manage tournament progression
- **Staff Management**: Manage referees and other tournament staff
- **Statistics**: Comprehensive tournament statistics tracking
- **Admin Management**: Control access with different user roles

### Public Interface
- **Tournament Overview**: General information about the tournament
- **Match Schedule**: View upcoming matches with times and locations
- **Live Results**: Real-time match results and standings
- **Team Information**: View participating teams and their details
- **Tournament Statistics**: Access to various tournament statistics

## Project Structure

- **Frontend code**: Located in the `src` directory
  - React components for both admin and public interfaces
  - Styling with Tailwind CSS

- **Backend code**: Located in the `convex` directory
  - Data models and schemas
  - API endpoints for CRUD operations
  - Authentication logic

## Getting Started

### Prerequisites
- Node.js (latest LTS version recommended)
- npm or yarn

### Installation

1. Clone the repository
   ```
   git clone [repository-url]
   cd El_Wendi_Sport___Tournament
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Run the development server
   ```
   npm run dev
   ```
   This will start both the frontend and backend servers.

4. Access the application at `http://localhost:5173`

## App Authentication

The system uses a username/password authentication system with the Convex backend. 

Default admin credentials are:
- Username: `akram`
- Password: `25577726`

Different user roles are supported:
- **Admin**: Full access to all features
- **Editor**: Can modify data but with limited permissions
- **Viewer**: Read-only access to data

## Technical Stack

- **Frontend**:
  - React 19
  - TypeScript
  - Tailwind CSS
  - Vite as the build tool

- **Backend**:
  - Convex for backend services and real-time data
  - Convex Auth for authentication

## Deployment

The application is configured for deployment to Netlify. 
