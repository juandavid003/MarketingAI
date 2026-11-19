// Seasonal opportunities: commercial dates and local holidays per country,
// computed from fixed rules (no AI, no external calendar API). Each date has
// a lead time — how far ahead content should be ready — so the owner sees
// "prepara desde…" instead of discovering Mother's Day the day before.
//
// Only countries in lib/adLibrary.ts COUNTRY_CODE_BY_KEYWORD are covered;
// a few city festivities are added when the business location names the city.

export type SeasonalEvent = {
  key: string;
  name: string;
  date: Date; // local calendar day (UTC midnight)
  leadDays: number;
  angle: string; // short content angle, generic across industries
};

export type UpcomingSeasonal = SeasonalEvent & {
  daysUntil: number;
  prepareFrom: Date;
  status: "prepare_now" | "upcoming";
};

type Rule = {
  key: string;
  name: string;
  countries: string[] | "all";
  cityKeyword?: string;
  leadDays: number;
  angle: string;
  date: (year: number) => Date;
};

const DAY_MS = 86_400_000;

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

// nth weekday (0 = Sunday) of a month; n = -1 → last.
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  if (n > 0) {
    const first = utc(year, month, 1);
    const offset = (weekday - first.getUTCDay() + 7) % 7;
    return utc(year, month, 1 + offset + (n - 1) * 7);
  }
  const last = utc(year, month + 1, 0);
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return utc(year, month, last.getUTCDate() - offset);
}

// Gregorian Easter Sunday (anonymous / Meeus algorithm).
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

const LATAM = ["EC", "MX", "CO", "PE", "CL", "AR"];

