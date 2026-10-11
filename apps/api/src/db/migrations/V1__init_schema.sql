-- ============================================================================
-- TIXORA V1 — COMPLETE POSTGRESQL SCHEMA MIGRATION (V1)
-- Authoritative relational schema for identity, catalog, cinemas, screens,
-- shows, concurrency-safe reservations, bookings, payments, QR tickets,
-- audit trails, and transactional outbox.
-- ============================================================================

-- 1. USERS & IDENTITY
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(40),
    preferred_city VARCHAR(100) DEFAULT 'Mumbai',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE CHECK (name IN ('CUSTOMER', 'CINEMA_STAFF', 'CINEMA_MANAGER', 'PLATFORM_ADMIN')),
    description VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS refresh_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    user_agent VARCHAR(500),
    ip_address VARCHAR(64),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by_session_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user ON refresh_sessions(user_id);

-- 2. MOVIES CATALOG
CREATE TABLE IF NOT EXISTS movies (
    id UUID PRIMARY KEY,
    slug VARCHAR(180) NOT NULL UNIQUE,
    title VARCHAR(220) NOT NULL,
    tagline VARCHAR(255),
    synopsis TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    release_date DATE NOT NULL,
    release_status VARCHAR(30) NOT NULL DEFAULT 'NOW_SHOWING' CHECK (release_status IN ('NOW_SHOWING', 'UPCOMING', 'ARCHIVED')),
    age_rating VARCHAR(20) NOT NULL DEFAULT 'UA 16+',
    languages TEXT[] NOT NULL DEFAULT ARRAY['English'],
    genres TEXT[] NOT NULL DEFAULT ARRAY['Drama'],
    director VARCHAR(150) NOT NULL,
    cast_members JSONB NOT NULL DEFAULT '[]'::jsonb,
    poster_url TEXT NOT NULL,
    backdrop_url TEXT NOT NULL,
    trailer_url TEXT,
    imdb_rating NUMERIC(3, 1) DEFAULT 8.4,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_movies_status ON movies(release_status);

-- 3. CINEMAS, STAFF SCOPING, SCREENS & PHYSICAL SEATS
CREATE TABLE IF NOT EXISTS cinemas (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL UNIQUE,
    city VARCHAR(100) NOT NULL,
    neighborhood VARCHAR(120) NOT NULL,
    address TEXT NOT NULL,
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    facilities TEXT[] NOT NULL DEFAULT ARRAY['Dolby Atmos', 'Laser Projection'],
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED')),
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cinemas_city ON cinemas(city);

CREATE TABLE IF NOT EXISTS cinema_staff (
    id UUID PRIMARY KEY,
    cinema_id UUID NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_role VARCHAR(40) NOT NULL CHECK (permission_role IN ('CINEMA_MANAGER', 'CINEMA_STAFF')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cinema_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_cinema_staff_user ON cinema_staff(user_id);

CREATE TABLE IF NOT EXISTS screens (
    id UUID PRIMARY KEY,
    cinema_id UUID NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    format_type VARCHAR(60) NOT NULL DEFAULT 'IMAX Laser',
    sound_system VARCHAR(60) NOT NULL DEFAULT 'Dolby Atmos',
    total_rows INTEGER NOT NULL CHECK (total_rows > 0 AND total_rows <= 26),
    total_cols INTEGER NOT NULL CHECK (total_cols > 0 AND total_cols <= 40),
    turnaround_minutes INTEGER NOT NULL DEFAULT 20 CHECK (turnaround_minutes >= 0),
    layout_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cinema_id, name)
);

CREATE TABLE IF NOT EXISTS seats (
    id UUID PRIMARY KEY,
    screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    row_label VARCHAR(5) NOT NULL,
    seat_number INTEGER NOT NULL CHECK (seat_number > 0),
    seat_code VARCHAR(12) NOT NULL,
    category VARCHAR(40) NOT NULL CHECK (category IN ('STANDARD', 'PRIME', 'RECLINER', 'IMAX_VIP')),
    seat_type VARCHAR(30) NOT NULL DEFAULT 'REGULAR' CHECK (seat_type IN ('REGULAR', 'ACCESSIBLE', 'COUPLE', 'AISLE_GAP', 'DISABLED')),
    grid_row INTEGER NOT NULL,
    grid_col INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (screen_id, seat_code),
    UNIQUE (screen_id, grid_row, grid_col)
);
CREATE INDEX IF NOT EXISTS idx_seats_screen ON seats(screen_id);

-- 4. SHOWS & PER-SHOW SEAT INVENTORY
CREATE TABLE IF NOT EXISTS shows (
    id UUID PRIMARY KEY,
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE RESTRICT,
    cinema_id UUID NOT NULL REFERENCES cinemas(id) ON DELETE RESTRICT,
    screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE RESTRICT,
    language VARCHAR(60) NOT NULL DEFAULT 'English',
    format VARCHAR(60) NOT NULL DEFAULT 'IMAX 2D',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    turnaround_end_time TIMESTAMPTZ NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    category_prices JSONB NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_time > start_time),
    CHECK (turnaround_end_time >= end_time)
);
CREATE INDEX IF NOT EXISTS idx_shows_movie_time ON shows(movie_id, start_time);
CREATE INDEX IF NOT EXISTS idx_shows_cinema_time ON shows(cinema_id, start_time);
CREATE INDEX IF NOT EXISTS idx_shows_screen_window ON shows(screen_id, start_time, turnaround_end_time);

-- 5. SEAT HOLDS, BOOKINGS & SHOW_SEATS (CONCURRENCY-SAFE STATE MACHINE)
CREATE TABLE IF NOT EXISTS seat_holds (
    id UUID PRIMARY KEY,
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CONVERTED', 'EXPIRED', 'RELEASED')),
    expires_at TIMESTAMPTZ NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seat_holds_expiry ON seat_holds(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_seat_holds_user ON seat_holds(user_id);

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY,
    booking_reference VARCHAR(32) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE RESTRICT,
    hold_id UUID NOT NULL UNIQUE REFERENCES seat_holds(id) ON DELETE RESTRICT,
    idempotency_key VARCHAR(120) NOT NULL UNIQUE,
    status VARCHAR(40) NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (
        status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'REFUND_REQUIRED', 'REFUNDED')
    ),
    subtotal_amount NUMERIC(10, 2) NOT NULL CHECK (subtotal_amount >= 0),
    convenience_fee NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (convenience_fee >= 0),
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    cancellation_reason TEXT,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_show ON bookings(show_id);

CREATE TABLE IF NOT EXISTS show_seats (
    id UUID PRIMARY KEY,
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE RESTRICT,
    seat_code VARCHAR(12) NOT NULL,
    row_label VARCHAR(5) NOT NULL,
    seat_number INTEGER NOT NULL,
    category VARCHAR(40) NOT NULL,
    seat_type VARCHAR(30) NOT NULL DEFAULT 'REGULAR',
    grid_row INTEGER NOT NULL,
    grid_col INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'HELD', 'BOOKED', 'BLOCKED')),
    active_hold_id UUID REFERENCES seat_holds(id) ON DELETE SET NULL,
    hold_expires_at TIMESTAMPTZ,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    version INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (show_id, seat_id),
    UNIQUE (show_id, seat_code)
);
CREATE INDEX IF NOT EXISTS idx_show_seats_show_status ON show_seats(show_id, status);
CREATE INDEX IF NOT EXISTS idx_show_seats_hold ON show_seats(active_hold_id);

CREATE TABLE IF NOT EXISTS seat_hold_items (
    id UUID PRIMARY KEY,
    hold_id UUID NOT NULL REFERENCES seat_holds(id) ON DELETE CASCADE,
    show_seat_id UUID NOT NULL REFERENCES show_seats(id) ON DELETE CASCADE,
    seat_code VARCHAR(12) NOT NULL,
    category VARCHAR(40) NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    UNIQUE (hold_id, show_seat_id)
);

CREATE TABLE IF NOT EXISTS booking_items (
    id UUID PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    show_seat_id UUID NOT NULL REFERENCES show_seats(id) ON DELETE RESTRICT,
    seat_code VARCHAR(12) NOT NULL,
    row_label VARCHAR(5) NOT NULL,
    seat_number INTEGER NOT NULL,
    category VARCHAR(40) NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    UNIQUE (booking_id, show_seat_id)
);

-- 6. PAYMENTS & WEBHOOK EVENTS
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    provider VARCHAR(40) NOT NULL DEFAULT 'TIXORA_SANDBOX',
    provider_intent_id VARCHAR(140) NOT NULL UNIQUE,
    idempotency_key VARCHAR(140) NOT NULL UNIQUE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(40) NOT NULL DEFAULT 'CREATED' CHECK (
        status IN ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUND_PENDING', 'REFUNDED')
    ),
    payment_method VARCHAR(50) DEFAULT 'CARD_SANDBOX',
    failure_reason TEXT,
    reconciliation_notes TEXT,
    client_secret VARCHAR(255),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);

