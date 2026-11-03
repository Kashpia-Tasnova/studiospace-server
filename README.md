# StudioSpace — Server

StudioSpace Server is the backend API for the StudioSpace creative workspace rental marketplace. It is built with Express.js, TypeScript, and MongoDB.

The server manages studio listings, user authentication, image uploads, and workspace bookings.

## Technologies Used

- Node.js
- Express.js
- TypeScript
- MongoDB
- MongoDB Node.js Driver
- Better Auth
- JWT authentication plugin
- Multer
- ImgBB API

## Features

- **Authentication:** Secure user registration and login using Better Auth.
- **Google Login:** Support for Google OAuth authentication.
- **Studio Management:** Create, retrieve, update, and delete studio listings.
- **Featured Studios:** Retrieve the latest featured studio listings.
- **My Listings:** Retrieve studio listings belonging to the authenticated host.
- **Image Upload:** Upload multiple images to ImgBB with authentication and file validation.
- **Booking Management:** Create and retrieve customer bookings.
- **Host Booking Management:** Retrieve bookings for studios owned by the authenticated host.
- **Booking Confirmation:** Allow hosts to confirm pending reservations.
- **Booking Cancellation:** Allow customers and hosts to cancel eligible bookings.
- **Booking Completion:** Allow hosts to mark confirmed bookings as completed.
- **Overlap Prevention:** Prevent conflicting bookings for the same studio and date.
- **Input Validation:** Validate booking dates, times, guest capacity, and other required information.
- **Protected Routes:** Restrict private API operations to authenticated users.

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/Kashpia-Tasnova/studiospace-server.git
```

### 2. Navigate to the server folder

```bash
cd studiospace-server
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root directory.

```env
PORT=5000

MONGODB_URI=your_mongodb_connection_string

BETTER_AUTH_URL=http://localhost:5000
BETTER_AUTH_SECRET=your_better_auth_secret

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

IMGBB_API_KEY=your_imgbb_api_key
```

**Important:** Never commit your `.env` file or expose your API keys, database credentials, or authentication secrets.

### 5. Start the development server

```bash
npm run dev
```

The API server should run at:

```text
http://localhost:5000
```

### 6. Build the server

```bash
npm run build
```

## API Endpoints

The backend provides the following API routes.

### Studio APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/studios` | Retrieve all studios |
| GET | `/api/studios/featured` | Retrieve featured studios |
| GET | `/api/studios/my-listings` | Retrieve the authenticated host's studios |
| GET | `/api/studios/:id` | Retrieve a studio by ID |
| POST | `/api/studios` | Create a new studio |
| PUT | `/api/studios/:id` | Update a studio |
| DELETE | `/api/studios/:id` | Delete a studio |

### Booking APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/bookings` | Create a booking |
| GET | `/api/bookings/my-bookings` | Retrieve the customer's bookings |
| GET | `/api/bookings/host-bookings` | Retrieve bookings for the authenticated host |
| PATCH | `/api/bookings/:id/status` | Update a booking's status |
| PATCH | `/api/bookings/:id/cancel` | Cancel a customer's booking |

### Image Upload API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/upload/images` | Upload multiple images |

The image upload endpoint accepts multiple image files using the `images` form-data field.

### Authentication API

Better Auth handles authentication routes under:

```text
/api/auth/*
```

Supported authentication includes email/password and Google OAuth.

## Booking Status

Bookings can have the following statuses:

- **Pending:** Booking has been submitted and is awaiting host confirmation.
- **Confirmed:** Host has confirmed the booking.
- **Completed:** The booking has been completed.
- **Cancelled:** The booking has been cancelled by the customer or host.

The server prevents overlapping Pending or Confirmed reservations for the same studio and booking date.

## Database

StudioSpace uses MongoDB to store application data.

Database name:

```text
studiospace
```

Main collections include:

- `studios`
- `bookings`
- Better Auth authentication collections

## Image Storage

StudioSpace uses ImgBB for image hosting.

The server validates uploaded files and sends accepted images to ImgBB. The returned image URLs are stored with the relevant application data.

## Deployment

The backend is deployed using Render.

For production deployment:

1. Connect the server GitHub repository to Render.
2. Configure all required environment variables.
3. Set the build and start commands according to the project's `package.json`.
4. Configure CORS to allow the deployed frontend domain.
5. Ensure the MongoDB Atlas database is accessible from the deployed server.

## Repository

GitHub: [studiospace-server](https://github.com/Kashpia-Tasnova/studiospace-server)

**Project:** StudioSpace — Creative Workspace Rental Marketplace
