# Metchera Meet

A real-time video conferencing application built with Next.js, WebRTC, and Socket.IO.

## Features

- Real-time video and audio conferencing
- Multiple participants support
- Chat functionality
- Screen sharing
- Meeting recording
- Responsive UI

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd metchera-meet
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```

3. Create a `.env.local` file in the root directory with the following variables:
   ```
   NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
   SOCKET_PORT=4000
   ```

### Running the Application

To run both the Next.js application and the Socket.IO server concurrently:

```bash
npm run dev:all
# or
yarn dev:all
```

This will start:
- Next.js development server at http://localhost:3000
- Socket.IO server at http://localhost:4000

## Using the Application

1. Open http://localhost:3000 in your browser
2. Go to the dashboard and click "New Meeting" to create a meeting
3. Share the meeting URL with others to invite them to your meeting
4. Participants can join by visiting the shared URL in their browser

## Multiple User Testing

To test with multiple users on the same machine:

1. Start the application using `npm run dev:all`
2. Open http://localhost:3000 in one browser (e.g., Chrome)
3. Create a new meeting
4. Copy the meeting URL
5. Open the same URL in a different browser (e.g., Firefox) or in a private/incognito window
6. Now you can test the multi-user functionality

To test with users on different devices:

1. Make sure your computer is accessible on your local network
2. Find your computer's local IP address (e.g., 192.168.1.X)
3. Update your `.env.local` file:
   ```
   NEXT_PUBLIC_SOCKET_URL=http://192.168.1.X:4000
   SOCKET_PORT=4000
   ```
4. Start the application using `npm run dev:all`
5. Share the URL http://192.168.1.X:3000 with others on your network
6. Create a meeting and share the meeting URL

## Troubleshooting

If you encounter issues with connections between participants:

1. Make sure both the Next.js app and Socket.IO server are running
2. Check that your firewall isn't blocking WebRTC connections
3. Ensure that camera and microphone permissions are granted in the browser
4. Check the browser console for any errors

## Technologies Used

- Next.js
- React
- WebRTC (simple-peer)
- Socket.IO
- Tailwind CSS
- TypeScript
