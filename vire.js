const phrases = [
    "Tämä hetki on juuri sellainen kuin sen kuuluu olla.",
    "Vireystilani vaihtelee — se on inhimillistä, ei virhe.",
    "Voin olla tässä tilassa. Sekin menee ohi.",
    "Keho tekee parhaansa. Sinä riität.",
    "Kehon ei tarvitse olla optimaalisessa tilassa ollakseni arvokas.",
    "Tämä tila on väliaikainen. Olen turvassa.",
    "Saan levätä ilman syyllisyyttä.",
    "Myötätunto itseä kohtaan ei vaadi täydellisyyttä.",
    "Tunteeni ovat viestejä, eivät käskyjä.",
    "Juuri nyt riittää, että olen olemassa.",
    "Voin ottaa askeleen taaksepäin ilman, että se on epäonnistuminen.",
    "Kehoni tietää jotain. Kuuntelen sitä.",
    "Tässäkin tilassa on jotain viisautta.",
    "Armollisuus itseä kohtaan on harjoitus, ei ominaisuus.",
];

let pendingZone = null;
let currentDate = todayKey();
let allData = {};
let showLabels = false;

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}
function dateFromKey(k) {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(y, m - 1, d);
}
function keyFromDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}
function fmtDate(k) {
    return dateFromKey(k).toLocaleDateString("fi-FI", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function loadData() {
    try {
        const raw = localStorage.getItem("vireystila_all");
        if (raw) allData = JSON.parse(raw);
    } catch (e) {
        allData = {};
    }
}
function saveData() {
    try {
        localStorage.setItem("vireystila_all", JSON.stringify(allData));
        flash("Tallennettu ✓");
    } catch (e) {
        flash("Tallennus epäonnistui");
    }
}
function flash(msg) {
    const el = document.getElementById("saveStatus");
    el.textContent = msg;
    setTimeout(() => {
        el.textContent = "";
    }, 2000);
}

function getEntries() {
    return allData[currentDate] || [];
}
function setEntries(arr) {
    allData[currentDate] = arr;
}

function newPhrase() {
    const el = document.getElementById("phrase");
    const cur = el.textContent;
    let next;
    do {
        next = phrases[Math.floor(Math.random() * phrases.length)];
    } while (next === cur && phrases.length > 1);
    el.textContent = next;
}

function render() {
    document.getElementById("dateLabel").textContent = fmtDate(currentDate);
    const today = todayKey();
    const btnNext = document.getElementById("btnNext");
    btnNext.style.opacity = currentDate >= today ? "0.3" : "1";
    btnNext.disabled = currentDate >= today;
    renderDots();
    renderHistory();
}

function changeDay(dir) {
    const d = dateFromKey(currentDate);
    d.setDate(d.getDate() + dir);
    const newKey = keyFromDate(d);
    if (newKey > todayKey()) return;
    currentDate = newKey;
    render();
    cancelAdd();
}

function goToday() {
    currentDate = todayKey();
    render();
    cancelAdd();
}

function renderHistory() {
    const keys = Object.keys(allData)
        .filter((k) => allData[k] && allData[k].length > 0)
        .sort()
        .slice(-14);
    const container = document.getElementById("historyDots");
    container.innerHTML = "";
    keys.forEach((k) => {
        const zones = allData[k].map((e) => e.zone);
        const color = zones.includes("yli")
            ? "#E24B4A"
            : zones.includes("ali")
                ? "#378ADD"
                : "#639922";
        const dot = document.createElement("button");
        dot.className = "hist-dot" + (k === currentDate ? " active" : "");
        dot.style.background = color;
        dot.title = fmtDate(k);
        dot.onclick = () => {
            currentDate = k;
            render();
            cancelAdd();
        };
        container.appendChild(dot);
    });
}

function zoneClick(e, zone) {
    const chartRect = document
        .getElementById("chartArea")
        .getBoundingClientRect();
    const xPct = (e.clientX - chartRect.left) / chartRect.width;
    const hour = 6 + xPct * 16;
    const h = Math.floor(hour);
    const m = Math.round(((hour - h) * 60) / 15) * 15;
    document.getElementById("inputTime").value =
        `${String(h).padStart(2, "0")}:${String(m >= 60 ? 59 : m).padStart(2, "0")}`;
    document.getElementById("inputReason").value = "";
    pendingZone = zone;
    document.getElementById("addPanel").classList.add("open");
    setTimeout(() => document.getElementById("inputReason").focus(), 50);
}

function saveEntry() {
    const time = document.getElementById("inputTime").value.trim();
    const reason = document.getElementById("inputReason").value.trim();
    if (!time) return;
    const entries = getEntries();
    entries.push({ zone: pendingZone, time, reason });
    entries.sort((a, b) => a.time.localeCompare(b.time));
    setEntries(entries);
    saveData();
    renderDots();
    renderHistory();
    document.getElementById("addPanel").classList.remove("open");
}

function cancelAdd() {
    document.getElementById("addPanel").classList.remove("open");
}

function toggleLabels() {
    showLabels = !showLabels;
    const btn = document.getElementById("btnLabels");
    btn.style.background = showLabels ? "var(--bg-secondary)" : "";
    btn.style.outline = showLabels ? "1.5px solid var(--border-med)" : "";
    renderDots();
}

function clearDay() {
    if (getEntries().length === 0) return;
    if (!confirm("Poistetaanko tämän päivän kaikki merkinnät?")) return;
    delete allData[currentDate];
    saveData();
    renderDots();
    renderHistory();
}

function timeToXpct(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return ((h + m / 60 - 6) / 16) * 100;
}

function renderDots() {
    const layer = document.getElementById("dotsLayer");
    layer.innerHTML = "";
    const entries = getEntries();
    const chartArea = document.getElementById("chartArea");
    const totalH = chartArea.offsetHeight || 240;
    const zoneH = totalH / 3;
    entries.forEach((entry, i) => {
        const xPct = Math.min(98, Math.max(2, timeToXpct(entry.time)));
        const zoneIndex = { yli: 0, opti: 1, ali: 2 }[entry.zone];
        const yPct = (((zoneIndex + 0.5) * zoneH) / totalH) * 100;
        const dot = document.createElement("div");
        dot.className = `dot dot-${entry.zone}`;
        dot.style.left = `${xPct}%`;
        dot.style.top = `${yPct}%`;
        dot.textContent = "X";
        if (showLabels) {
            const label = document.createElement("span");
            label.className = "dot-label";
            label.textContent = entry.reason || entry.time;
            dot.appendChild(label);
        }
        dot.addEventListener("mouseenter", (e) => showTip(e, entry));
        dot.addEventListener("mouseleave", hideTip);
        dot.addEventListener("dblclick", () => {
            removeEntry(i);
        });
        dot.addEventListener("click", (e) => e.stopPropagation());
        layer.appendChild(dot);
    });
}

function removeEntry(i) {
    const entries = getEntries();
    entries.splice(i, 1);
    setEntries(entries);
    saveData();
    hideTip();
    renderDots();
    renderHistory();
}

const tooltip = document.getElementById("tooltip");
function showTip(e, entry) {
    tooltip.style.display = "block";
    tooltip.innerHTML = `<strong>${entry.time}</strong>${entry.reason ? "<br>" + entry.reason : ""}`;
    positionTip(e);
}
function positionTip(e) {
    tooltip.style.left = e.clientX + 14 + "px";
    tooltip.style.top = e.clientY - 10 + "px";
}
function hideTip() {
    tooltip.style.display = "none";
}

document
    .getElementById("chartArea")
    .addEventListener("mousemove", (e) => {
        if (e.target.closest(".dot")) positionTip(e);
    });

// Init
loadData();
newPhrase();
render();