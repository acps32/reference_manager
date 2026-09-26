// Harnais de charge du frontend.
//
// Rejoue tous les scripts de frontend/index.html dans leur ordre réel, avec un DOM bouchonné,
// puis appelle les fonctions de chargement contre le vrai backend. Il attrape ce que `node --check`
// ne voit pas : erreurs d'ordre de chargement (TDZ), déclarations en double, globales manquantes.
//
// Usage :   backend lancé, puis depuis backend/ : python seed.py 300
//           node tools/load-harness.js
//
// Sans jeu de test, il vérifie seulement que le board vide ne casse rien.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const FRONTEND = path.join(__dirname, "..", "frontend");
const API = "http://127.0.0.1:8000";

// ===== DOM bouchonné =====

const ctx2d = new Proxy(
    { canvas: { width: 1920, height: 1080 }, measureText: () => ({ width: 10 }) },
    { get: (target, key) => (key in target ? target[key] : () => {}) }
);

function fakeElement(id) {
    return {
        id, dataset: {}, style: {}, textContent: "", innerHTML: "", value: "", checked: false,
        width: 1920, height: 1080,
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
        focus() {}, click() {}, closest: () => null,
        querySelector: () => null, querySelectorAll: () => [],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 1920, height: 1080 }),
        getContext: () => ctx2d,
    };
}

class ImageStub {
    constructor() { this.width = 200; this.height = 200; }
    set src(value) { this._src = value; setTimeout(() => this.onload && this.onload(), 0); }
    get src() { return this._src; }
}

let requestCount = 0;

