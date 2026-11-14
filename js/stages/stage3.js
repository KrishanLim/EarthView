// Earthview - daily photos of Earth from NASA's EPIC camera
// Krishan Limbu (200612782), COMP1073 Client-Side JavaScript
//
// stage 3 (part 3): random day, the day goes in the url so it can be shared, arrow keys.
// stage 3 overall = using more of the json: every photo from a day, a "play the day" animation,
// and distances worked out from the position vectors
//
// docs used:
//   https://api.nasa.gov/  (EPIC section)
//   https://epic.gsfc.nasa.gov/about/api  (endpoints + how the image urls are built)

const API_KEY = "pcj7ddRDTf6tPFpTbnJdd7c9RdKnbcQh7BcbmFcT";
const EPIC_API = "https://api.nasa.gov/EPIC/api/natural";
const EPIC_ARCHIVE = "https://epic.gsfc.nasa.gov/archive/natural";

const datePicker = document.getElementById("datePicker");
const prevDayBtn = document.getElementById("prevDay");
const nextDayBtn = document.getElementById("nextDay");
const latestBtn = document.getElementById("latestBtn");
const randomBtn = document.getElementById("randomBtn");
const statusMsg = document.getElementById("status");
const viewer = document.getElementById("viewer");
const earthImg = document.getElementById("earthImg");
const photoBox = document.querySelector(".photo");
const photoTimeEl = document.getElementById("photoTime");
const dayTitleEl = document.getElementById("dayTitle");
const captionEl = document.getElementById("caption");
const prevPhotoBtn = document.getElementById("prevPhoto");
const nextPhotoBtn = document.getElementById("nextPhoto");
const photoCountEl = document.getElementById("photoCount");
const playBtn = document.getElementById("playBtn");
const dayStrip = document.getElementById("dayStrip");
const centreEl = document.getElementById("centre");
const dscovrEl = document.getElementById("dscovrDist");
const moonEl = document.getElementById("moonDist");
const sunEl = document.getElementById("sunDist");
const angleEl = document.getElementById("sevAngle");

let availableDates = []; // every day that has photos, oldest first
let photos = [];         // the photos for the day on screen
let index = 0;           // which one of those is showing
let currentDate = null;
let requestCount = 0;    // so old responses get ignored if someone clicks fast
let playTimer = null;


// ---- dates ----
// the date input and the api both use yyyy-mm-dd so i keep dates as strings like that

