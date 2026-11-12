// Earthview - daily photos of Earth from NASA's EPIC camera
// Krishan Limbu (200612782), COMP1073 Client-Side JavaScript
//
// stage 1: just getting the basic call from the docs working - latest photo of earth
// docs: https://api.nasa.gov/  (EPIC section)  and  https://epic.gsfc.nasa.gov/about/api

const API_KEY = "pcj7ddRDTf6tPFpTbnJdd7c9RdKnbcQh7BcbmFcT";
const url = `https://api.nasa.gov/EPIC/api/natural?api_key=${API_KEY}`;

const statusMsg = document.getElementById("status");

statusMsg.textContent = "Loading the latest photo of Earth...";

fetch(url)
  .then(res => res.json())
  .then(photos => {
    console.log(photos); // checking what comes back - it's an array, one object per photo

    const photo = photos[0];

    // the image itself isn't in the json, you build the url from the date + the image name
    // e.g. https://epic.gsfc.nasa.gov/archive/natural/2026/11/09/jpg/epic_1b_20261109005027.jpg
    const day = photo.date.split(" ")[0];
    const [y, m, d] = day.split("-");
    const imgUrl = `https://epic.gsfc.nasa.gov/archive/natural/${y}/${m}/${d}/jpg/${photo.image}.jpg`;

    const img = document.getElementById("earthImg");
    img.src = imgUrl;
    img.alt = "Earth from the DSCOVR satellite";

    document.getElementById("dayTitle").textContent = "Earth on " + day;
    document.getElementById("photoTime").textContent = "Taken at " + photo.date.split(" ")[1] + " UTC";
    document.getElementById("caption").textContent = photo.caption;

    statusMsg.textContent = "";
  })
  .catch(err => {
    console.error(err);
    statusMsg.textContent = "Something went wrong talking to NASA.";
  });
