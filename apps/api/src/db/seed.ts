import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from './index';
import { logger } from '../common/logger';

export const DEMO_IDS = {
  users: {
    admin: '11111111-1111-4111-8111-111111111101',
    managerMumbai: '11111111-1111-4111-8111-111111111102',
    managerDelhi: '11111111-1111-4111-8111-111111111103',
    staffMumbai: '11111111-1111-4111-8111-111111111104',
    customer: '11111111-1111-4111-8111-111111111105',
  },
  movies: {
    solarisProtocol: '22222222-2222-4222-8222-222222222201',
    velvetNoir: '22222222-2222-4222-8222-222222222202',
    monsoonSymphony: '22222222-2222-4222-8222-222222222203',
    chronosHorizon: '22222222-2222-4222-8222-222222222204',
    kashmirEchoes: '22222222-2222-4222-8222-222222222205',
    cyberApex: '22222222-2222-4222-8222-222222222206',
  },
  cinemas: {
    lumiereMumbai: '33333333-3333-4333-8333-333333333301',
    grandAtriumMumbai: '33333333-3333-4333-8333-333333333302',
    palaisRoyaleDelhi: '33333333-3333-4333-8333-333333333303',
    cosmosBengaluru: '33333333-3333-4333-8333-333333333304',
  },
  screens: {
    lumiereImax: '44444444-4444-4444-8444-444444444401',
    lumiereNoirClub: '44444444-4444-4444-8444-444444444402',
    grandAtriumScreen1: '44444444-4444-4444-8444-444444444403',
    palaisDelhiImax: '44444444-4444-4444-8444-444444444404',
    cosmosBengaluruDolby: '44444444-4444-4444-8444-444444444405',
  },
  shows: {
    show1: '55555555-5555-4555-8555-555555555501',
    show2: '55555555-5555-4555-8555-555555555502',
    show3: '55555555-5555-4555-8555-555555555503',
    show4: '55555555-5555-4555-8555-555555555504',
    show5: '55555555-5555-4555-8555-555555555505',
    show6: '55555555-5555-4555-8555-555555555506',
  },
};