function toISO(d) {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function fromISO(str) {
  // not using new Date("2024-01-05") because that's read as UTC and ends up a day behind here
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a, b) {
  return Math.round(Math.abs(fromISO(a) - fromISO(b)) / 86400000);
}

function todayISO() {
  return toISO(new Date());
}

function prettyDate(str) {
  return fromISO(str).toLocaleDateString("en-CA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

// photo.date looks like "2026-11-09 00:50:27" and it's in UTC
function takenAt(photo) {
  return new Date(photo.date.replace(" ", "T") + "Z");
}

function timeLabel(photo) {
  const d = takenAt(photo);
  const utc = d.toISOString().slice(11, 16);
  const local = d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  return `Taken at ${utc} UTC (${local} your time)`;
}

// epic doesn't have days with no photos, so if someone picks one of those I jump to the closest day that does
function closestAvailable(date) {
  if (availableDates.length === 0 || availableDates.includes(date)) return date;

  let before = null;
  let after = null;
  for (const d of availableDates) {
    if (d < date) before = d;
    else { after = d; break; }
  }
  if (!after) return before;
  if (!before) return after;
  return daysBetween(date, before) <= daysBetween(after, date) ? before : after;
}

function latestDate() {
  return availableDates[availableDates.length - 1] || todayISO();
}


// ---- talking to nasa ----

async function callEpic(path) {
  const res = await fetch(`${EPIC_API}${path}?api_key=${API_KEY}`);
  if (!res.ok) throw new Error("NASA returned " + res.status);
  return res.json();
}

// the json only gives an image name, the actual file lives in the archive under the date
// size is "jpg" (1080px) or "thumbs" (120px). there's also "png" but those are a few MB each
function imageUrl(photo, size) {
  const [y, m, d] = photo.date.split(" ")[0].split("-");
  return `${EPIC_ARCHIVE}/${y}/${m}/${d}/${size}/${photo.image}.jpg`;
}

async function loadDay(wanted) {
  stopPlaying();
  const date = closestAvailable(wanted);
  const thisRequest = ++requestCount;

  setStatus("Loading " + prettyDate(date) + "...");
  viewer.classList.add("loading");

  try {
    const list = await callEpic("/date/" + date);
    if (thisRequest !== requestCount) return; // user already moved on
    if (list.length === 0) throw new Error("there are no photos for that day");

    photos = list;
    currentDate = date;
    updateDayControls();
    renderStrip();
    showPhoto(0);

    if (date !== wanted) {
      setStatus(`No photos on ${prettyDate(wanted)}, so here's the closest day.`);
    } else {
      setStatus("");
    }
  } catch (err) {
    if (thisRequest !== requestCount) return;
    console.error(err);
    setStatus("Couldn't load that day: " + err.message, true);
  } finally {
    if (thisRequest === requestCount) viewer.classList.remove("loading");
  }
}


// ---- putting it on the page ----

function showPhoto(i) {
  index = (i + photos.length) % photos.length; // wraps around at both ends
  const photo = photos[index];

  const src = imageUrl(photo, "jpg");
  if (earthImg.src !== src) {
    photoBox.classList.add("loading"); // dims the old photo until the new one shows up
    earthImg.src = src;
  }
  earthImg.alt = `Earth photographed by EPIC on ${photo.date} UTC`;
  photoTimeEl.textContent = timeLabel(photo);
  dayTitleEl.textContent = prettyDate(currentDate);
  captionEl.textContent = photo.caption;
  photoCountEl.textContent = `Photo ${index + 1} of ${photos.length}`;

  [...dayStrip.children].forEach((thumb, n) => thumb.classList.toggle("active", n === index));

  showFacts(photo);
}

function updateDayControls() {
  datePicker.value = currentDate;
  history.replaceState(null, "", "#" + currentDate); // so a day can be bookmarked / shared

  const pos = availableDates.indexOf(currentDate);
  prevDayBtn.disabled = pos <= 0;
  nextDayBtn.disabled = pos === -1 || pos >= availableDates.length - 1;
}

function setStatus(text, isError) {
  statusMsg.textContent = text;
  statusMsg.classList.toggle("error", !!isError);
}


// ---- the extra numbers from the json ----

// older entries keep the positions inside "coords", newer ones have them at the top level
function positions(photo) {
  const src = photo.dscovr_j2000_position ? photo : (photo.coords || {});
  return {
    dscovr: src.dscovr_j2000_position,
    moon: src.lunar_j2000_position,
    sun: src.sun_j2000_position,
    centre: photo.centroid_coordinates || src.centroid_coordinates
  };
}

function length(v) {
  return Math.hypot(v.x, v.y, v.z);
}

function km(n) {
  return Math.round(n).toLocaleString("en-CA") + " km";
}

function latLon(lat, lon) {
  return `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? "E" : "W"}`;
}

function showFacts(photo) {
  const p = positions(photo);

  centreEl.textContent = p.centre ? latLon(p.centre.lat, p.centre.lon) : "-";

  if (!p.dscovr || !p.moon || !p.sun) {
    dscovrEl.textContent = moonEl.textContent = sunEl.textContent = angleEl.textContent = "not in the data for this photo";
    return;
  }

  dscovrEl.textContent = km(length(p.dscovr));
  moonEl.textContent = km(length(p.moon));
  sunEl.textContent = (length(p.sun) / 1e6).toFixed(1) + " million km";

  // angle between the satellite and the sun, seen from earth's centre (dot product / lengths = cos of the angle)
  const dot = p.dscovr.x * p.sun.x + p.dscovr.y * p.sun.y + p.dscovr.z * p.sun.z;
  const angle = Math.acos(dot / (length(p.dscovr) * length(p.sun))) * 180 / Math.PI;
  angleEl.textContent = angle.toFixed(1) + "°";
}


// ---- strip of every photo from the day ----

function renderStrip() {
  dayStrip.innerHTML = "";

  photos.forEach((photo, i) => {
    const btn = document.createElement("button");
    btn.className = "thumb";
    btn.title = photo.date + " UTC";

    const img = document.createElement("img");
    img.src = imageUrl(photo, "thumbs");
    img.alt = "";
    img.loading = "lazy";

    const label = document.createElement("span");
    label.textContent = takenAt(photo).toISOString().slice(11, 16);

    btn.append(img, label);
    btn.addEventListener("click", () => {
      stopPlaying();
      showPhoto(i);
    });
    dayStrip.appendChild(btn);
  });
}


// ---- play the day like a little animation, you can see earth spin ----

function startPlaying() {
  if (photos.length < 2) return;

  // load all the full size images first so it doesn't flicker on the first loop
  photos.forEach(photo => {
    const img = new Image();
    img.src = imageUrl(photo, "jpg");
  });

  playBtn.textContent = "Pause";
  playTimer = setInterval(() => showPhoto(index + 1), 700);
}

function stopPlaying() {
  if (!playTimer) return;
  clearInterval(playTimer);
  playTimer = null;
  playBtn.textContent = "Play the day";
}


// ---- events ----

earthImg.addEventListener("load", () => photoBox.classList.remove("loading"));
earthImg.addEventListener("error", () => {
  photoBox.classList.remove("loading");
  setStatus("That photo didn't load, try another one.", true);
});

datePicker.addEventListener("change", () => {
  if (datePicker.value) loadDay(datePicker.value);
});

prevDayBtn.addEventListener("click", () => {
  const pos = availableDates.indexOf(currentDate);
  if (pos > 0) loadDay(availableDates[pos - 1]);
});

nextDayBtn.addEventListener("click", () => {
  const pos = availableDates.indexOf(currentDate);
  if (pos !== -1 && pos < availableDates.length - 1) loadDay(availableDates[pos + 1]);
});

latestBtn.addEventListener("click", () => loadDay(latestDate()));

randomBtn.addEventListener("click", () => {
  if (availableDates.length === 0) return;
  loadDay(availableDates[Math.floor(Math.random() * availableDates.length)]);
});

prevPhotoBtn.addEventListener("click", () => {
  stopPlaying();
  showPhoto(index - 1);
});

nextPhotoBtn.addEventListener("click", () => {
  stopPlaying();
  showPhoto(index + 1);
});

playBtn.addEventListener("click", () => {
  if (playTimer) stopPlaying();
  else startPlaying();
});

// left / right arrow keys step through the photos (but not while typing a date)
document.addEventListener("keydown", e => {
  if (e.target === datePicker || photos.length === 0) return;
  if (e.key === "ArrowLeft") prevPhotoBtn.click();
  if (e.key === "ArrowRight") nextPhotoBtn.click();
});


// ---- start ----

async function start() {
  try {
    availableDates = await callEpic("/available");
    datePicker.min = availableDates[0];
    datePicker.max = latestDate();
  } catch (err) {
    // not the end of the world, the date picker just won't have limits
    console.error("couldn't get the list of available dates", err);
  }

  // if the url already has a date (like index.html#2020-07-04) open that day
  const fromHash = location.hash.slice(1);
  loadDay(/^\d{4}-\d{2}-\d{2}$/.test(fromHash) ? fromHash : latestDate());
}

start();