const RULES: Rule[] = [
  {
    key: "valentin",
    name: "San Valentín / Día del Amor y la Amistad",
    countries: ["EC", "MX", "PE", "CL", "AR", "US", "ES"],
    leadDays: 21,
    angle: "Regalos, planes en pareja o entre amigos, promociones 2x1.",
    date: (y) => utc(y, 2, 14),
  },
  {
    key: "amor_amistad_co",
    name: "Día del Amor y la Amistad",
    countries: ["CO"],
    leadDays: 21,
    angle: "Regalos y planes para pareja y amigos; dinámicas de 'amigo secreto'.",
    date: (y) => nthWeekday(y, 9, 6, 3),
  },
  {
    key: "carnaval",
    name: "Carnaval",
    countries: ["EC", "CO", "PE", "AR", "MX", "ES"],
    leadDays: 14,
    angle: "Feriado largo: viajes, planes, horarios especiales y productos para la temporada.",
    date: (y) => addDays(easterSunday(y), -48), // Monday of Carnaval
  },
  {
    key: "mujer",
    name: "Día Internacional de la Mujer",
    countries: "all",
    leadDays: 14,
    angle: "Reconocimiento a clientas y al equipo; evita el tono de 'oferta rosa'.",
    date: (y) => utc(y, 3, 8),
  },
  {
    key: "semana_santa",
    name: "Semana Santa",
    countries: [...LATAM, "ES"],
    leadDays: 14,
    angle: "Feriado: horarios, viajes, gastronomía de temporada (fanesca, pescado).",
    date: (y) => addDays(easterSunday(y), -2), // Good Friday
  },
  {
    key: "padre_es",
    name: "Día del Padre",
    countries: ["ES"],
    leadDays: 21,
    angle: "Ideas de regalo, experiencias, testimonios de papás clientes.",
    date: (y) => utc(y, 3, 19),
  },
  {
    key: "nino_mx",
    name: "Día del Niño",
    countries: ["MX"],
    leadDays: 14,
    angle: "Actividades, regalos y promociones familiares.",
    date: (y) => utc(y, 4, 30),
  },
  {
    key: "nino_co",
    name: "Día del Niño",
    countries: ["CO"],
    leadDays: 14,
    angle: "Actividades, regalos y promociones familiares.",
    date: (y) => nthWeekday(y, 4, 6, -1),
  },
  {
    key: "nino_pe",
    name: "Día del Niño",
    countries: ["PE"],
    leadDays: 14,
    angle: "Actividades, regalos y promociones familiares.",
    date: (y) => nthWeekday(y, 4, 0, 2),
  },
  {
    key: "madre_es",
    name: "Día de la Madre",
    countries: ["ES"],
    leadDays: 21,
    angle: "Regalos, experiencias y testimonios; es de las fechas de mayor venta.",
    date: (y) => nthWeekday(y, 5, 0, 1),
  },
  {
    key: "madre_mx",
    name: "Día de las Madres",
    countries: ["MX"],
    leadDays: 21,
    angle: "Regalos, experiencias y testimonios; es de las fechas de mayor venta.",
    date: (y) => utc(y, 5, 10),
  },
  {
    key: "madre",
    name: "Día de la Madre",
    countries: ["EC", "CO", "PE", "CL", "US"],
    leadDays: 21,
    angle: "Regalos, experiencias y testimonios; es de las fechas de mayor venta.",
    date: (y) => nthWeekday(y, 5, 0, 2),
  },
  {
    key: "nino_ec",
    name: "Día del Niño",
    countries: ["EC"],
    leadDays: 14,
    angle: "Actividades, regalos y promociones familiares.",
    date: (y) => utc(y, 6, 1),
  },
  {
    key: "padre",
    name: "Día del Padre",
    countries: [...LATAM, "US"],
    leadDays: 21,
    angle: "Ideas de regalo, experiencias, testimonios de papás clientes.",
    date: (y) => nthWeekday(y, 6, 0, 3),
  },
  {
    key: "independencia_us",
    name: "Independence Day",
    countries: ["US"],
    leadDays: 14,
    angle: "Feriado: planes, reuniones y promociones de temporada.",
    date: (y) => utc(y, 7, 4),
  },
  {
    key: "independencia_ar",
    name: "Día de la Independencia",
    countries: ["AR"],
    leadDays: 10,
    angle: "Feriado: orgullo local, horarios especiales.",
    date: (y) => utc(y, 7, 9),
  },
  {
    key: "independencia_co",
    name: "Día de la Independencia",
    countries: ["CO"],
    leadDays: 10,
    angle: "Feriado: orgullo local, horarios especiales.",
    date: (y) => utc(y, 7, 20),
  },
  {
    key: "fundacion_gye",
    name: "Fundación de Guayaquil",
    countries: ["EC"],
    cityKeyword: "guayaquil",
    leadDays: 14,
    angle: "Fiestas julianas: orgullo guayaquileño, feriado y eventos en la ciudad.",
    date: (y) => utc(y, 7, 25),
  },
  {
    key: "fiestas_patrias_pe",
    name: "Fiestas Patrias",
    countries: ["PE"],
    leadDays: 14,
    angle: "Feriado largo: orgullo peruano, gastronomía, viajes.",
    date: (y) => utc(y, 7, 28),
  },
  {
    key: "primer_grito_ec",
    name: "Primer Grito de Independencia",
    countries: ["EC"],
    leadDays: 10,
    angle: "Feriado: orgullo ecuatoriano, horarios especiales.",
    date: (y) => utc(y, 8, 10),
  },
  {
    key: "nino_cl",
    name: "Día del Niño",
    countries: ["CL"],
    leadDays: 14,
    angle: "Actividades, regalos y promociones familiares.",
    date: (y) => nthWeekday(y, 8, 0, 2),
  },
  {
    key: "infancias_ar",
    name: "Día de las Infancias",
    countries: ["AR"],
    leadDays: 14,
    angle: "Actividades, regalos y promociones familiares.",
    date: (y) => nthWeekday(y, 8, 0, 3),
  },
  {
    key: "independencia_mx",
    name: "Fiestas Patrias (Independencia)",
    countries: ["MX"],
    leadDays: 14,
    angle: "Noche mexicana, gastronomía, decoración y orgullo nacional.",
    date: (y) => utc(y, 9, 16),
  },
  {
    key: "fiestas_patrias_cl",
    name: "Fiestas Patrias",
    countries: ["CL"],
    leadDays: 21,
    angle: "Dieciocho: fondas, asados, feriado largo.",
    date: (y) => utc(y, 9, 18),
  },
  {
    key: "independencia_gye",
    name: "Independencia de Guayaquil",
    countries: ["EC"],
    cityKeyword: "guayaquil",
    leadDays: 10,
    angle: "Feriado local: orgullo guayaquileño.",
    date: (y) => utc(y, 10, 9),
  },
  {
    key: "madre_ar",
    name: "Día de la Madre",
    countries: ["AR"],
    leadDays: 21,
    angle: "Regalos, experiencias y testimonios; es de las fechas de mayor venta.",
    date: (y) => nthWeekday(y, 10, 0, 3),
  },
  {
    key: "halloween",
    name: "Halloween",
    countries: ["EC", "MX", "CO", "PE", "CL", "US", "ES"],
    leadDays: 14,
    angle: "Disfraces, decoración, contenido divertido y retos.",
    date: (y) => utc(y, 10, 31),
  },
  {
    key: "difuntos_ec",
    name: "Día de los Difuntos",
    countries: ["EC"],
    leadDays: 10,
    angle: "Feriado: colada morada y guaguas de pan, tradición familiar.",
    date: (y) => utc(y, 11, 2),
  },
  {
    key: "muertos_mx",
    name: "Día de Muertos",
    countries: ["MX"],
    leadDays: 14,
    angle: "Tradición, ofrendas, pan de muerto; contenido cultural.",
    date: (y) => utc(y, 11, 2),
  },
  {
    key: "independencia_cuenca",
    name: "Independencia de Cuenca",
    countries: ["EC"],
    cityKeyword: "cuenca",
    leadDays: 10,
    angle: "Feriado local: orgullo cuencano.",
    date: (y) => utc(y, 11, 3),
  },
  {
    key: "black_friday",
    name: "Black Friday",
    countries: "all",
    leadDays: 21,
    angle: "La oferta más clara del año: descuento concreto, fecha límite y urgencia real.",
    date: (y) => addDays(nthWeekday(y, 11, 4, 4), 1),
  },
  {
    key: "cyber_monday",
    name: "Cyber Monday",
    countries: "all",
    leadDays: 14,
    angle: "Ofertas para comprar en línea o por WhatsApp.",
    date: (y) => addDays(nthWeekday(y, 11, 4, 4), 4),
  },
  {
    key: "fiestas_quito",
    name: "Fiestas de Quito",
    countries: ["EC"],
    cityKeyword: "quito",
    leadDays: 14,
    angle: "Orgullo quiteño, eventos en la ciudad, ediciones especiales.",
    date: (y) => utc(y, 12, 6),
  },
  {
    key: "navidad",
    name: "Navidad",
    countries: "all",
    leadDays: 30,
    angle: "Regalos, combos, horarios extendidos, agradecimiento a clientes.",
    date: (y) => utc(y, 12, 25),
  },
  {
    key: "fin_de_ano",
    name: "Fin de año",
    countries: "all",
    leadDays: 14,
    angle: "Balance del año, agradecimiento, propósitos y reservas para enero.",
    date: (y) => utc(y, 12, 31),
  },
];