const sandbox = {
    console, setTimeout, clearTimeout, Promise, Map, Set, Math, JSON, Date,
    Number, String, Object, Array, Error,
    Image: ImageStub,
    fetch: (...args) => { requestCount++; return fetch(...args); },
    FormData: class { append() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    getComputedStyle: () => ({ getPropertyValue: () => "#000000" }),
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    devicePixelRatio: 1,
    document: {
        getElementById: fakeElement,
        querySelector: () => fakeElement("q"),
        querySelectorAll: () => [],
        addEventListener() {},
        createElement: fakeElement,
        documentElement: fakeElement("html"),
        body: fakeElement("body"),
    },
};
sandbox.window = sandbox;
sandbox.window.innerWidth = 1920;
sandbox.window.innerHeight = 1080;
sandbox.window.addEventListener = () => {};
sandbox.window.matchMedia = () => ({ matches: false, addEventListener() {} });
vm.createContext(sandbox);

// ===== Chargement dans l'ordre réel d'index.html =====

const html = fs.readFileSync(path.join(FRONTEND, "index.html"), "utf8");
const order = [...html.matchAll(/<script defer src="([^"]+)"><\/script>/g)].map((m) => m[1]);
console.log("Scripts :", order.map((f) => path.basename(f)).join(" -> "), "\n");

try {
    vm.runInContext(order.map((f) => fs.readFileSync(path.join(FRONTEND, f), "utf8")).join("\n;\n"), sandbox);
    console.log("Chargement : OK (aucune TDZ, aucune declaration en double)\n");
} catch (error) {
    console.error("ECHEC au chargement :", error.message);
    process.exit(1);
}

// Les declarations `let` vivent dans la portee lexicale du contexte, pas sur l'objet sandbox :
// on les lit en evaluant une expression dans ce meme contexte.
const evalIn = (expr) => vm.runInContext(expr, sandbox);
const check = (label, value, expected) =>
    console.log(`${label.padEnd(38)}: ${value}${expected ? `   ${expected}` : ""}`);

(async () => {
    if (!(await fetch(`${API}/elements/summary`).then((r) => r.ok).catch(() => false))) {
        console.error(`Backend injoignable sur ${API}. Lancer uvicorn d'abord.`);
        process.exit(1);
    }

    console.log("--- chargement par vue ---");
    await evalIn("loadViewport()");
    const total = evalIn("boardSummary.count");
    const first = evalIn("loadedElements.length");
    check("Total en base", total);
    check("Charges au 1er appel", first, total > first ? "(et non le total)" : "");

    await evalIn("loadViewport()");
    check("Charges au 2e appel, sans bouger", evalIn("loadedElements.length"), "(doit etre identique)");

    if (total === 0) {
        console.log("\nBase vide : verification du board vide uniquement.");
        evalIn("zoomToFit(); updateStatusBar(); render();");
        check("zoomToFit/render sans planter", "OK");
        process.exit(0);
    }

    // Petit deplacement : a l'interieur de la marge de conservation, rien ne doit etre libere.
    evalIn("globalThis.__first = loadedElements[0]; offsetX = -500; offsetY = -500;");
    await evalIn("loadViewport()");
    check("Apres un petit deplacement", evalIn("loadedElements.length"), `(avant : ${first})`);
    check("Le 1er objet est conserve", evalIn("loadedElements.includes(globalThis.__first)"), "(references preservees)");
    check("Son image decodee est gardee",
        evalIn("globalThis.__first.image === loadedElements.find(e => e.id === globalThis.__first.id).image"));

    console.log("\n--- limitation de frequence ---");
    const before = requestCount;
    for (let i = 0; i < 300; i++) {
        evalIn(`offsetX = ${-500 - i}; offsetY = -500;`);
        evalIn("scheduleViewportLoad()");
    }
    check("Requetes apres 300 mousemove", requestCount - before, "(doit etre 0)");
    await new Promise((r) => setTimeout(r, 500));
    check("Requetes 500 ms plus tard", requestCount - before, "(elements + agregat, au lieu de 300)");

    console.log("\n--- dechargement ---");
    evalIn("offsetX = 0; offsetY = 0; selectedElements = new Set(); loadedElements = [];");
    await evalIn("loadViewport()");
    const atOrigin = evalIn("loadedElements.length");
    check("Retour a l'origine", atOrigin);

    // __pinned est protege par la selection, __doomed ne l'est pas : il doit etre libere.
    evalIn("globalThis.__pinned = loadedElements[0];");
    evalIn("globalThis.__doomed = loadedElements.find(e => e.image && e !== loadedElements[0]);");
    evalIn("selectedElements = new Set([globalThis.__pinned]); offsetX = -20000; offsetY = -20000;");
    await evalIn("loadViewport()");
    check("Apres un saut de 20000 px", evalIn("loadedElements.length"), `(et non ${atOrigin} + les nouveaux)`);
    check("L'element selectionne survit", evalIn("loadedElements.includes(globalThis.__pinned)"));
    check("Un element non protege est libere", evalIn("!loadedElements.includes(globalThis.__doomed)"));
    check("Son image est liberee", evalIn("globalThis.__doomed.image.src === ''"));

    console.log("\n--- cadrage et compteur ---");
    evalIn("offsetX = 0; offsetY = 0; selectedElements = new Set(); zoomToFit();");
    const view = evalIn("inflatedViewport(0)");
    const box = evalIn("boardSummary");
    check("Apres zoomToFit, la vue couvre tout",
        view.x <= box.min_x && view.y <= box.min_y
        && view.x + view.width >= box.max_x && view.y + view.height >= box.max_y);
    await evalIn("loadViewport()"); // recharge sur le nouveau cadrage, sinon le compteur est trompeur
    evalIn("updateStatusBar()");
    check("Barre d'etat", JSON.stringify(evalIn("statusElementsField.textContent")));

    console.log("\n--- rendu coalesce ---");
    evalIn("globalThis.__renders = 0; globalThis.render = () => { globalThis.__renders++; };");
    for (let i = 0; i < 100; i++) evalIn("requestRender()");
    check("Rendus apres 100 requestRender", evalIn("globalThis.__renders"), "(doit etre 0)");
    await new Promise((r) => setTimeout(r, 50));
    check("Rendus une frame plus tard", evalIn("globalThis.__renders"), "(doit etre 1)");

    process.exit(0);
})();
