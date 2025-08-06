# Eazithenga Store Generator

A simple React application for generating stores with products using the Eazithenga API.

## Features

- Upload product images using the file upload API
- Create stores with multiple products
- Modern, responsive UI
- Real-time error handling and success feedback

## API Endpoints Used

1. **Get Upload URLs**: `POST /api/file/get-urls`
2. **Upload Files**: `PUT <uploadUrl>`
3. **Create Store**: `POST /api/store/create`

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm start
```

3. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Usage

1. **Configure API**: Enter the base URL for your API (defaults to `https://dev.eazithenga.com`)

2. **Store Details**: Fill in the store information:

   - Owner Number
   - Store Name
   - Store Slug

3. **Add Products**: For each product, provide:

   - Product Name
   - Price
   - Image File (optional - will upload to S3)

4. **Generate Store**: Click the "Generate Store" button to create the store with all products.

## Project Structure

```
src/
├── App.js          # Main application component
├── App.css         # Application styles
├── index.js        # Application entry point
└── index.css       # Global styles

public/
└── index.html      # HTML template
```

## Build for Production

```bash
npm run build
```

This creates a `build` folder with the production-ready files.

## Technologies Used

- React 18
- CSS3 with modern styling
- Fetch API for HTTP requests