function todayUtc(now: Date): Date {
  return utc(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function seasonalEventsFor(countryCode: string, location: string, year: number): SeasonalEvent[] {
  const lower = location.toLowerCase();
  return RULES.filter(
    (r) =>
      (r.countries === "all" || r.countries.includes(countryCode)) &&
      (!r.cityKeyword || lower.includes(r.cityKeyword))
  ).map((r) => ({ key: r.key, name: r.name, date: r.date(year), leadDays: r.leadDays, angle: r.angle }));
}

// Dates from today up to `horizonDays` ahead (spanning the year boundary),
// soonest first. "prepare_now" = already inside its lead window.
export function upcomingSeasonal(
  countryCode: string,
  location: string,
  now: Date = new Date(),
  horizonDays = 75
): UpcomingSeasonal[] {
  const today = todayUtc(now);
  const year = today.getUTCFullYear();
  const events = [
    ...seasonalEventsFor(countryCode, location, year),
    ...seasonalEventsFor(countryCode, location, year + 1),
  ];
  return events
    .map((e) => {
      const daysUntil = Math.round((e.date.getTime() - today.getTime()) / DAY_MS);
      return {
        ...e,
        daysUntil,
        prepareFrom: addDays(e.date, -e.leadDays),
        status: (daysUntil <= e.leadDays ? "prepare_now" : "upcoming") as UpcomingSeasonal["status"],
      };
    })
    .filter((e) => e.daysUntil >= 0 && e.daysUntil <= horizonDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

// Goal text handed to the campaign generator for a date.
export function seasonalCampaignGoal(e: SeasonalEvent): string {
  const when = e.date.toLocaleDateString("es", { day: "numeric", month: "long", timeZone: "UTC" });
  return `Campaña para ${e.name} (${when}). Enfoque sugerido: ${e.angle}`;
}
