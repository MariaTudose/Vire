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
    "Kehosi tietää jotain. Kuuntele sitä.",
    "Tässäkin tilassa on jotain viisautta.",
    "Armollisuus itseä kohtaan ei synny kerralla — se kasvaa pienistä hetkistä.",
    "Myrskytkin laantuu. Siihen asti saat olla tuulen liikuttama.",
    "Lepotila on osa seikkailua, ei sen vastakohta.",
    "Synkimmässäkin metsässä polku jatkuu.",
    "Viisaat eivät ryntää eteenpäin — he kuuntelevat ensin.",
];

let pendingZone = null;
let pendingY = null;
let currentDate = todayKey();
let allData = {};
let showLabels = true;

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
        weekday: "short",
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

function dominantZone(entries) {
    const sorted = [...entries].sort((a, b) => a.time.localeCompare(b.time));
    const times = { yli: 0, opti: 0, ali: 0 };

    const positions = sorted.map((entry) => {
        const xPct = Math.min(98, Math.max(2, timeToXpct(entry.time)));
        const zoneIndex = { yli: 0, opti: 1, ali: 2 }[entry.zone];
        const yPct = entry.yPct != null ? entry.yPct : (zoneIndex + 0.5) * 33.333;
        return { xPct, yPct };
    });

    if (positions.length === 1) {
        times[sorted[0].zone] = 1;
    } else {
        for (let i = 0; i < positions.length - 1; i++) {
            const { xPct: x1, yPct: y1 } = positions[i];
            const { xPct: x2, yPct: y2 } = positions[i + 1];
            const dy = y2 - y1;
            const ts = [0, 1];
            if (dy !== 0) {
                for (const bound of [33.333, 66.667]) {
                    const t = (bound - y1) / dy;
                    if (t > 0 && t < 1) ts.push(t);
                }
            }
            ts.sort((a, b) => a - b);
            for (let j = 0; j < ts.length - 1; j++) {
                const tMid = (ts[j] + ts[j + 1]) / 2;
                const yMid = y1 + tMid * dy;
                const xSpan = Math.abs((ts[j + 1] - ts[j]) * (x2 - x1));
                const zone = yMid < 33.333 ? "yli" : yMid < 66.667 ? "opti" : "ali";
                times[zone] += xSpan;
            }
        }
    }

    return Object.entries(times).sort((a, b) => b[1] - a[1])[0][0];
}

function renderHistory() {
    const keys = Object.keys(allData)
        .filter((k) => allData[k] && allData[k].length > 0)
        .sort()
        .slice(-14);
    const container = document.getElementById("historyDots");
    container.innerHTML = "";
    keys.forEach((k) => {
        const dominant = dominantZone(allData[k]);
        const color = dominant === "yli" ? "#E24B4A" : dominant === "ali" ? "#378ADD" : "#639922";
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
    pendingY = ((e.clientY - chartRect.top) / chartRect.height) * 100;
    document.getElementById("addPanel").classList.add("open");
    setTimeout(() => document.getElementById("inputReason").focus(), 50);
}

function saveEntry() {
    const time = document.getElementById("inputTime").value.trim();
    const reason = document.getElementById("inputReason").value.trim();
    if (!time) return;
    const entries = getEntries();
    entries.push({ zone: pendingZone, time, reason, yPct: pendingY });
    entries.sort((a, b) => a.time.localeCompare(b.time));
    setEntries(entries);
    saveData();
    renderDots();
    renderHistory();
    document.getElementById("addPanel").classList.remove("open");
    newPhrase();
    document.getElementById("phraseBox").style.display = "flex";
}

function cancelAdd() {
    document.getElementById("addPanel").classList.remove("open");
    document.getElementById("phraseBox").style.display = "none";
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
    if (!entries.length) return;
    const chartArea = document.getElementById("chartArea");
    const totalH = chartArea.offsetHeight || 240;
    const zoneH = totalH / 3;

    const positions = entries.map((entry) => {
        const xPct = Math.min(98, Math.max(2, timeToXpct(entry.time)));
        const zoneIndex = { yli: 0, opti: 1, ali: 2 }[entry.zone];
        const yPct = entry.yPct != null
            ? entry.yPct
            : (((zoneIndex + 0.5) * zoneH) / totalH) * 100;
        return { xPct, yPct };
    });

    if (positions.length > 1) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible";
        positions.forEach((pos, i) => {
            if (i === 0) return;
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", `${positions[i - 1].xPct}%`);
            line.setAttribute("y1", `${positions[i - 1].yPct}%`);
            line.setAttribute("x2", `${pos.xPct}%`);
            line.setAttribute("y2", `${pos.yPct}%`);
            line.setAttribute("stroke", "rgba(0,0,0,0.18)");
            line.setAttribute("stroke-width", "1.5");
            svg.appendChild(line);
        });
        layer.appendChild(svg);
    }

    entries.forEach((entry, i) => {
        const { xPct, yPct } = positions[i];
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
        dot.addEventListener("dblclick", () => removeEntry(i));
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