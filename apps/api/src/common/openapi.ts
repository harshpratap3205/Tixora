export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Tixora V1 — Modular Monolith API',
    version: '1.0.0',
    description:
      'Production-minded Movie Ticket Booking, Concurrency-Safe Seat Reservation, Payment Reconciliation, and Digital QR Ticketing API.',
  },
  servers: [
    {
      url: 'http://localhost:8080/api/v1',
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Operations'],
        summary: 'Health and database readiness probe',
        responses: { '200': { description: 'Healthy' } },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new customer account',
        responses: { '201': { description: 'Account created and session issued' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate and receive JWT access + refresh tokens',
        responses: { '200': { description: 'Authenticated' } },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Rotate refresh session and obtain a new access token',
        responses: { '200': { description: 'Session rotated' } },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Revoke refresh session and clear cookies',
        responses: { '200': { description: 'Logged out' } },
      },
    },
    '/users/me': {
      get: {
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        summary: 'Get current user profile and roles',
        responses: { '200': { description: 'Profile returned' } },
      },
      patch: {
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        summary: 'Update current user profile',
        responses: { '200': { description: 'Profile updated' } },
      },
    },
    '/users/me/bookings': {
      get: {
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        summary: 'Get customer booking history with QR tickets',
        responses: { '200': { description: 'Bookings returned' } },
      },
    },
    '/movies': {
      get: {
        tags: ['Movies'],
        summary: 'Search, filter, sort, and paginate movies',
        responses: { '200': { description: 'Paginated movies list' } },
      },
    },
    '/movies/{id}': {
      get: {
        tags: ['Movies'],
        summary: 'Get movie details by ID or slug',
        responses: { '200': { description: 'Movie details' } },
      },
    },
    '/movies/{id}/shows': {
      get: {
        tags: ['Movies'],
        summary: 'Get available showtimes for a movie filtered by city and date',
        responses: { '200': { description: 'Movie showtimes' } },
      },
    },
    '/cities': {
      get: {
        tags: ['Cinemas'],
        summary: 'List active cities with cinema counts',
        responses: { '200': { description: 'Cities list' } },
      },
    },
    '/cinemas': {
      get: {
        tags: ['Cinemas'],
        summary: 'List cinemas filtered by city or search query',
        responses: { '200': { description: 'Cinemas list' } },
      },
    },
    '/cinemas/{id}': {
      get: {
        tags: ['Cinemas'],
        summary: 'Get cinema details, screens, and published showtimes',
        responses: { '200': { description: 'Cinema details' } },
      },
    },
    '/shows/{id}': {
      get: {
        tags: ['Shows'],
        summary: 'Get showtime details',
        responses: { '200': { description: 'Showtime details' } },
      },
    },
    '/shows/{id}/seats': {
      get: {
        tags: ['Shows'],
        summary: 'Get real-time seat layout and availability for a showtime',
        responses: { '200': { description: 'Show seat map' } },
      },
    },
    '/seat-holds': {
      post: {
        tags: ['Reservations'],
        security: [{ bearerAuth: [] }],
        summary: 'Atomically claim one or more seats with PostgreSQL row locking',
        responses: {
          '201': { description: 'Hold created' },
          '409': { description: 'Seat conflict (already HELD or BOOKED)' },
        },
      },
    },
    '/seat-holds/{id}': {
      get: {
        tags: ['Reservations'],
        security: [{ bearerAuth: [] }],
        summary: 'Inspect active seat hold and countdown expiry',
        responses: { '200': { description: 'Hold details' } },
      },
      delete: {
        tags: ['Reservations'],
        security: [{ bearerAuth: [] }],
        summary: 'Release an active seat hold immediately',
        responses: { '200': { description: 'Hold released' } },
      },
    },
    '/bookings': {
      post: {
        tags: ['Bookings'],
        security: [{ bearerAuth: [] }],
        summary: 'Create an idempotent pending-payment booking from a valid seat hold',
        responses: { '201': { description: 'Booking created' } },
      },
    },
    '/bookings/{id}': {
      get: {
        tags: ['Bookings'],
        security: [{ bearerAuth: [] }],
        summary: 'Get booking details, seats, and payment attempts',
        responses: { '200': { description: 'Booking details' } },
      },
    },
    '/bookings/{id}/ticket': {
      get: {
        tags: ['Bookings'],
        security: [{ bearerAuth: [] }],
        summary: 'Retrieve signed QR ticket for a confirmed booking',
        responses: { '200': { description: 'QR Ticket' } },
      },
    },
    '/bookings/{id}/cancel': {
      post: {
        tags: ['Bookings'],
        security: [{ bearerAuth: [] }],
        summary: 'Cancel booking, release seats, void ticket, and trigger refund',
        responses: { '200': { description: 'Booking cancelled' } },
      },
    },
    '/payments/intents': {
      post: {
        tags: ['Payments'],
        security: [{ bearerAuth: [] }],
        summary: 'Initiate sandbox payment intent for a booking',
        responses: { '201': { description: 'Payment intent created' } },
      },
    },
    '/payments/webhooks/{provider}': {
      post: {
        tags: ['Payments'],
        summary: 'Process HMAC-signed payment webhook idempotently and reconcile seat ownership',
        responses: { '200': { description: 'Webhook processed' } },
      },
    },
    '/manager/tickets/validate': {
      post: {
        tags: ['Cinema Management'],
        security: [{ bearerAuth: [] }],
        summary: 'Verify cryptographic QR ticket and record check-in (rejects duplicates)',
        responses: {
          '200': { description: 'Ticket checked in' },
          '409': { description: 'Duplicate check-in or voided ticket' },
        },
      },
    },
  },
};

