/* Lead finder for admin.html. Admins and agents share this view.
   Countries: Australia, UAE, UK, USA, Sri Lanka.
   UK postcodes: https://api.postcodes.io (no key, CORS open).
   Other places: OpenStreetMap Nominatim. Businesses: Overpass, plus the Photon place index when that crawl is on.
   Nominatim is only asked after a place is chosen or a search starts, not on every keystroke.
   Phone, email, website, WhatsApp, social links and opening hours come from public OpenStreetMap tags.
   Website status uses Cloudflare DNS. No private keys. */
(function () {
  const root = document.getElementById("finderView");
  if (!root) return;

  const $ = (id) => document.getElementById(id);
  const input = $("lfQ");
  const list = $("lfList");
  const note = $("lfNote");
  const spin = $("lfSpin");
  const clearBtn = $("lfClear");
  const saveBtn = $("lfSave");
  const radiusEl = $("lfRadius");
  const sectorEl = $("lfSector");
  const maxEl = $("lfMax");
  const savedEl = $("lfSaved");
  const removeBtn = $("lfRemove");
  const goBtn = $("lfGo");
  const statusEl = $("lfStatus");
  const criteriaEl = $("lfCriteria");
  const tableWrap = $("lfTableWrap");
  const rowsEl = $("lfRows");
  const savedRowsEl = $("lfSavedRows");
  const savedWrap = $("lfSavedWrap");
  const leadCountEl = $("lfLeadCount");
  const sectorFilter = $("lfSectorFilter");
  const contactOnly = $("lfReachable");
  const historyEl = $("lfHistory");
  const dbNote = $("lfDbNote");
  const exportBtn = $("lfExport");
  const saveNote = $("lfSaveNote");
  const locRoot = $("lfLoc");

  const SAVED_KEY = "ts-lead-saved";
  const RECENT_KEY = "ts-lead-recent";
  const MILES = { "1": 1, "3": 3, "5": 5, "10": 10, "15": 15, "25": 25, "50": 50 };
  const OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter"
  ];
  const COUNTRIES = {
    au: { label: "Australia", code: "au", postcodes: false, example: "Sydney or Parramatta" },
    ae: { label: "UAE", code: "ae", postcodes: false, example: "Dubai or Abu Dhabi" },
    gb: { label: "UK", code: "gb", postcodes: true, example: "N15 4JA, or search London" },
    us: { label: "USA", code: "us", postcodes: false, example: "Miami or 10001" },
    lk: { label: "Sri Lanka", code: "lk", postcodes: false, example: "Colombo or Kandy" }
  };
  function country() {
    const el = document.getElementById("lfCountry");
    const pressed = el && el.querySelector('[aria-pressed="true"]');
    const code = (pressed && pressed.getAttribute("data-country")) || "gb";
    return COUNTRIES[code] || COUNTRIES.gb;
  }
  const SECTORS = {
    cafe: { label: "Cafés and restaurants", tags: [["amenity", "cafe"], ["amenity", "restaurant"], ["amenity", "fast_food"]] },
    pub: { label: "Pubs and bars", tags: [["amenity", "pub"], ["amenity", "bar"]] },
    bakery: { label: "Bakeries and sweets", tags: [["shop", "bakery"], ["shop", "pastry"], ["shop", "confectionery"]] },
    beauty: { label: "Hair and beauty", tags: [["shop", "hairdresser"], ["shop", "beauty"], ["shop", "cosmetics"]] },
    retail: { label: "Shops", tags: [["shop", "*"]] },
    hotel: { label: "Hotels and guest houses", tags: [["tourism", "hotel"], ["tourism", "guest_house"], ["tourism", "motel"]] },
    health: { label: "Dentists and clinics", tags: [["amenity", "dentist"], ["amenity", "clinic"], ["amenity", "doctors"], ["amenity", "hospital"]] },
    pharmacy: { label: "Pharmacies", tags: [["amenity", "pharmacy"]] },
    optician: { label: "Opticians", tags: [["shop", "optician"], ["healthcare", "optometrist"]] },
    vet: { label: "Vets", tags: [["amenity", "veterinary"]] },
    gym: { label: "Gyms and fitness", tags: [["leisure", "fitness_centre"], ["leisure", "sports_centre"]] },
    estate: { label: "Estate agents", tags: [["office", "estate_agent"]] },
    garage: { label: "Garages and car repair", tags: [["shop", "car_repair"], ["shop", "tyres"]] },
    cars: { label: "Car dealers", tags: [["shop", "car"], ["shop", "car_parts"], ["shop", "motorcycle"]] },
    accountant: { label: "Accountants", tags: [["office", "accountant"]] },
    legal: { label: "Solicitors", tags: [["office", "lawyer"]] },
    supermarket: { label: "Supermarkets and convenience", tags: [["shop", "supermarket"], ["shop", "convenience"]] },
    electronics: { label: "Electronics and phones", tags: [["shop", "electronics"], ["shop", "computer"], ["shop", "mobile_phone"]] },
    jewellery: { label: "Jewellery", tags: [["shop", "jewelry"], ["shop", "watches"]] },
    laundry: { label: "Laundry and dry cleaning", tags: [["shop", "laundry"], ["shop", "dry_cleaning"]] },
    travel: { label: "Travel agents", tags: [["shop", "travel_agency"], ["office", "travel_agent"]] },
    education: { label: "Schools and tuition", tags: [["amenity", "school"], ["amenity", "college"], ["amenity", "language_school"], ["amenity", "kindergarten"]] },
    trades: { label: "Builders and trades", tags: [["craft", "builder"], ["craft", "electrician"], ["craft", "plumber"], ["craft", "carpenter"], ["craft", "painter"], ["office", "construction_company"]] },
    photo: { label: "Photographers", tags: [["craft", "photographer"], ["shop", "photo"]] },
    all: {
      label: "All mapped businesses",
      wide: true,
      tags: [["amenity", "*"], ["shop", "*"], ["office", "*"], ["craft", "*"], ["healthcare", "*"], ["tourism", "hotel"], ["tourism", "guest_house"], ["tourism", "motel"], ["tourism", "hostel"], ["tourism", "apartment"]]
    }
  };
  const DEEP = {
    cafe: [["amenity", "ice_cream"], ["amenity", "food_court"], ["amenity", "biergarten"], ["shop", "bakery"], ["shop", "deli"], ["amenity", "restaurant"]],
    pub: [["amenity", "nightclub"], ["amenity", "biergarten"], ["amenity", "bar"]],
    bakery: [["shop", "chocolate"], ["shop", "ice_cream"], ["amenity", "cafe"]],
    beauty: [["shop", "massage"], ["leisure", "spa"], ["shop", "tattoo"], ["shop", "perfumery"], ["craft", "dressmaker"]],
    retail: [["shop", "clothes"], ["shop", "boutique"], ["shop", "gift"], ["shop", "florist"], ["shop", "furniture"], ["shop", "hardware"]],
    hotel: [["tourism", "hostel"], ["tourism", "apartment"], ["tourism", "chalet"], ["tourism", "camp_site"]],
    health: [["healthcare", "doctor"], ["healthcare", "clinic"], ["healthcare", "dentist"], ["healthcare", "physiotherapist"], ["healthcare", "alternative"], ["amenity", "pharmacy"]],
    pharmacy: [["shop", "chemist"], ["healthcare", "pharmacy"]],
    optician: [["shop", "optician"], ["healthcare", "optometrist"]],
    vet: [["amenity", "veterinary"], ["healthcare", "veterinary"]],
    gym: [["leisure", "fitness_centre"], ["sport", "fitness"], ["leisure", "dance"]],
    estate: [["office", "estate_agent"], ["office", "property_management"]],
    garage: [["craft", "car_repair"], ["shop", "car_repair"], ["amenity", "vehicle_inspection"]],
    cars: [["shop", "car"], ["shop", "motorcycle"], ["shop", "tyres"]],
    accountant: [["office", "tax_advisor"], ["office", "financial"], ["office", "insurance"]],
    legal: [["office", "notary"], ["office", "lawyer"]],
    supermarket: [["shop", "greengrocer"], ["shop", "butcher"], ["shop", "general"]],
    electronics: [["shop", "hifi"], ["shop", "camera"], ["craft", "electronics_repair"]],
    jewellery: [["shop", "jewelry"], ["craft", "jeweller"], ["shop", "gold"]],
    laundry: [["shop", "laundry"], ["shop", "dry_cleaning"]],
    travel: [["shop", "ticket"], ["office", "travel_agent"]],
    education: [["office", "educational_institution"], ["amenity", "training"], ["amenity", "driving_school"]],
    trades: [["craft", "hvac"], ["craft", "roofer"], ["craft", "gardener"], ["craft", "tiler"], ["shop", "trade"]],
    photo: [["shop", "camera"], ["office", "advertising_agency"]]
  };
  const POPULAR = {
    au: [
      { label: "Sydney", query: "Sydney" },
      { label: "Melbourne", query: "Melbourne" },
      { label: "Brisbane", query: "Brisbane" },
      { label: "Perth", query: "Perth" },
      { label: "Adelaide", query: "Adelaide" },
      { label: "Gold Coast", query: "Gold Coast" },
      { label: "Canberra", query: "Canberra" },
      { label: "Hobart", query: "Hobart" },
      { label: "Darwin", query: "Darwin" },
      { label: "Newcastle", query: "Newcastle" }
    ],
    ae: [
      { label: "Dubai", query: "Dubai" },
      { label: "Abu Dhabi", query: "Abu Dhabi" },
      { label: "Sharjah", query: "Sharjah" },
      { label: "Ajman", query: "Ajman" },
      { label: "Ras Al Khaimah", query: "Ras Al Khaimah" },
      { label: "Fujairah", query: "Fujairah" },
      { label: "Al Ain", query: "Al Ain" },
      { label: "Dubai Marina", query: "Dubai Marina" },
      { label: "Deira", query: "Deira" },
      { label: "Jumeirah", query: "Jumeirah" }
    ],
    gb: [
    { label: "London", query: "London", london: true },
    { label: "Tottenham", query: "Tottenham", london: true, preferOutcode: "N15" },
    { label: "Stratford", query: "Stratford", london: true, preferOutcode: "E15" },
    { label: "Ilford", query: "Ilford", london: true, preferOutcode: "IG1" },
    { label: "Croydon", query: "Croydon", london: true },
    { label: "Wembley", query: "Wembley", london: true, preferOutcode: "HA9" },
    { label: "Enfield", query: "Enfield", london: true },
    { label: "Hounslow", query: "Hounslow", london: true },
    { label: "Barking", query: "Barking", london: true },
    { label: "Romford", query: "Romford", london: true },
    { label: "Birmingham", query: "Birmingham" },
    { label: "Manchester", query: "Manchester" },
    { label: "Leeds", query: "Leeds" },
    { label: "Liverpool", query: "Liverpool" },
    { label: "Bristol", query: "Bristol" },
    { label: "Nottingham", query: "Nottingham" },
    { label: "Leicester", query: "Leicester" },
    { label: "Sheffield", query: "Sheffield" },
    { label: "Coventry", query: "Coventry" },
    { label: "Cardiff", query: "Cardiff" },
    { label: "Glasgow", query: "Glasgow" },
    { label: "Edinburgh", query: "Edinburgh" },
    { label: "N", query: "N", area: true },
    { label: "E", query: "E", area: true },
    { label: "SE", query: "SE", area: true },
    { label: "SW", query: "SW", area: true },
    { label: "W", query: "W", area: true },
    { label: "NW", query: "NW", area: true },
    { label: "EC", query: "EC", area: true },
    { label: "WC", query: "WC", area: true }
    ],
    us: [
      { label: "New York", query: "New York" },
      { label: "Los Angeles", query: "Los Angeles" },
      { label: "Chicago", query: "Chicago" },
      { label: "Houston", query: "Houston" },
      { label: "Phoenix", query: "Phoenix" },
      { label: "Philadelphia", query: "Philadelphia" },
      { label: "San Diego", query: "San Diego" },
      { label: "Dallas", query: "Dallas" },
      { label: "Miami", query: "Miami" },
      { label: "Atlanta", query: "Atlanta" },
      { label: "Seattle", query: "Seattle" },
      { label: "Boston", query: "Boston" },
      { label: "Denver", query: "Denver" },
      { label: "Washington", query: "Washington" }
    ],
    lk: [
      { label: "Colombo", query: "Colombo" },
      { label: "Kandy", query: "Kandy" },
      { label: "Galle", query: "Galle" },
      { label: "Jaffna", query: "Jaffna" },
      { label: "Negombo", query: "Negombo" },
      { label: "Matara", query: "Matara" },
      { label: "Kurunegala", query: "Kurunegala" },
      { label: "Batticaloa", query: "Batticaloa" },
      { label: "Anuradhapura", query: "Anuradhapura" },
      { label: "Nugegoda", query: "Nugegoda" },
      { label: "Dehiwala", query: "Dehiwala" },
      { label: "Mount Lavinia", query: "Mount Lavinia" },
      { label: "Moratuwa", query: "Moratuwa" },
      { label: "Gampaha", query: "Gampaha" }
    ]
  };
  const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.2"/></svg>';

  const cache = new Map();
  const webCache = new Map();
  const state = { location: null, saved: [], savesMode: "local", loaded: false, active: -1, options: [], suggestGen: 0, searchGen: 0, leads: [], history: [], dbOk: null, contactCols: null, role: "admin" };
  let lastSearch = null;
  let suggestTimer = null;
  let suggestAbort = null;
  let nomiAt = 0;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function compactOf(q) { return String(q || "").replace(/\s+/g, "").toUpperCase(); }
  function formatPc(compact) {
    const m = compactOf(compact).match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/);
    return m ? `${m[1]} ${m[2]}` : compactOf(compact);
  }
  const isFull = (c) => /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compactOf(c));
  const isOut = (c) => /^[A-Z]{1,2}\d[A-Z\d]?$/.test(compactOf(c));
  function postcodeish(q) {
    const c = compactOf(q);
    if (!/^[A-Z0-9]{1,7}$/.test(c)) return false;
    return /^[A-Z]{1,2}$/.test(c) || /^[A-Z]{1,2}\d/.test(c);
  }
  function metersFor(radius) {
    const miles = MILES[radius];
    return miles ? Math.round(miles * 1609.344) : null;
  }
  function radiusText(radius) {
    if (radius === "area") return "Entire area";
    const n = MILES[radius];
    return n ? `${n} mile${n === 1 ? "" : "s"}` : "5 miles";
  }
  function displayName(loc) {
    if (loc && loc.outcode && loc.type === "place" && loc.label && !loc.label.includes(loc.outcode)) return `${loc.label} — ${loc.outcode}`;
    return (loc && loc.label) || "";
  }
  function milesBetween(aLat, aLon, bLat, bLon) {
    const R = 3958.7613;
    const dLat = (bLat - aLat) * Math.PI / 180;
    const dLon = (bLon - aLon) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function formatMiles(m) {
    if (m == null || Number.isNaN(m)) return "—";
    if (m < 0.1) return "under 0.1 mi";
    if (m < 10) return `${m.toFixed(1)} mi`;
    return `${Math.round(m)} mi`;
  }
  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]") || []; } catch (e) { return []; }
  }
  function email() {
    const session = window.TSDB && TSDB.session && TSDB.session();
    return session && session.email ? String(session.email).toLowerCase() : "";
  }

  function fromPostcode(hit) {
    const district = typeof hit.admin_district === "string" ? hit.admin_district : "";
    return {
      label: hit.postcode, query: hit.postcode, type: "full", verified: true,
      latitude: hit.latitude, longitude: hit.longitude, outcode: hit.outcode || String(hit.postcode || "").split(" ")[0],
      detail: [district, hit.parish].filter(Boolean).join(" · "), adminName: district, warning: ""
    };
  }
  function fromOutcode(hit) {
    const names = Array.isArray(hit.admin_district) ? hit.admin_district : [hit.admin_district].filter(Boolean);
    return {
      label: hit.outcode, query: hit.outcode, type: "partial", verified: true,
      latitude: hit.latitude, longitude: hit.longitude, outcode: hit.outcode,
      detail: names.slice(0, 2).join(", "), adminName: names[0] || "", warning: ""
    };
  }
  function fromPlace(p) {
    const district = p.district_borough || p.county_unitary || "";
    return {
      label: p.name_1, query: p.name_1, type: "place", verified: true,
      latitude: p.latitude, longitude: p.longitude, outcode: p.outcode || "",
      detail: [p.local_type, p.outcode, district].filter(Boolean).join(" · "),
      adminName: district, warning: ""
    };
  }
  function fromNominatim(hit, q) {
    const short = String(hit.display_name || q).split(",").slice(0, 3).join(",");
    return {
      label: q, query: q, type: "place", verified: true,
      latitude: Number(hit.lat), longitude: Number(hit.lon), outcode: "",
      detail: short, adminName: "", warning: country().postcodes ? "This name isn't in the UK postcode directory. The pin is the OpenStreetMap place, not a postcode." : "Mapped centre in " + country().label + ".",
      osmType: hit.osm_type || "", osmId: hit.osm_id || ""
    };
  }
  function manual(q, warning) {
    return { label: q, query: q, type: "manual", verified: false, latitude: null, longitude: null, outcode: "", detail: "", adminName: "", warning };
  }
  function fromRow(row) {
    const verified = !!row.verified;
    return {
      id: row.id, label: row.label, query: row.query, type: row.location_type || row.type,
      outcode: row.outcode || "", verified, latitude: row.latitude, longitude: row.longitude,
      radius: row.radius || "5", detail: row.detail || "", adminName: "", country: row.country || "",
      warning: verified ? "" : (row.detail || "Saved as typed. This location was not verified.")
    };
  }

  function rankPlaces(list, query, opts) {
    const q = query.toLowerCase();
    const weight = { "Capital City": 42, City: 36, Town: 30, "Other Settlement": 20, "Suburban Area": 16, Village: 12, Hamlet: 4, Locality: 14 };
    return [...list].sort((a, b) => score(b) - score(a));
    function score(p) {
      const name = String(p.name_1 || "").toLowerCase();
      let s = weight[p.local_type] || 8;
      if (name === q) s += 80;
      else if (name.startsWith(q)) s += 25;
      else s -= 15;
      const where = `${p.county_unitary || ""} ${p.region || ""} ${p.district_borough || ""}`;
      if (opts && opts.london && /london/i.test(where)) s += 60;
      if (opts && opts.preferOutcode && String(p.outcode || "").toUpperCase() === String(opts.preferOutcode).toUpperCase()) s += 20;
      return s;
    }
  }

  async function pcGet(path, signal) {
    if (cache.has(path)) return cache.get(path);
    const res = await fetch("https://api.postcodes.io" + path, { signal, headers: { Accept: "application/json" } });
    if (res.status === 404) { cache.set(path, null); return null; }
    if (!res.ok) throw new Error("The postcode directory returned " + res.status + ".");
    const data = await res.json();
    const result = data && Object.prototype.hasOwnProperty.call(data, "result") ? data.result : null;
    cache.set(path, result);
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    return result;
  }

  async function nominatimSearch(q, signal) {
    const wait = 1100 - (Date.now() - nomiAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (signal && signal.aborted) throw new DOMException("Aborted", "AbortError");
    nomiAt = Date.now();
    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=" + country().code + "&limit=5&q=" + encodeURIComponent(q);
    const res = await fetch(url, { signal, headers: { Accept: "application/json", "Accept-Language": "en" } });
    if (!res.ok) throw new Error("OpenStreetMap place search returned " + res.status + ".");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async function resolveQuery(raw, opts, signal) {
    const q = String(raw || "").trim().replace(/\s+/g, " ");
    if (!q) return null;
    if (!country().postcodes) {
      const geo = await nominatimSearch(q, signal);
      if (geo.length && geo[0].lat) return fromNominatim(geo[0], q);
      return manual(q, `No place matched “${q}” in ${country().label}.`);
    }
    const compact = compactOf(q);
    const hints = opts || {};
    if (hints.area || /^[A-Z]{1,2}$/.test(compact)) {
      const hit = await pcGet("/outcodes/" + encodeURIComponent(compact), signal);
      if (hit) return fromOutcode(hit);
      return manual(q, `${compact} is a postcode area, not a district with a single centre. Search ${compact}1, or a neighbourhood inside it.`);
    }
    if (isFull(compact)) {
      const formatted = formatPc(compact);
      const hit = await pcGet("/postcodes/" + encodeURIComponent(formatted), signal);
      if (!hit) return manual(q, `${formatted} isn't a live UK postcode. You can keep it, but business search needs a location the directory can place on the map.`);
      return fromPostcode(hit);
    }
    if (isOut(compact)) {
      const hit = await pcGet("/outcodes/" + encodeURIComponent(compact), signal);
      if (hit) return fromOutcode(hit);
      return manual(q, `${compact} isn't an outward code the directory recognises. Try a full postcode or a town name.`);
    }
    const places = await pcGet("/places?q=" + encodeURIComponent(q) + "&limit=10", signal);
    const list = Array.isArray(places) ? places : [];
    if (list.length) return fromPlace(rankPlaces(list, q, hints)[0]);
    const geo = await nominatimSearch(q, signal);
    if (geo.length && geo[0].lat) return fromNominatim(geo[0], q);
    return manual(q, `No place matched “${q}”. You can keep this label, but business search needs a postcode or a place the directory can find.`);
  }

  function hintFor(loc) {
    if (loc.type === "full") return `Full postcode${loc.detail ? " · " + loc.detail : ""}`;
    if (loc.type === "partial") return `Postcode district, not a full postcode${loc.detail ? " · " + loc.detail : ""}`;
    return loc.detail || "Place";
  }
  function optionFromLocation(loc) {
    return { label: displayName(loc), hint: hintFor(loc), run: async () => loc };
  }

  async function fetchMatches(q, signal) {
    if (!country().postcodes) {
      const geo = await nominatimSearch(q, signal);
      return geo.slice(0, 6).map((hit) => optionFromLocation(fromNominatim(hit, hit.display_name || q)));
    }
    const compact = compactOf(q);
    if (postcodeish(q)) {
      const jobs = [pcGet("/postcodes/" + encodeURIComponent(compact) + "/autocomplete?limit=6", signal)];
      jobs.push(isFull(compact) ? pcGet("/postcodes/" + encodeURIComponent(formatPc(compact)), signal) : Promise.resolve(undefined));
      jobs.push(isOut(compact) ? pcGet("/outcodes/" + encodeURIComponent(compact), signal) : Promise.resolve(undefined));
      const [auto, full, out] = await Promise.all(jobs);
      const items = [];
      if (full) items.push(optionFromLocation(fromPostcode(full)));
      if (out) items.push(optionFromLocation(fromOutcode(out)));
      for (const pc of auto || []) {
        if (items.some((item) => item.label === pc)) continue;
        items.push({ label: pc, hint: "UK postcode", run: () => resolveQuery(pc) });
      }
      return items;
    }
    const places = await pcGet("/places?q=" + encodeURIComponent(q) + "&limit=8", signal);
    return rankPlaces(Array.isArray(places) ? places : [], q, {}).slice(0, 8).map((p) => optionFromLocation(fromPlace(p)));
  }

  function readRecent() {
    const code = country().code;
    return readJson(RECENT_KEY).map(fromRow).filter((r) => r.label && (r.country ? r.country === code : code === "gb"));
  }
  function remember(loc) {
    if (!loc || !loc.verified) return;
    const next = [{ ...loc, country: loc.country || country().code, radius: radiusEl.value }, ...readJson(RECENT_KEY).map(fromRow).filter((r) => r.label && !(r.query === loc.query && r.type === loc.type && (r.country || "gb") === (loc.country || country().code)))];
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, 8).map(toStore))); } catch (e) {}
  }
  function toStore(s) {
    return {
      id: s.id, label: s.label, query: s.query, location_type: s.type, outcode: s.outcode || "",
      latitude: s.latitude, longitude: s.longitude, radius: s.radius || radiusEl.value,
      verified: !!s.verified, detail: s.type === "manual" ? (s.warning || s.detail || "") : (s.detail || ""),
      country: s.country || ""
    };
  }

  function renderNote() {
    const loc = state.location;
    note.className = "lf-note";
    if (!loc) { note.textContent = ""; return; }
    if (!loc.verified) { note.textContent = loc.warning || "Kept as typed. This location isn't verified."; note.classList.add("warn"); return; }
    if (loc.type === "full") { note.textContent = `${loc.label} · full postcode${loc.detail ? " · " + loc.detail : ""}`; note.classList.add("ok"); return; }
    if (loc.type === "partial") { note.textContent = `${loc.label} · postcode district centre, not a full postcode${loc.detail ? " · " + loc.detail : ""}`; note.classList.add("warn"); return; }
    note.textContent = loc.warning || `${loc.label}${loc.detail ? " · " + loc.detail : ""} · mapped centre, not a full postcode`;
    note.classList.add(loc.warning ? "warn" : "ok");
  }
  function renderChrome() {
    clearBtn.hidden = !input.value;
    const loc = state.location;
    const on = !!(loc && state.saved.some((s) => s.query === loc.query && s.type === loc.type && s.radius === radiusEl.value));
    saveBtn.setAttribute("aria-pressed", on ? "true" : "false");
    saveBtn.setAttribute("aria-label", on ? "Remove saved destination" : "Save destination");
  }
  function setStatus(text, bad) {
    statusEl.textContent = text || "";
    statusEl.classList.toggle("bad", !!bad);
  }
  function setSpin(on) { spin.hidden = !on; }

  function buildOptions(q, extra) {
    const query = q.trim().toLowerCase();
    const options = [];
    const recent = readRecent().filter((r) => !query || r.label.toLowerCase().includes(query) || String(r.query).toLowerCase().includes(query));
    if (recent.length) {
      options.push({ section: "Recently used" });
      recent.forEach((r) => options.push({ label: displayName(r), hint: radiusText(r.radius), run: async () => r }));
    }
    const popularList = POPULAR[country().code] || [];
    const popular = popularList.filter((p) => !query || p.label.toLowerCase().includes(query));
    if (popularList.length && (!query || popular.length)) {
      options.push({ section: "Popular destinations" });
      (query ? popular : popularList).forEach((p) => options.push({
        label: p.label,
        hint: p.area ? "London postcode area" : "Popular destination",
        run: () => resolveQuery(p.query, p)
      }));
    }
    if (extra.loading || extra.error || extra.matches) {
      options.push({ section: country().postcodes ? "Matching postcodes and locations" : "Matching places" });
      if (extra.loading) options.push({ message: "Looking up…" });
      else if (extra.error) options.push({ message: extra.error });
      else if (!extra.matches.length) options.push({ message: country().postcodes ? "No matching postcodes or places. You can keep what you typed." : "No matching places. You can keep what you typed." });
      else extra.matches.forEach((item) => options.push(item));
    }
    return options;
  }

  function openMenu() {
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }
  function closeMenu() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    state.active = -1;
  }
  function paintActive() {
    [...list.querySelectorAll("[role=option]")].forEach((el) => {
      const on = Number(el.dataset.i) === state.active;
      el.setAttribute("aria-selected", on ? "true" : "false");
      if (on) {
        el.id = "lf-opt-active";
        input.setAttribute("aria-activedescendant", el.id);
        el.scrollIntoView({ block: "nearest" });
      }
    });
  }
  function renderOptions(options) {
    state.options = options;
    state.active = -1;
    list.innerHTML = options.map((opt, i) => {
      if (opt.section) return `<div class="lf-sec">${esc(opt.section)}</div>`;
      if (opt.message) return `<div class="lf-empty">${esc(opt.message)}</div>`;
      return `<button type="button" class="lf-opt" role="option" data-i="${i}" aria-selected="false">${PIN}<span><b>${esc(opt.label)}</b><small>${esc(opt.hint || "")}</small></span></button>`;
    }).join("");
  }

  function scheduleSuggest() {
    clearTimeout(suggestTimer);
    if (suggestAbort) suggestAbort.abort();
    const q = input.value.trim();
    const gen = ++state.suggestGen;
    if (!q) {
      setSpin(false);
      renderOptions(buildOptions("", {}));
      openMenu();
      return;
    }
    renderOptions(buildOptions(q, { loading: true }));
    openMenu();
    setSpin(true);
    suggestTimer = setTimeout(() => runSuggest(gen, q), 350);
  }
  async function runSuggest(gen, q) {
    setSpin(true);
    renderOptions(buildOptions(q, { loading: true }));
    openMenu();
    suggestAbort = new AbortController();
    try {
      const matches = await fetchMatches(q, suggestAbort.signal);
      if (gen !== state.suggestGen) return;
      renderOptions(buildOptions(q, { matches }));
      openMenu();
    } catch (e) {
      if (gen !== state.suggestGen || e.name === "AbortError") return;
      renderOptions(buildOptions(q, { error: country().postcodes ? "Couldn't reach the postcode directory. You can keep what you typed." : "Couldn't reach place search. You can keep what you typed." }));
      openMenu();
    } finally {
      if (gen === state.suggestGen) setSpin(false);
    }
  }

  function applyLocation(loc, radius) {
    if (loc && loc.country && COUNTRIES[loc.country] && loc.country !== country().code) setCountry(loc.country, true);
    if (loc && !loc.country) loc.country = country().code;
    state.location = loc;
    input.value = loc.label || "";
    if (radius && [...radiusEl.options].some((o) => o.value === radius)) radiusEl.value = radius;
    closeMenu();
    state.suggestGen++;
    if (suggestAbort) suggestAbort.abort();
    renderNote();
    renderChrome();
    remember(loc);
  }

  async function choose(i) {
    const opt = state.options[i];
    if (!opt || !opt.run) return;
    closeMenu();
    state.suggestGen++;
    if (suggestAbort) suggestAbort.abort();
    setSpin(true);
    try {
      const loc = await opt.run();
      if (loc) applyLocation(loc, loc.radius);
    } catch (e) {
      if (e.name !== "AbortError") {
        note.textContent = e.message || "Couldn't look that up.";
        note.className = "lf-note warn";
      }
    } finally { setSpin(false); }
  }

  function move(delta) {
    if (list.hidden) { scheduleSuggest(); return; }
    const opts = state.options;
    if (!opts.length) return;
    let i = state.active < 0 ? (delta > 0 ? -1 : 0) : state.active;
    for (let n = 0; n < opts.length; n++) {
      i = (i + delta + opts.length) % opts.length;
      if (opts[i] && opts[i].run) { state.active = i; paintActive(); return; }
    }
  }

  function paintSaved() {
    const current = savedEl.value;
    const items = state.saved;
    savedEl.innerHTML = `<option value="">${items.length ? "Saved destinations" : "None saved yet"}</option>` + items.map((s) => `<option value="${esc(s.id)}">${esc(displayName(s))} · ${esc(radiusText(s.radius))}</option>`).join("");
    if ([...savedEl.options].some((o) => o.value === current)) savedEl.value = current;
    removeBtn.disabled = !savedEl.value;
    saveNote.textContent = state.savesMode === "db"
      ? (state.role === "agent" ? "Saved destinations are stored on your login." : "Saved destinations are stored on your admin account.")
      : "Saved destinations are kept in this browser until you run the saved_destinations section of supabase-setup.sql.";
    renderChrome();
  }

  async function loadSaved() {
    if (email() && window.TSDB && TSDB.ready()) {
      try {
        const rows = await TSDB.rest("saved_destinations?select=id,label,query,location_type,outcode,latitude,longitude,radius,verified,detail&order=created_at.desc");
        state.saved = (rows || []).map(fromRow);
        state.savesMode = "db";
        paintSaved();
        return;
      } catch (e) { state.savesMode = "local"; }
    }
    state.saved = readJson(SAVED_KEY).map(fromRow);
    state.savesMode = "local";
    paintSaved();
  }

  async function saveCurrent() {
    let loc = state.location;
    if (!loc || loc.label !== input.value.trim()) {
      setSpin(true);
      try { loc = await resolveQuery(input.value.trim()); } catch (e) { setStatus(e.message, true); setSpin(false); return; }
      setSpin(false);
      if (loc) applyLocation(loc);
    }
    if (!loc) { setStatus("Enter a location before saving it.", true); return; }
    const existing = state.saved.find((s) => s.query === loc.query && s.type === loc.type && s.radius === radiusEl.value);
    if (saveBtn.getAttribute("aria-pressed") === "true" && existing) { await removeSaved(existing.id); return; }
    if (existing) { setStatus("That destination is already saved for this radius.", false); return; }
    const record = toStore({ ...loc, radius: radiusEl.value });
    if (state.savesMode === "db" && email()) {
      try {
        const body = { ...record, owner: email() };
        delete body.id;
        delete body.country;
        const inserted = await TSDB.rest("saved_destinations", {
          method: "POST", prefer: "return=representation", body
        });
        const made = Array.isArray(inserted) ? inserted[0] : inserted;
        state.saved.unshift(fromRow(made || record));
        paintSaved();
        savedEl.value = state.saved[0].id;
        removeBtn.disabled = false;
        setStatus(`Saved ${displayName(loc)}.`, false);
        return;
      } catch (e) { state.savesMode = "local"; }
    }
    record.id = "local-" + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    state.saved.unshift(fromRow(record));
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(state.saved.map(toStore))); } catch (e) {}
    paintSaved();
    savedEl.value = state.saved[0].id;
    removeBtn.disabled = false;
    setStatus(`Saved ${displayName(loc)} in this browser.`, false);
  }

  async function removeSaved(id) {
    const item = state.saved.find((s) => s.id === id);
    if (!item) return;
    if (state.savesMode === "db" && id && !String(id).startsWith("local-")) {
      try { await TSDB.rest("saved_destinations?id=eq." + encodeURIComponent(id), { method: "DELETE", prefer: "return=minimal" }); }
      catch (e) { setStatus("Couldn't remove that saved destination.", true); return; }
    }
    state.saved = state.saved.filter((s) => s.id !== id);
    if (state.savesMode !== "db") {
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(state.saved.map(toStore))); } catch (e) {}
    }
    savedEl.value = "";
    paintSaved();
    setStatus(`Removed ${displayName(item)}.`, false);
  }

  function osmAreaId(type, id) {
    const n = Number(id);
    if (!Number.isFinite(n)) return null;
    if (type === "relation") return 3600000000 + n;
    if (type === "way") return 2400000000 + n;
    return null;
  }
  async function areaIdFor(loc, signal) {
    const direct = osmAreaId(loc.osmType, loc.osmId);
    if (direct) return { id: direct, name: loc.label };
    const name = (loc.type === "full" || loc.type === "partial") ? (loc.adminName || loc.label) : loc.label;
    const list = await nominatimSearch(name, signal);
    const hit = list.find((x) => x.osm_type === "relation" && (x.class === "boundary" || x.type === "administrative" || x.type === "city" || x.type === "town"))
      || list.find((x) => x.osm_type === "relation" || x.osm_type === "way");
    if (!hit) return null;
    const id = osmAreaId(hit.osm_type, hit.osm_id);
    if (!id) return null;
    return { id, name: String(hit.display_name || name).split(",")[0] };
  }

  function crawlOptions() {
    const on = (id) => {
      const el = document.getElementById(id);
      return !!(el && el.checked);
    };
    const keywords = document.getElementById("lfKeywords");
    return {
      deep: on("lfDeep"),
      index: on("lfIndex"),
      social: on("lfSocial"),
      hours: on("lfHours"),
      named: on("lfNamed"),
      contact: on("lfContact"),
      keywords: keywords ? keywords.value.trim() : ""
    };
  }
  function sectorTags(sector, deep) {
    const tags = sector.tags.slice();
    if (deep && DEEP[sector.key]) {
      DEEP[sector.key].forEach((tag) => {
        if (!tags.some((have) => have[0] === tag[0] && have[1] === tag[1])) tags.push(tag);
      });
    }
    return tags;
  }
  function keywordSelector(raw) {
    const words = String(raw || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5);
    const safe = [];
    words.forEach((word) => {
      if (!/^[\p{L}\p{N}][\p{L}\p{N} .'-]{0,40}$/u.test(word)) return;
      safe.push(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    });
    return safe.length ? '["name"~"' + safe.join("|") + '",i]' : "";
  }
  function buildQuery(sector, filter, areaPrefix, limit, crawl) {
    const kinds = crawl.deep ? ["nwr"] : ["node", "way"];
    const named = crawl.named ? '["name"]' : "";
    const lines = [];
    sectorTags(sector, crawl.deep).forEach(([key, value]) => {
      const sel = (value === "*" ? `["${key}"]` : `["${key}"="${value}"]`) + named;
      kinds.forEach((kind) => lines.push(`${kind}${sel}(${filter});`));
    });
    const kw = keywordSelector(crawl.keywords);
    if (kw) kinds.forEach((kind) => lines.push(`${kind}${kw}(${filter});`));
    const timeout = crawl.deep || sector.wide || kw ? 40 : 25;
    return `[out:json][timeout:${timeout}];\n${areaPrefix || ""}(\n${lines.join("\n")}\n);\nout center ${limit};`;
  }

  async function overpass(ql, timeoutMs) {
    let lastErr = "The map search didn't answer.";
    for (let i = 0; i < OVERPASS.length; i++) {
      const endpoint = OVERPASS[i];
      const budget = i === 0 ? Math.min(timeoutMs || 28000, 20000) : (timeoutMs || 28000);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Accept: "application/json" },
          body: "data=" + encodeURIComponent(ql),
          signal: AbortSignal.timeout ? AbortSignal.timeout(budget) : undefined
        });
        const text = await res.text();
        if (res.status === 429 || res.status === 502 || res.status === 504) {
          lastErr = "The OpenStreetMap business search is busy. Wait a few seconds and try again. Your location and radius are still set.";
          continue;
        }
        if (!res.ok) { lastErr = "The map search returned " + res.status + "."; continue; }
        let data;
        try { data = JSON.parse(text); } catch (e) { lastErr = "The map search returned an unreadable answer."; continue; }
        if (data.error) { lastErr = String(data.error); continue; }
        return data.elements || [];
      } catch (e) {
        if (e.name === "TimeoutError" || e.name === "AbortError") lastErr = "The map search timed out. Try a smaller radius.";
        else if (e.message === "Failed to fetch") lastErr = "The map search could not be reached. Try again in a moment.";
        else lastErr = e.message || lastErr;
      }
    }
    throw new Error(lastErr);
  }

  function cleanPhone(tags) {
    const raw = tags.phone || tags["contact:phone"] || tags.mobile || tags["contact:mobile"] || "";
    const first = String(raw).split(/[;,]/)[0].replace(/^tel:/i, "").trim().replace(/\s+/g, " ");
    const digits = first.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return "";
    if (/[a-z]/i.test(first)) return "";
    return first.slice(0, 40);
  }
  function cleanWhatsapp(tags) {
    return cleanPhone({ phone: tags["contact:whatsapp"] || tags.whatsapp || "" });
  }
  function internationalDial(value, code) {
    let dial = String(value || "").replace(/[^\d+]/g, "");
    if (dial.startsWith("+")) {
      if (code === "gb" && dial.startsWith("+440")) dial = "+44" + dial.slice(4);
      return dial;
    }
    if (dial.startsWith("00")) return "+" + dial.slice(2);
    const prefix = { gb: "44", au: "61", ae: "971", us: "1", lk: "94" }[code];
    if (dial.startsWith("0") && prefix) return "+" + prefix + dial.slice(1);
    if (code === "us" && dial.length === 10) return "+1" + dial;
    if (code === "lk" && dial.length === 9 && prefix) return "+" + prefix + dial;
    if ((code === "ae" || code === "au") && dial.length === 9 && prefix) return "+" + prefix + dial;
    return dial;
  }
  function cleanSocial(raw, host) {
    let s = String(raw || "").trim().split(/[\s;]/)[0];
    if (!s || /^yes$/i.test(s)) return "";
    if (s.startsWith("@")) s = "https://" + host + "/" + s.slice(1);
    else if (!/^https?:\/\//i.test(s)) {
      s = s.includes(".") ? "https://" + s.replace(/^\/\//, "") : "https://" + host + "/" + s.replace(/^\/+/, "");
    }
    try {
      const url = new URL(s);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      return url.href.slice(0, 300);
    } catch (e) { return ""; }
  }
  function cleanEmail(tags) {
    let raw = String(tags.email || tags["contact:email"] || "").split(/[;,]/)[0].trim();
    const angled = raw.match(/<([^>]+)>/);
    if (angled) raw = angled[1].trim();
    raw = raw.toLowerCase();
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(raw)) return "";
    if (raw.endsWith("@example.com") || raw.startsWith("noreply@") || raw.startsWith("no-reply@")) return "";
    return raw.slice(0, 160);
  }
  function contactLink(kind, value, cc) {
    if (!value) return "Not listed";
    if (kind === "phone" || kind === "whatsapp") {
      const dial = internationalDial(value, cc || country().code);
      if (kind === "whatsapp") {
        const digits = dial.replace(/\D/g, "");
        return digits ? `<a href="https://wa.me/${esc(digits)}" target="_blank" rel="noopener noreferrer">${esc(value)}</a>` : esc(value);
      }
      return `<a href="tel:${esc(dial)}">${esc(value)}</a>`;
    }
    return `<a href="mailto:${esc(value)}">${esc(value)}</a>`;
  }
  function socialCell(row) {
    const links = [];
    if (row.facebook) links.push(`<a href="${esc(row.facebook)}" target="_blank" rel="noopener noreferrer">Facebook</a>`);
    if (row.instagram) links.push(`<a href="${esc(row.instagram)}" target="_blank" rel="noopener noreferrer">Instagram</a>`);
    return links.length ? links.join(" · ") : "Not listed";
  }
  function missingColumn(err) {
    return /column/i.test(err && err.message || "") && /phone|email/i.test(err.message || "");
  }
  function cleanWeb(raw) {
    let s = String(raw || "").trim().split(/[;\s]/)[0];
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/\//, "");
    try {
      const url = new URL(s);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      return url.href;
    } catch (e) { return ""; }
  }
  function toLead(el, centre) {
    const tags = el.tags || {};
    const lat = el.lat != null ? el.lat : (el.center && el.center.lat);
    const lon = el.lon != null ? el.lon : (el.center && el.center.lon);
    if (lat == null || lon == null) return null;
    const website = cleanWeb(tags.website || tags["contact:website"] || tags.url || "");
    const type = el.type || "node";
    const cuisine = String(tags.cuisine || "").replace(/_/g, " ").split(";")[0].trim().slice(0, 40);
    const kind = tags.amenity || tags.shop || tags.tourism || tags.healthcare || tags.craft || tags.leisure || tags.office || "place";
    return {
      name: tags.name || tags.brand || tags.operator || "Unnamed place",
      kind: cuisine ? kind + " · " + cuisine : kind,
      address: [tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"], tags["addr:city"], tags["addr:state"], tags["addr:postcode"]].filter(Boolean).join(" "),
      phone: cleanPhone(tags),
      email: cleanEmail(tags),
      website,
      whatsapp: cleanWhatsapp(tags),
      facebook: cleanSocial(tags["contact:facebook"] || tags.facebook || "", "facebook.com"),
      instagram: cleanSocial(tags["contact:instagram"] || tags.instagram || "", "instagram.com"),
      hours: String(tags.opening_hours || "").replace(/\s+/g, " ").trim().slice(0, 160),
      cuisine,
      miles: milesBetween(centre.lat, centre.lon, lat, lon), lat, lon,
      cc: country().code,
      dedupe: `${type}/${el.id}`,
      osm: `https://www.openstreetmap.org/${type}/${el.id}`
    };
  }
  function osmTypeName(t) {
    if (t === "W" || t === "way") return "way";
    if (t === "R" || t === "relation") return "relation";
    return "node";
  }
  async function photonLeads(sector, lat, lon, miles, crawl) {
    if (!crawl.index || sector.wide) return { leads: [], missed: false };
    const tags = sectorTags(sector, crawl.deep).filter((pair) => pair[1] !== "*").slice(0, 6);
    if (!tags.length) return { leads: [], missed: false };
    const want = country().code.toUpperCase();
    const jobs = tags.map(async ([key, value]) => {
      const url = "https://photon.komoot.io/api/?q=" + encodeURIComponent(String(value).replace(/_/g, " "))
        + "&lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon)
        + "&limit=25&lang=en&osm_tag=" + encodeURIComponent(key + ":" + value);
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      return Array.isArray(data.features) ? data.features : [];
    });
    const settled = await Promise.allSettled(jobs);
    const leads = [];
    let failed = 0;
    settled.forEach((result) => {
      if (result.status !== "fulfilled") { failed++; return; }
      result.value.forEach((feature) => {
        const props = feature.properties || {};
        const coords = feature.geometry && feature.geometry.coordinates;
        if (!coords || String(props.countrycode || "").toUpperCase() !== want) return;
        const name = props.name || props.street || "";
        if (!name || !props.osm_id) return;
        const plat = Number(coords[1]);
        const plon = Number(coords[0]);
        if (!Number.isFinite(plat) || !Number.isFinite(plon)) return;
        const type = osmTypeName(props.osm_type);
        const lead = {
          name, kind: props.osm_value || props.osm_key || "place",
          address: [props.housenumber, props.street, props.district, props.city || props.town, props.postcode].filter(Boolean).join(" "),
          phone: "", email: "", website: "", whatsapp: "", facebook: "", instagram: "", hours: "", cuisine: "",
          miles: milesBetween(lat, lon, plat, plon), lat: plat, lon: plon, cc: country().code,
          dedupe: `${type}/${props.osm_id}`,
          osm: `https://www.openstreetmap.org/${type}/${props.osm_id}`,
          source: "index"
        };
        if (miles && lead.miles > miles + 0.05) return;
        leads.push(lead);
      });
    });
    return { leads, missed: failed === tags.length };
  }

  function renderRows(rows) {
    const head = document.getElementById("lfHead");
    const crawl = crawlOptions();
    if (head) {
      head.innerHTML = "<th>Business</th><th>Type</th><th>Address</th><th>Distance</th><th>Phone</th><th>Email</th><th>Website</th>"
        + (crawl.social ? "<th>WhatsApp</th><th>Social</th>" : "")
        + (crawl.hours ? "<th>Hours</th>" : "");
    }
    if (!rows.length) { tableWrap.hidden = true; rowsEl.innerHTML = ""; return; }
    tableWrap.hidden = false;
    rowsEl.innerHTML = rows.map((row) => {
      let host = "";
      if (row.website) { try { host = new URL(row.website).hostname; } catch (e) { host = ""; } }
      return `<tr>
      <td><a href="${esc(row.osm)}" target="_blank" rel="noopener noreferrer">${esc(row.name)}</a></td>
      <td>${esc(row.kind)}</td>
      <td>${esc(row.address || "—")}</td>
      <td class="num">${esc(formatMiles(row.miles))}</td>
      <td class="lf-contact">${contactLink("phone", row.phone, row.cc)}</td>
      <td class="lf-contact">${contactLink("email", row.email)}</td>
      <td>${host ? `<a href="${esc(row.website)}" target="_blank" rel="noopener noreferrer">${esc(host)}</a> <span class="pill web-wait" data-host="${esc(host)}" data-key="${esc(row.dedupe)}">Checking domain…</span>` : '<span class="pill web-none">No website listed</span>'}</td>
      ${crawl.social ? `<td class="lf-contact">${contactLink("whatsapp", row.whatsapp, row.cc)}</td><td>${socialCell(row)}</td>` : ""}
      ${crawl.hours ? `<td class="lf-hours">${esc(row.hours || "Not listed")}</td>` : ""}
    </tr>`;
    }).join("");
  }

  async function websiteStatus(url) {
    let host = "";
    try { host = new URL(url).hostname; } catch (e) { return { cls: "web-down", text: "Website address isn't usable" }; }
    if (webCache.has(host)) return webCache.get(host);
    let status;
    try {
      const res = await fetch("https://cloudflare-dns.com/dns-query?name=" + encodeURIComponent(host) + "&type=A", { headers: { Accept: "application/dns-json" } });
      const data = await res.json();
      const answers = data.Answer || [];
      if (!res.ok || data.Status === 3 || !answers.length) status = { cls: "web-down", text: "Domain does not resolve" };
      else {
        try {
          const page = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
          status = page.ok
            ? { cls: "web-up", text: "Website responded" }
            : { cls: "web-wait", text: "Domain exists · HTTP " + page.status };
        } catch (e) {
          status = { cls: "web-wait", text: "Domain exists · page hidden from this browser" };
        }
      }
    } catch (e) {
      status = { cls: "web-wait", text: "Couldn't check the domain" };
    }
    webCache.set(host, status);
    return status;
  }
  async function checkSites(gen) {
    const pills = [...rowsEl.querySelectorAll("[data-host]")];
    let n = 0;
    const updates = new Map();
    async function worker() {
      while (n < pills.length) {
        if (gen !== state.searchGen) return;
        const pill = pills[n++];
        const host = pill.getAttribute("data-host");
        const link = pill.previousElementSibling;
        const href = link && link.getAttribute("href");
        const result = await websiteStatus(href || "https://" + host);
        if (gen !== state.searchGen) return;
        pill.className = "pill " + result.cls;
        pill.textContent = result.text;
        const key = pill.getAttribute("data-key");
        if (key) updates.set(key, result.text);
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (gen !== state.searchGen || !state.dbOk || !updates.size) return;
    const groups = new Map();
    updates.forEach((text, key) => {
      if (!groups.has(text)) groups.set(text, []);
      groups.get(text).push(key);
    });
    for (const [text, keys] of groups) {
      try {
        await TSDB.rest("saved_leads?dedupe_key=in.(" + inFilter(keys) + ")" + (state.role === "agent" && email() ? "&found_by=eq." + encodeURIComponent(email()) : ""), {
          method: "PATCH", prefer: "return=minimal", body: { website_status: text.slice(0, 120) }
        });
      } catch (e) {}
    }
    loadLibrary();
  }

  function clip(value, max) { return String(value || "").slice(0, max); }
  function inFilter(keys) {
    return keys.map((key) => '"' + String(key).replace(/["\\]/g, "") + '"').join(",");
  }
  function csvCell(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
  function when(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  function setLeadCount(n) {
    if (leadCountEl) leadCountEl.textContent = String(n);
    const dash = document.getElementById("sLeads");
    const sub = document.getElementById("sLeadsSub");
    if (dash) dash.textContent = state.dbOk === false ? "–" : String(n);
    if (sub) sub.textContent = state.dbOk === false ? "Needs the leads table" : (state.role === "agent" ? "On your login" : "Stored for the team");
  }
  function visibleLeads() {
    const sector = sectorFilter ? sectorFilter.value : "";
    const reachable = contactOnly && contactOnly.checked;
    return state.leads.filter((lead) => (!sector || lead.sector === sector) && (!reachable || lead.phone || lead.email));
  }
  function paintLibrary() {
    const leads = state.leads;
    setLeadCount(leads.length);
    const label = document.getElementById("lfSavedLabel");
    const intro = document.getElementById("lfTrackerIntro");
    if (label) label.textContent = state.role === "agent" ? "Your leads" : "Saved leads";
    if (intro) intro.textContent = state.role === "agent"
      ? "Leads from your searches. This login only shows your own list."
      : "Leads saved by the team from the lead finder.";
    if (dbNote) {
      dbNote.className = "lf-note" + (state.dbOk === false ? " warn" : "");
      const contactNote = state.contactCols === false
        ? " Phone and email show on each search, but they are not stored yet. In Supabase SQL Editor, run the phone and email block at the end of supabase-setup.sql, then search again."
        : "";
      const filterNote = leads.length && contactOnly && contactOnly.checked && !visibleLeads().length
        ? " None of the saved leads have a public phone or email yet."
        : "";
      const empty = state.role === "agent"
        ? "Businesses you find are stored here, on your login only."
        : "Named businesses from a search are stored here for the whole team.";
      const missing = state.role === "agent"
        ? "Your leads are not being stored yet. In Supabase, open SQL Editor and run the agents section at the end of supabase-setup.sql, then search again."
        : "Leads are not being stored yet. In Supabase, open SQL Editor and run the saved_leads section at the end of supabase-setup.sql, then search again.";
      dbNote.textContent = state.dbOk === false ? missing : ((leads.length ? "" : empty) + contactNote + filterNote);
    }
    const sectors = [...new Set(leads.map((lead) => lead.sector).filter(Boolean))].sort();
    if (sectorFilter) {
      const current = sectorFilter.value;
      sectorFilter.innerHTML = `<option value="">All sectors</option>` + sectors.map((sector) => `<option value="${esc(sector)}">${esc(sector)}</option>`).join("");
      if (sectors.includes(current)) sectorFilter.value = current;
    }
    const shown = visibleLeads();
    if (savedWrap) savedWrap.hidden = !shown.length;
    if (savedRowsEl) {
      savedRowsEl.innerHTML = shown.map((lead) => `<tr>
        <td>${lead.osm_url ? `<a href="${esc(lead.osm_url)}" target="_blank" rel="noopener noreferrer">${esc(lead.name)}</a>` : esc(lead.name)}</td>
        <td>${esc(lead.sector)}</td>
        <td>${esc(lead.category || "—")}</td>
        <td>${esc(lead.address || "—")}</td>
        <td>${esc(lead.area || "—")}${lead.radius ? " · " + esc(lead.radius) : ""}</td>
        <td class="lf-contact">${contactLink("phone", lead.phone)}</td>
        <td class="lf-contact">${contactLink("email", lead.email)}</td>
        <td>${lead.website ? `<a href="${esc(lead.website)}" target="_blank" rel="noopener noreferrer">${esc(lead.website_status || "Website")}</a>` : esc(lead.website_status || "No website listed")}</td>
        <td>${esc(lead.found_by || "—")}</td>
      </tr>`).join("");
    }
    if (historyEl) {
      historyEl.innerHTML = state.history.length
        ? state.history.map((search) => `<li>${esc(search.sector)} · ${esc(search.area)} · ${esc(search.radius || "radius not set")} · ${esc(search.result_count)} found · ${esc(search.new_count)} new · ${esc(when(search.created_at))}</li>`).join("")
        : `<li>No searches stored yet.</li>`;
    }
  }
  const LEAD_SELECT = "dedupe_key,name,sector,category,address,area,radius,phone,email,website,website_status,osm_url,found_by,created_at";
  const LEAD_SELECT_PLAIN = "dedupe_key,name,sector,category,address,area,radius,website,website_status,osm_url,found_by,created_at";
  async function loadLibrary() {
    if (!window.TSDB || !TSDB.session()) return;
    try {
      const history = await TSDB.rest("lead_searches?select=sector,area,radius,result_count,new_count,created_at&order=created_at.desc&limit=20");
      let leads;
      try {
        leads = await TSDB.rest("saved_leads?select=" + LEAD_SELECT + "&order=created_at.desc&limit=500");
        state.contactCols = true;
      } catch (e) {
        if (!missingColumn(e)) throw e;
        leads = await TSDB.rest("saved_leads?select=" + LEAD_SELECT_PLAIN + "&order=created_at.desc&limit=500");
        state.contactCols = false;
      }
      state.leads = leads || [];
      state.history = history || [];
      state.dbOk = true;
    } catch (e) {
      state.dbOk = false;
    }
    paintLibrary();
  }
  async function rememberSearch(sector, loc, radius, leads) {
    const named = leads.filter((lead) => lead.name !== "Unnamed place" && lead.dedupe);
    const record = {
      sector: clip(sector.label, 80),
      area: clip(country().label + " · " + loc.label, 120),
      radius: clip(radiusText(radius), 40),
      result_count: leads.length,
      new_count: 0,
      searched_by: email()
    };
    if (!window.TSDB || !TSDB.session()) return { ok: false, added: 0, skipped: named.length };
    let existing = [];
    try {
      if (named.length) {
        existing = await TSDB.rest("saved_leads?select=dedupe_key,found_by&dedupe_key=in.(" + inFilter(named.map((lead) => lead.dedupe)) + ")") || [];
      }
      state.dbOk = true;
    } catch (e) {
      state.dbOk = false;
      paintLibrary();
      return { ok: false, added: 0, skipped: 0 };
    }
    const have = new Set(existing.map((row) => row.dedupe_key));
    const fresh = named.filter((lead) => !have.has(lead.dedupe));
    record.new_count = fresh.length;
    function leadRow(lead, withContact) {
      const row = {
        dedupe_key: clip(lead.dedupe, 80),
        name: clip(lead.name, 160),
        sector: clip(sector.label, 80),
        category: clip(lead.kind, 80),
        address: clip(lead.address, 240),
        area: clip(country().label + " · " + loc.label, 120),
        radius: clip(radiusText(radius), 40),
        miles: lead.miles == null ? null : Math.round(lead.miles * 100) / 100,
        website: clip(lead.website, 500),
        website_status: lead.website ? "Checking domain…" : "No website listed",
        osm_url: clip(lead.osm, 200),
        latitude: lead.lat,
        longitude: lead.lon,
        found_by: email()
      };
      if (withContact) {
        row.phone = clip(lead.phone || lead.whatsapp, 40);
        row.email = clip(lead.email, 160);
      }
      const notes = leadNotes(lead);
      if (notes) row.notes = notes;
      return row;
    }
    function leadNotes(lead) {
      const bits = [];
      if (lead.whatsapp) bits.push("WhatsApp: " + lead.whatsapp);
      if (lead.facebook) bits.push("Facebook: " + lead.facebook);
      if (lead.instagram) bits.push("Instagram: " + lead.instagram);
      if (lead.hours) bits.push("Hours: " + lead.hours);
      if (lead.source === "index") bits.push("Also listed in the place index.");
      return bits.join("\n").slice(0, 4000);
    }
    function withoutNotes(body) {
      return body.map((row) => {
        const copy = { ...row };
        delete copy.notes;
        return copy;
      });
    }
    async function insertLeads(body) {
      const post = (rows, conflict) => TSDB.rest("saved_leads?on_conflict=" + conflict, {
        method: "POST",
        prefer: "return=minimal,resolution=ignore-duplicates",
        body: rows
      });
      let rows = body;
      try {
        try {
          await post(rows, "dedupe_key,found_by");
        } catch (e) {
          if (/column/i.test(e.message || "") && /notes/i.test(e.message || "")) {
            rows = withoutNotes(rows);
            await post(rows, "dedupe_key,found_by");
            return;
          }
          if (!/unique|conflict|constraint/i.test(e.message || "")) throw e;
          await post(rows, "dedupe_key");
        }
      } catch (e) {
        if (/column/i.test(e.message || "") && /notes/i.test(e.message || "")) {
          await post(withoutNotes(rows), "dedupe_key");
          return;
        }
        throw e;
      }
    }
    async function fillContacts(rows) {
      const byKey = new Map();
      existing.forEach((row) => {
        if (!byKey.has(row.dedupe_key)) byKey.set(row.dedupe_key, []);
        byKey.get(row.dedupe_key).push(row.found_by);
      });
      for (const lead of rows) {
        const body = {};
        if (lead.phone) body.phone = clip(lead.phone, 40);
        if (lead.email) body.email = clip(lead.email, 160);
        if (!Object.keys(body).length) continue;
        const owners = state.role === "agent" ? [email()] : (byKey.get(lead.dedupe) || [email()]);
        for (const owner of owners) {
          await TSDB.rest(
            "saved_leads?dedupe_key=eq." + encodeURIComponent(lead.dedupe) + "&found_by=eq." + encodeURIComponent(owner),
            { method: "PATCH", prefer: "return=minimal", body }
          );
        }
      }
    }
    try {
      if (fresh.length) {
        const withContact = state.contactCols !== false;
        try {
          await insertLeads(fresh.map((lead) => leadRow(lead, withContact)));
          if (withContact) state.contactCols = true;
        } catch (e) {
          if (!withContact || !missingColumn(e)) throw e;
          state.contactCols = false;
          await insertLeads(fresh.map((lead) => leadRow(lead, false)));
        }
      }
      if (state.contactCols !== false) {
        const known = named.filter((lead) => have.has(lead.dedupe) && (lead.phone || lead.email));
        if (known.length) {
          try { await fillContacts(known); state.contactCols = true; }
          catch (e) { if (!missingColumn(e)) throw e; state.contactCols = false; }
        }
      }
      await TSDB.rest("lead_searches", { method: "POST", prefer: "return=minimal", body: record });
      await loadLibrary();
      document.dispatchEvent(new CustomEvent("ts:leads-saved"));
      return { ok: true, added: fresh.length, skipped: named.length - fresh.length };
    } catch (e) {
      state.dbOk = false;
      paintLibrary();
      return { ok: false, added: 0, skipped: 0 };
    }
  }

  async function runSearch() {
    const sectorKey = sectorEl.value;
    const sector = SECTORS[sectorKey] ? { key: sectorKey, ...SECTORS[sectorKey] } : null;
    if (!sector) { setStatus("Choose a business sector.", true); return; }
    const typed = input.value.trim();
    if (!typed) { setStatus("Enter a postcode, town or city.", true); return; }
    const radius = radiusEl.value;
    const max = Number(maxEl.value) || 25;
    const crawl = crawlOptions();
    if (sector.wide && (radius === "area" || Number(radius) > 15)) {
      setStatus("All mapped businesses is a wide crawl. Choose a radius of 15 miles or less.", true);
      return;
    }
    const gen = ++state.searchGen;
    goBtn.disabled = true;
    setSpin(true);
    tableWrap.hidden = true;
    rowsEl.innerHTML = "";
    try {
      let loc = state.location;
      if (!loc || loc.label !== typed) loc = await resolveQuery(typed);
      if (gen !== state.searchGen) return;
      if (!loc) { setStatus("Enter a postcode, town or city.", true); return; }
      applyLocation(loc);
      if (loc.latitude == null || loc.longitude == null) {
        lastSearch = { params: { sector: sector.label, radius, max, location: loc }, query: "" };
        setStatus(loc.warning || "This location has no map point, so the search can't run.", true);
        criteriaEl.textContent = "";
        return;
      }
      const lat = Number(loc.latitude);
      const lon = Number(loc.longitude);
      let filter = "";
      let areaPrefix = "";
      let where = "";
      if (radius === "area") {
        setStatus("Looking up the area boundary…");
        const area = await areaIdFor(loc);
        if (gen !== state.searchGen) return;
        if (!area) {
          lastSearch = { params: { sector: sector.label, radius, max, location: loc }, query: "" };
          setStatus("OpenStreetMap has no boundary for this place. Choose a mile radius to search around its centre.", true);
          return;
        }
        filter = "area.a";
        areaPrefix = `area(${area.id})->.a;\n`;
        where = `the mapped boundary of ${area.name}`;
        if (loc.type === "full" || loc.type === "partial") where += " (a postcode district is not itself a city boundary)";
        if (/^london$/i.test(loc.label)) where += ". Large cities can time out on the free map service";
      } else {
        const meters = metersFor(radius);
        filter = `around:${meters},${lat.toFixed(6)},${lon.toFixed(6)}`;
        const from = loc.type === "full" ? "this postcode" : loc.type === "partial" ? `the centre of district ${loc.label}` : `the mapped centre of ${loc.label}`;
        where = `${radiusText(radius)} from ${from}`;
      }
      const slow = crawl.deep || sector.wide || !!keywordSelector(crawl.keywords);
      const limit = Math.min(slow ? 300 : 200, Math.max(max, slow ? 80 : 40));
      const ql = buildQuery(sector, filter, areaPrefix, limit, crawl);
      const milesCap = radius === "area" ? null : MILES[radius];
      lastSearch = { params: { country: country().label, sector: sector.label, radius, max, crawl, location: { label: loc.label, type: loc.type, latitude: lat, longitude: lon, verified: loc.verified } }, query: ql };
      const criteria = [country().label, sector.label, where];
      if (crawl.deep) criteria.push("deep crawl");
      if (crawl.index && !sector.wide) criteria.push("place index");
      if (keywordSelector(crawl.keywords)) criteria.push("name match");
      criteriaEl.textContent = criteria.join(" · ");
      setStatus(crawl.deep ? "Deep crawl of mapped businesses…" : "Searching mapped businesses…");
      let mapError = "";
      const [elements, indexed] = await Promise.all([
        overpass(ql, slow ? 42000 : 28000).catch((err) => { mapError = err.message || "The map search didn't answer."; return []; }),
        photonLeads(sector, lat, lon, milesCap, crawl)
      ]);
      if (gen !== state.searchGen) return;
      const byKey = new Map();
      function addLead(lead) {
        if (!lead || !lead.dedupe) return;
        const prev = byKey.get(lead.dedupe);
        if (!prev) { byKey.set(lead.dedupe, lead); return; }
        const score = (item) => (item.phone ? 4 : 0) + (item.email ? 4 : 0) + (item.website ? 2 : 0) + (item.whatsapp ? 2 : 0) + (item.hours ? 1 : 0);
        if (score(lead) > score(prev)) byKey.set(lead.dedupe, lead);
      }
      elements.forEach((el) => addLead(toLead(el, { lat, lon })));
      indexed.leads.forEach(addLead);
      let leads = [...byKey.values()];
      if (radius !== "area") leads = leads.filter((lead) => lead.miles <= milesCap + 0.05);
      if (crawl.named) leads = leads.filter((lead) => lead.name && lead.name !== "Unnamed place");
      if (crawl.contact) leads = leads.filter((lead) => lead.phone || lead.email || lead.website || lead.whatsapp);
      leads.sort((a, b) => a.miles - b.miles || a.name.localeCompare(b.name));
      const limited = elements.length >= limit;
      const extra = leads.length > max;
      leads = leads.slice(0, max);
      renderRows(leads);
      const stored = await rememberSearch(sector, loc, radius, leads);
      if (gen !== state.searchGen) return;
      const storeNote = !stored.ok
        ? " These results were not stored."
        : ` Saved ${stored.added} new${stored.skipped ? `, ${stored.skipped} already stored` : ""}.`;
      const reachable = leads.filter((lead) => lead.phone || lead.email || lead.whatsapp).length;
      const contactNote = !leads.length ? ""
        : reachable
          ? ` ${reachable} list a public phone, email or WhatsApp.`
          : " None of these list a public phone, email or WhatsApp on the map.";
      const indexCount = leads.filter((lead) => lead.source === "index").length;
      const indexNote = !crawl.index || sector.wide ? ""
        : indexed.missed ? " The place index did not respond."
        : indexCount ? ` ${indexCount} ${indexCount === 1 ? "was" : "were"} added from the place index.` : "";
      const keywordNote = crawl.keywords && !keywordSelector(crawl.keywords) ? " Keywords need letters or numbers, so that part was skipped." : "";
      const mapNote = mapError ? " The main map search did not answer, so this set is from the place index." : "";
      const place = `${country().label}, ${where}`;
      if (!leads.length && mapError && !indexCount) { setStatus(mapError, true); return; }
      if (!leads.length) setStatus(`No ${sector.label.toLowerCase()} were mapped in ${place}.${crawl.contact ? " The contact filter is on." : ""} OpenStreetMap does not list every business.${indexNote}${keywordNote}${mapNote}${storeNote}`, false);
      else setStatus(`${leads.length} mapped ${leads.length === 1 ? "business" : "businesses"} in ${place}.${contactNote}${indexNote}${keywordNote}${mapNote}${extra || limited ? " Narrow the radius if you need a tighter set." : ""}${storeNote}`, false);
      checkSites(gen);
    } catch (e) {
      if (gen !== state.searchGen) return;
      setStatus(e.message || "Search failed.", true);
    } finally {
      if (gen === state.searchGen) { goBtn.disabled = false; setSpin(false); }
    }
  }

  function syncCountryUi() {
    const c = country();
    const label = document.getElementById("lfQLabel");
    if (label) label.textContent = c.postcodes ? "UK postcode, town or city" : "Town or city";
    input.placeholder = c.postcodes
      ? "Enter a postcode, e.g. N15 4JA, or search London"
      : "Search a town or city, e.g. " + c.example;
  }
  function setCountry(code, keep) {
    const root = document.getElementById("lfCountry");
    if (!root || !COUNTRIES[code]) return;
    root.querySelectorAll("[data-country]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-country") === code ? "true" : "false");
    });
    syncCountryUi();
    if (keep) return;
    state.location = null;
    input.value = "";
    closeMenu();
    renderNote();
    renderChrome();
  }
  input.addEventListener("focus", () => { if (list.hidden) scheduleSuggest(); });
  const countryEl = document.getElementById("lfCountry");
  if (countryEl) countryEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-country]");
    if (!btn || btn.getAttribute("aria-pressed") === "true") return;
    setCountry(btn.getAttribute("data-country"));
  });
  syncCountryUi();
  input.addEventListener("click", () => { if (list.hidden) scheduleSuggest(); });
  input.addEventListener("input", () => {
    if (state.location && input.value.trim() !== state.location.label) state.location = null;
    renderNote();
    renderChrome();
    scheduleSuggest();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Escape") closeMenu();
    else if (e.key === "Enter") {
      e.preventDefault();
      if (!list.hidden && state.active >= 0) choose(state.active);
      else { closeMenu(); runSearch(); }
    }
  });
  list.addEventListener("mousedown", (e) => e.preventDefault());
  list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-i]");
    if (btn) choose(Number(btn.dataset.i));
  });
  document.addEventListener("pointerdown", (e) => { if (!locRoot.contains(e.target)) closeMenu(); });
  clearBtn.addEventListener("click", () => {
    state.location = null;
    input.value = "";
    closeMenu();
    renderNote();
    renderChrome();
    criteriaEl.textContent = "";
    input.focus();
    scheduleSuggest();
  });
  saveBtn.addEventListener("click", () => { saveCurrent(); });
  radiusEl.addEventListener("change", renderChrome);
  savedEl.addEventListener("change", () => {
    removeBtn.disabled = !savedEl.value;
    const item = state.saved.find((s) => s.id === savedEl.value);
    if (item) applyLocation(item, item.radius);
  });
  removeBtn.addEventListener("click", () => {
    const item = state.saved.find((s) => s.id === savedEl.value);
    if (!item) return;
    if (confirm(`Remove ${displayName(item)} from saved destinations?`)) removeSaved(item.id);
  });
  goBtn.addEventListener("click", () => { runSearch(); });
  if (sectorFilter) sectorFilter.addEventListener("change", paintLibrary);
  if (contactOnly) contactOnly.addEventListener("change", paintLibrary);
  if (exportBtn) exportBtn.addEventListener("click", () => {
    const rows = visibleLeads();
    if (!rows.length) { setStatus("There are no saved leads to export.", true); return; }
    const header = ["Name", "Sector", "Category", "Address", "Area", "Radius", "Phone", "Email", "Website", "Website status", "Saved by", "Map", "Saved"];
    const lines = [header.join(",")].concat(rows.map((lead) => [
      lead.name, lead.sector, lead.category, lead.address, lead.area, lead.radius,
      lead.phone, lead.email, lead.website, lead.website_status, lead.found_by, lead.osm_url, lead.created_at
    ].map(csvCell).join(",")));
    const file = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = "saved-leads.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  });

  window.TSLeadFinder = {
    setRole(next) {
      state.role = next === "agent" ? "agent" : "admin";
      paintLibrary();
    },
    show() {
      if (!state.loaded) { state.loaded = true; loadSaved(); }
      loadLibrary();
    },
    refreshCount() { loadLibrary(); },
    reset() {
      state.loaded = false;
      state.location = null;
      state.leads = [];
      state.history = [];
      state.dbOk = null;
      state.contactCols = null;
      state.role = "admin";
      state.searchGen++;
      setCountry("gb", true);
      ["lfDeep", "lfIndex", "lfSocial", "lfHours", "lfNamed"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.checked = true;
      });
      const contactPick = document.getElementById("lfContact");
      if (contactPick) contactPick.checked = false;
      const keywordPick = document.getElementById("lfKeywords");
      if (keywordPick) keywordPick.value = "";
      input.value = "";
      closeMenu();
      renderNote();
      renderChrome();
      criteriaEl.textContent = "";
      setStatus("");
      tableWrap.hidden = true;
      rowsEl.innerHTML = "";
      paintLibrary();
    },
    state: () => state.location,
    lastSearch: () => lastSearch
  };
})();