CREATE TABLE IF NOT EXISTS payment_events (
    id UUID PRIMARY KEY,
    provider VARCHAR(40) NOT NULL,
    event_id VARCHAR(160) NOT NULL UNIQUE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    event_type VARCHAR(80) NOT NULL,
    payload JSONB NOT NULL,
    processed_status VARCHAR(40) NOT NULL DEFAULT 'PROCESSED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. QR TICKETS & CHECK-INS
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY,
    ticket_code VARCHAR(40) NOT NULL UNIQUE,
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    qr_token VARCHAR(255) NOT NULL UNIQUE,
    qr_payload TEXT NOT NULL,
    seat_codes TEXT[] NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'CHECKED_IN', 'VOIDED')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checked_in_at TIMESTAMPTZ,
    checked_in_by UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_show ON tickets(show_id);

CREATE TABLE IF NOT EXISTS ticket_checkins (
    id UUID PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    cinema_id UUID NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
    staff_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    verification_status VARCHAR(40) NOT NULL CHECK (verification_status IN ('VALID_CHECKIN', 'DUPLICATE_REJECTED', 'INVALID_REJECTED')),
    notes TEXT,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. AUDIT LOGS & TRANSACTIONAL OUTBOX
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(60),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    cinema_id UUID REFERENCES cinemas(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY,
    aggregate_type VARCHAR(60) NOT NULL,
    aggregate_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(status, created_at);