export async function seedDatabase(): Promise<void> {
  const existing = await db.query<{ count: string }>('SELECT COUNT(*)::text as count FROM roles');
  if (parseInt(existing.rows[0]?.count || '0', 10) > 0) {
    logger.info('Database already seeded; skipping demo seed');
    return;
  }

  logger.info('Seeding Tixora demo roles, users, movies, cinemas, screens, seats, and showtimes...');

  // 1. Roles
  const roles = [
    { name: 'CUSTOMER', desc: 'Standard moviegoer and ticket purchaser' },
    { name: 'CINEMA_STAFF', desc: 'Authorized cinema floor staff for QR ticket validation' },
    { name: 'CINEMA_MANAGER', desc: 'Cinema manager with scoped screen, showtime, and pricing control' },
    { name: 'PLATFORM_ADMIN', desc: 'Platform super-administrator with global control' },
  ];

  for (const r of roles) {
    await db.query(
      'INSERT INTO roles (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
      [r.name, r.desc]
    );
  }

  const roleRows = await db.query<{ id: number; name: string }>('SELECT id, name FROM roles');
  const roleMap = new Map(roleRows.rows.map((r) => [r.name, r.id]));

  // 2. Users (Password for all demo users: Tixora@2026)
  const passwordHash = await bcrypt.hash('Tixora@2026', 10);

  const users = [
    {
      id: DEMO_IDS.users.admin,
      email: 'admin@tixora.cinema',
      fullName: 'Vikramaditya Sen (Platform Admin)',
      phone: '+91 98200 10001',
      city: 'Mumbai',
      roles: ['PLATFORM_ADMIN', 'CUSTOMER'],
    },
    {
      id: DEMO_IDS.users.managerMumbai,
      email: 'manager@tixora.cinema',
      fullName: 'Meera Kapoor (Mumbai Cinema Manager)',
      phone: '+91 98200 10002',
      city: 'Mumbai',
      roles: ['CINEMA_MANAGER', 'CINEMA_STAFF', 'CUSTOMER'],
    },
    {
      id: DEMO_IDS.users.managerDelhi,
      email: 'delhi.manager@tixora.cinema',
      fullName: 'Rohan Malhotra (Delhi Cinema Manager)',
      phone: '+91 98100 20003',
      city: 'New Delhi',
      roles: ['CINEMA_MANAGER', 'CINEMA_STAFF', 'CUSTOMER'],
    },
    {
      id: DEMO_IDS.users.staffMumbai,
      email: 'staff@tixora.cinema',
      fullName: 'Kabir Verma (Gate Check-in Staff)',
      phone: '+91 98200 10004',
      city: 'Mumbai',
      roles: ['CINEMA_STAFF', 'CUSTOMER'],
    },
    {
      id: DEMO_IDS.users.customer,
      email: 'aarav@tixora.cinema',
      fullName: 'Aarav Mehta',
      phone: '+91 98200 10005',
      city: 'Mumbai',
      roles: ['CUSTOMER'],
    },
  ];

  for (const u of users) {
    await db.query(
      `INSERT INTO users (id, email, password_hash, full_name, phone, preferred_city, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE') ON CONFLICT (email) DO NOTHING`,
      [u.id, u.email, passwordHash, u.fullName, u.phone, u.city]
    );
    for (const rName of u.roles) {
      const rId = roleMap.get(rName);
      if (rId) {
        await db.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [u.id, rId]
        );
      }
    }
  }

  // 3. Movies Catalog
  const movies = [
    {
      id: DEMO_IDS.movies.solarisProtocol,
      slug: 'the-solaris-protocol',
      title: 'The Solaris Protocol',
      tagline: 'Beyond the heliosphere, silence has a pulse.',
      synopsis:
        'When a deep-space telemetry array near Mercury begins transmitting encrypted coordinates from forty years in the future, Commander Elena Vance leads a seven-person crew aboard the vessel Helios-IX into the solar corona.',
      duration: 148,
      releaseDate: '2026-09-18',
      status: 'NOW_SHOWING',
      rating: 'UA 16+',
      languages: ['English', 'Hindi'],
      genres: ['Sci-Fi', 'Thriller', 'IMAX Exclusive'],
      director: 'Denis K. Valen',
      cast: [
        { name: 'Clara Vane', role: 'Cmdr. Elena Vance' },
        { name: 'Dev Patel', role: 'Dr. Aris Thorne' },
        { name: 'Stellan Lind', role: 'Director Markov' },
      ],
      poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=85',
      backdrop: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&q=85',
      trailer: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      imdb: 8.9,
      featured: true,
    },
    {
      id: DEMO_IDS.movies.velvetNoir,
      slug: 'midnight-at-le-velours',
      title: 'Midnight at Le Velours',
      tagline: 'Every alibi is composed in minor key.',
      synopsis:
        'Set inside a rain-soaked 1968 Paris jazz conservatory, a celebrated cellist becomes the sole witness to the disappearance of an international diplomat during a live broadcast.',
      duration: 132,
      releaseDate: '2026-09-25',
      status: 'NOW_SHOWING',
      rating: 'A',
      languages: ['French', 'English'],
      genres: ['Mystery', 'Noir', 'Drama'],
      director: 'Céline Moreau',
      cast: [
        { name: 'Léa Laurent', role: 'Margaux Delacroix' },
        { name: 'Idris Vance', role: 'Inspector Beaumont' },
        { name: 'Hiroshi Tanaka', role: 'Kenji Sato' },
      ],
      poster: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=85',
      backdrop: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1920&q=85',
      trailer: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      imdb: 8.6,
      featured: true,
    },
    {
      id: DEMO_IDS.movies.monsoonSymphony,
      slug: 'monsoon-over-marine-drive',
      title: 'Monsoon Over Marine Drive',
      tagline: 'Two strangers, seven torrential nights, one unfinished film.',
      synopsis:
        'An archival film restorer and an acoustic architect cross paths in South Mumbai while salvaging a lost 1970s celluloid masterpiece before the historic Regal vault closes forever.',
      duration: 140,
      releaseDate: '2026-10-02',
      status: 'NOW_SHOWING',
      rating: 'U',
      languages: ['Hindi', 'English', 'Marathi'],
      genres: ['Romance', 'Drama', 'Music'],
      director: 'Zoya Sen-Roy',
      cast: [
        { name: 'Ishaan Khatter', role: 'Kabir Sen' },
        { name: 'Tara Deshmukh', role: 'Nandini Rao' },
        { name: 'Naseeruddin Shah', role: 'Ustad Farooq' },
      ],
      poster: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=85',
      backdrop: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1920&q=85',
      trailer: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      imdb: 8.7,
      featured: true,
    },
    {
      id: DEMO_IDS.movies.chronosHorizon,
      slug: 'architects-of-babel',
      title: 'Architects of Babel',
      tagline: 'Memory is the only currency that cannot be forged.',
      synopsis:
        'In a vertical megacity where citizens trade decades of recollection for architectural elevation, a structural forensic auditor uncovers a hidden floor built from erased histories.',
      duration: 155,
      releaseDate: '2026-10-05',
      status: 'NOW_SHOWING',
      rating: 'UA 16+',
      languages: ['English', 'Tamil', 'Telugu'],
      genres: ['Action', 'Sci-Fi', 'Drama'],
      director: 'Raghavendra Menon',
      cast: [
        { name: 'Vikramjit Das', role: 'Kaelen Varma' },
        { name: 'Sobhita Nair', role: 'Sera Lin' },
      ],
      poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=900&q=85',
      backdrop: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=1920&q=85',
      trailer: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      imdb: 8.3,
      featured: false,
    },
    {
      id: DEMO_IDS.movies.kashmirEchoes,
      slug: 'chinar-in-winter',
      title: 'Chinar in Winter',
      tagline: 'Beneath the snow lies the oldest promise.',
      synopsis:
        'A sweeping Himalayan chamber drama following three generations of master walnut-wood artisans navigating a changing valley across forty winters.',
      duration: 126,
      releaseDate: '2026-11-14',
      status: 'UPCOMING',
      rating: 'U',
      languages: ['Hindi', 'Kashmiri', 'English'],
      genres: ['Drama', 'History'],
      director: 'Aamir Bashir',
      cast: [
        { name: 'Adil Hussain', role: 'Ghulam Nabi' },
        { name: 'Rasika Dugal', role: 'Zooni' },
      ],
      poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=900&q=85',
      backdrop: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=85',
      trailer: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      imdb: 8.5,
      featured: false,
    },
    {
      id: DEMO_IDS.movies.cyberApex,
      slug: 'apex-circuit-zero',
      title: 'Apex Circuit: Zero',
      tagline: '360 km/h. Zero telemetry assist.',
      synopsis:
        'An veteran endurance racing engineer teams up with a rookie driver to challenge factory conglomerates at the night-time Suzuka 12 Hours.',
      duration: 138,
      releaseDate: '2026-12-04',
      status: 'UPCOMING',
      rating: 'UA 13+',
      languages: ['English', 'Hindi'],
      genres: ['Action', 'Sport'],
      director: 'James Mangold-West',
      cast: [
        { name: 'Callum Turner', role: 'Leo Mercer' },
        { name: 'Ken Watanabe', role: 'Takumi Hoshino' },
      ],
      poster: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=900&q=85',
      backdrop: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1920&q=85',
      trailer: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      imdb: 8.2,
      featured: false,
    },
  ];

  for (const m of movies) {
    await db.query(
      `INSERT INTO movies (
        id, slug, title, tagline, synopsis, duration_minutes, release_date,
        release_status, age_rating, languages, genres, director, cast_members,
        poster_url, backdrop_url, trailer_url, imdb_rating, is_featured
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (slug) DO NOTHING`,
      [
        m.id,
        m.slug,
        m.title,
        m.tagline,
        m.synopsis,
        m.duration,
        m.releaseDate,
        m.status,
        m.rating,
        m.languages,
        m.genres,
        m.director,
        JSON.stringify(m.cast),
        m.poster,
        m.backdrop,
        m.trailer,
        m.imdb,
        m.featured,
      ]
    );
  }

  // 4. Cinemas
  const cinemas = [
    {
      id: DEMO_IDS.cinemas.lumiereMumbai,
      name: 'Tixora Lumière IMAX — Lower Parel',
      slug: 'tixora-lumiere-imax-lower-parel',
      city: 'Mumbai',
      neighborhood: 'Lower Parel',
      address: 'Palladium Luxury Wing, Level 4, Senapati Bapat Marg, Mumbai 400013',
      facilities: ['IMAX Dual Laser', 'Dolby Atmos 64ch', 'Artisanal Lounge', 'Valet Parking', 'Wheelchair Accessible'],
    },
    {
      id: DEMO_IDS.cinemas.grandAtriumMumbai,
      name: 'Tixora Maison Noir — Bandra Kurla',
      slug: 'tixora-maison-noir-bkc',
      city: 'Mumbai',
      neighborhood: 'Bandra Kurla Complex',
      address: 'Maker Maxity Cultural Plaza, BKC, Mumbai 400051',
      facilities: ['4K RGB Laser', 'Recliner Suites', 'Bespoke Dining', 'EV Charging'],
    },
    {
      id: DEMO_IDS.cinemas.palaisRoyaleDelhi,
      name: 'Tixora Palais Royale — Chanakyapuri',
      slug: 'tixora-palais-royale-chanakyapuri',
      city: 'New Delhi',
      neighborhood: 'Chanakyapuri',
      address: 'Diplomatic Enclave Esplanade, New Delhi 110021',
      facilities: ['IMAX Laser', 'Dolby Atmos', 'Private Box Suites', 'Valet Parking'],
    },
    {
      id: DEMO_IDS.cinemas.cosmosBengaluru,
      name: 'Tixora Aether — Indiranagar',
      slug: 'tixora-aether-indiranagar',
      city: 'Bengaluru',
      neighborhood: 'Indiranagar',
      address: '100 Feet Road, HAL 2nd Stage, Bengaluru 560038',
      facilities: ['Dolby Cinema', 'Acoustic Loungers', 'Craft Coffee Bar'],
    },
  ];

  for (const c of cinemas) {
    await db.query(
      `INSERT INTO cinemas (id, name, slug, city, neighborhood, address, facilities, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE') ON CONFLICT (slug) DO NOTHING`,
      [c.id, c.name, c.slug, c.city, c.neighborhood, c.address, c.facilities]
    );
  }

  // Assign Cinema Staff / Managers
  const staffAssignments = [
    {
      cinemaId: DEMO_IDS.cinemas.lumiereMumbai,
      userId: DEMO_IDS.users.managerMumbai,
      role: 'CINEMA_MANAGER',
    },
    {
      cinemaId: DEMO_IDS.cinemas.grandAtriumMumbai,
      userId: DEMO_IDS.users.managerMumbai,
      role: 'CINEMA_MANAGER',
    },
    {
      cinemaId: DEMO_IDS.cinemas.lumiereMumbai,
      userId: DEMO_IDS.users.staffMumbai,
      role: 'CINEMA_STAFF',
    },
    {
      cinemaId: DEMO_IDS.cinemas.palaisRoyaleDelhi,
      userId: DEMO_IDS.users.managerDelhi,
      role: 'CINEMA_MANAGER',
    },
  ];

  for (const sa of staffAssignments) {
    await db.query(
      `INSERT INTO cinema_staff (id, cinema_id, user_id, permission_role)
       VALUES ($1, $2, $3, $4) ON CONFLICT (cinema_id, user_id) DO NOTHING`,
      [crypto.randomUUID(), sa.cinemaId, sa.userId, sa.role]
    );
  }

  // 5. Screens & Physical Seats
  const screens = [
    {
      id: DEMO_IDS.screens.lumiereImax,
      cinemaId: DEMO_IDS.cinemas.lumiereMumbai,
      name: 'Auditorium 1 · Grand IMAX Laser',
      format: 'IMAX Dual Laser',
      sound: 'Dolby Atmos 64ch',
      rows: 7,
      cols: 12,
      turnaround: 25,
    },
    {
      id: DEMO_IDS.screens.lumiereNoirClub,
      cinemaId: DEMO_IDS.cinemas.lumiereMumbai,
      name: 'Auditorium 2 · Noir Velvet Suite',
      format: '4K Laser Projection',
      sound: 'Dolby Atmos',
      rows: 6,
      cols: 10,
      turnaround: 20,
    },
    {
      id: DEMO_IDS.screens.grandAtriumScreen1,
      cinemaId: DEMO_IDS.cinemas.grandAtriumMumbai,
      name: 'Screen 1 · Atelier',
      format: 'Dolby Vision 4K',
      sound: 'Dolby Atmos',
      rows: 6,
      cols: 10,
      turnaround: 20,
    },
    {
      id: DEMO_IDS.screens.palaisDelhiImax,
      cinemaId: DEMO_IDS.cinemas.palaisRoyaleDelhi,
      name: 'Royal IMAX Hall',
      format: 'IMAX Laser',
      sound: 'IMAX 12-Channel',
      rows: 7,
      cols: 12,
      turnaround: 25,
    },
    {
      id: DEMO_IDS.screens.cosmosBengaluruDolby,
      cinemaId: DEMO_IDS.cinemas.cosmosBengaluru,
      name: 'Aether One · Dolby Cinema',
      format: 'Dolby Vision',
      sound: 'Dolby Atmos',
      rows: 6,
      cols: 10,
      turnaround: 20,
    },
  ];

  for (const sc of screens) {
    await db.query(
      `INSERT INTO screens (id, cinema_id, name, format_type, sound_system, total_rows, total_cols, turnaround_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (cinema_id, name) DO NOTHING`,
      [sc.id, sc.cinemaId, sc.name, sc.format, sc.sound, sc.rows, sc.cols, sc.turnaround]
    );
    await generateSeatsForScreen(sc.id, sc.rows, sc.cols);
  }

  // 6. Showtimes (Scheduled relative to current date so shows are always live and bookable!)
  const now = new Date();
  const makeShowWindow = (hoursFromNow: number, durationMinutes: number, turnaroundMinutes = 25) => {
    const start = new Date(now.getTime() + hoursFromNow * 3600 * 1000);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const turnaroundEnd = new Date(end.getTime() + turnaroundMinutes * 60 * 1000);
    return { start, end, turnaroundEnd };
  };

  const showsData = [
    {
      id: DEMO_IDS.shows.show1,
      movieId: DEMO_IDS.movies.solarisProtocol,
      cinemaId: DEMO_IDS.cinemas.lumiereMumbai,
      screenId: DEMO_IDS.screens.lumiereImax,
      language: 'English',
      format: 'IMAX Laser 2D',
      ...makeShowWindow(3, 148, 25),
      prices: { STANDARD: 380, PRIME: 520, RECLINER: 890 },
    },
    {
      id: DEMO_IDS.shows.show2,
      movieId: DEMO_IDS.movies.solarisProtocol,
      cinemaId: DEMO_IDS.cinemas.lumiereMumbai,
      screenId: DEMO_IDS.screens.lumiereImax,
      language: 'English',
      format: 'IMAX Laser 2D',
      ...makeShowWindow(7, 148, 25),
      prices: { STANDARD: 420, PRIME: 580, RECLINER: 950 },
    },
    {
      id: DEMO_IDS.shows.show3,
      movieId: DEMO_IDS.movies.velvetNoir,
      cinemaId: DEMO_IDS.cinemas.lumiereMumbai,
      screenId: DEMO_IDS.screens.lumiereNoirClub,
      language: 'French',
      format: '4K Laser Subtitled',
      ...makeShowWindow(4, 132, 20),
      prices: { STANDARD: 350, PRIME: 480, RECLINER: 780 },
    },
    {
      id: DEMO_IDS.shows.show4,
      movieId: DEMO_IDS.movies.monsoonSymphony,
      cinemaId: DEMO_IDS.cinemas.grandAtriumMumbai,
      screenId: DEMO_IDS.screens.grandAtriumScreen1,
      language: 'Hindi',
      format: 'Dolby Vision',
      ...makeShowWindow(5, 140, 20),
      prices: { STANDARD: 320, PRIME: 460, RECLINER: 750 },
    },
    {
      id: DEMO_IDS.shows.show5,
      movieId: DEMO_IDS.movies.solarisProtocol,
      cinemaId: DEMO_IDS.cinemas.palaisRoyaleDelhi,
      screenId: DEMO_IDS.screens.palaisDelhiImax,
      language: 'English',
      format: 'IMAX Laser 2D',
      ...makeShowWindow(4, 148, 25),
      prices: { STANDARD: 400, PRIME: 550, RECLINER: 920 },
    },
    {
      id: DEMO_IDS.shows.show6,
      movieId: DEMO_IDS.movies.chronosHorizon,
      cinemaId: DEMO_IDS.cinemas.cosmosBengaluru,
      screenId: DEMO_IDS.screens.cosmosBengaluruDolby,
      language: 'English',
      format: 'Dolby Cinema',
      ...makeShowWindow(6, 155, 20),
      prices: { STANDARD: 340, PRIME: 490, RECLINER: 820 },
    },
  ];

  for (const sh of showsData) {
    await db.query(
      `INSERT INTO shows (
        id, movie_id, cinema_id, screen_id, language, format,
        start_time, end_time, turnaround_end_time, currency, category_prices, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'INR',$10,'PUBLISHED')
      ON CONFLICT (id) DO NOTHING`,
      [
        sh.id,
        sh.movieId,
        sh.cinemaId,
        sh.screenId,
        sh.language,
        sh.format,
        sh.start.toISOString(),
        sh.end.toISOString(),
        sh.turnaroundEnd.toISOString(),
        JSON.stringify(sh.prices),
      ]
    );
    await populateShowSeatsForShow(sh.id, sh.screenId, sh.prices);
  }

  logger.info('Tixora demo data seeded successfully.');
}

