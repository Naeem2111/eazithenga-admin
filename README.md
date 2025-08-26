# Eazithenga Admin Panel

A React-based admin panel for managing Eazithenga stores with image upload capabilities.

## Features

- Create stores with multiple products
- Image upload for products
- Temporary file storage on server
- Automatic cleanup of temporary files

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Backend Server

```bash
npm run server
```

This will start the Express backend server on port 3001.

### 3. Start the React Frontend

In a new terminal:

```bash
npm start
```

This will start the React app on port 3000.

### 4. Or Run Both Simultaneously

```bash
npm run dev
```

This runs both frontend and backend concurrently.

## How It Works

1. **Image Upload**: Images are uploaded to `/public/temp-uploads/` on the backend
2. **Store Creation**: The frontend uses temporary image URLs to create stores
3. **Cleanup**: Temporary files are automatically deleted after store creation

## Backend Endpoints

- `POST /api/temp-upload` - Upload image files
- `POST /api/temp-cleanup` - Clean up temporary files
- `GET /api/temp-files` - List temporary files (debugging)

## File Structure

```
├── src/                 # React frontend
├── server.js           # Express backend
├── public/             # Static files
│   └── temp-uploads/   # Temporary image storage
└── package.json        # Dependencies
```

## Troubleshooting

- **Port conflicts**: Make sure ports 3000 and 3001 are available
- **CORS issues**: Backend has CORS enabled for localhost:3000
- **File uploads**: Check `/public/temp-uploads/` directory exists
- **Image cleanup**: Verify cleanup endpoint is working

## Development

- Backend runs on: http://localhost:3001
- Frontend runs on: http://localhost:3000
- Temporary files accessible at: http://localhost:3001/temp-uploads/
