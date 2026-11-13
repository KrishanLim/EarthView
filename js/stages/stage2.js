// Earthview - daily photos of Earth from NASA's EPIC camera
// Krishan Limbu (200612782), COMP1073 Client-Side JavaScript
//
// stage 2: date picker using the /available list, prev/next day, stepping through a day's photos.
// switched from .then() to async/await since there's more going on now
//
// docs used:
//   https://api.nasa.gov/  (EPIC section)
//   https://epic.gsfc.nasa.gov/about/api

const API_KEY = "pcj7ddRDTf6tPFpTbnJdd7c9RdKnbcQh7BcbmFcT";
const EPIC_API = "https://api.nasa.gov/EPIC/api/natural";
const EPIC_ARCHIVE = "https://epic.gsfc.nasa.gov/archive/natural";

const datePicker = document.getElementById("datePicker");
const prevDayBtn = document.getElementById("prevDay");
const nextDayBtn = document.getElementById("nextDay");
const latestBtn = document.getElementById("latestBtn");
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

let availableDates = []; // every day that has photos, oldest first
let photos = [];         // the photos for the day on screen
let index = 0;           // which one of those is showing
let currentDate = null;
let requestCount = 0;    // so old responses get ignored if someone clicks fast


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
function imageUrl(photo) {
  const [y, m, d] = photo.date.split(" ")[0].split("-");
  return `${EPIC_ARCHIVE}/${y}/${m}/${d}/jpg/${photo.image}.jpg`;
}

async function loadDay(wanted) {
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

  const src = imageUrl(photo);
  if (earthImg.src !== src) {
    photoBox.classList.add("loading"); // dims the old photo until the new one shows up
    earthImg.src = src;
  }
  earthImg.alt = `Earth photographed by EPIC on ${photo.date} UTC`;
  photoTimeEl.textContent = timeLabel(photo);
  dayTitleEl.textContent = prettyDate(currentDate);
  captionEl.textContent = photo.caption;
  photoCountEl.textContent = `Photo ${index + 1} of ${photos.length}`;
}

function updateDayControls() {
  datePicker.value = currentDate;

  const pos = availableDates.indexOf(currentDate);
  prevDayBtn.disabled = pos <= 0;
  nextDayBtn.disabled = pos === -1 || pos >= availableDates.length - 1;
}

function setStatus(text, isError) {
  statusMsg.textContent = text;
  statusMsg.classList.toggle("error", !!isError);
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

prevPhotoBtn.addEventListener("click", () => showPhoto(index - 1));
nextPhotoBtn.addEventListener("click", () => showPhoto(index + 1));


// ---- start ----

async function start() {
  try {
    availableDates = await callEpic("/available");
    datePicker.min = availableDates[0];
    datePicker.max = latestDate();
  } catch (err) {
    console.error("couldn't get the list of available dates", err);
  }

  loadDay(latestDate());
}

start();