export async function generateSeatsForScreen(
  screenId: string,
  totalRows: number,
  totalCols: number
): Promise<void> {
  const rowLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < totalRows; r++) {
    const rowLabel = rowLetters[r];
    const category =
      r < 2 ? 'STANDARD' : r < totalRows - 1 ? 'PRIME' : 'RECLINER';

    for (let c = 1; c <= totalCols; c++) {
      const seatCode = `${rowLabel}${c}`;
      const seatType = r === 0 && (c === 1 || c === totalCols) ? 'ACCESSIBLE' : 'REGULAR';
      await db.query(
        `INSERT INTO seats (
          id, screen_id, row_label, seat_number, seat_code, category, seat_type, grid_row, grid_col, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
        ON CONFLICT (screen_id, seat_code) DO NOTHING`,
        [
          crypto.randomUUID(),
          screenId,
          rowLabel,
          c,
          seatCode,
          category,
          seatType,
          r + 1,
          c,
        ]
      );
    }
  }
}

export async function populateShowSeatsForShow(
  showId: string,
  screenId: string,
  categoryPrices: Record<string, number>
): Promise<void> {
  const seats = await db.query<{
    id: string;
    seat_code: string;
    row_label: string;
    seat_number: number;
    category: string;
    seat_type: string;
    grid_row: number;
    grid_col: number;
    is_active: boolean;
  }>(
    'SELECT id, seat_code, row_label, seat_number, category, seat_type, grid_row, grid_col, is_active FROM seats WHERE screen_id = $1 ORDER BY grid_row, grid_col',
    [screenId]
  );

  for (const s of seats.rows) {
    const price = categoryPrices[s.category] ?? categoryPrices.PRIME ?? 450;
    const initialStatus = !s.is_active || s.seat_type === 'DISABLED' ? 'BLOCKED' : 'AVAILABLE';
    await db.query(
      `INSERT INTO show_seats (
        id, show_id, seat_id, seat_code, row_label, seat_number, category, seat_type,
        grid_row, grid_col, price, currency, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'INR',$12)
      ON CONFLICT (show_id, seat_id) DO NOTHING`,
      [
        crypto.randomUUID(),
        showId,
        s.id,
        s.seat_code,
        s.row_label,
        s.seat_number,
        s.category,
        s.seat_type,
        s.grid_row,
        s.grid_col,
        price,
        initialStatus,
      ]
    );
  }
}

