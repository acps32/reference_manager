// ===== Mise en page du texte =====
//
// Le canvas ne sait pas revenir à la ligne tout seul : il faut mesurer mot à
// mot avec ctx.measureText et construire soi-même les lignes qui tiennent
// dans la largeur du cadre. Isolé ici parce que c'est la seule logique
// vraiment calculatoire du dessin, et pour ne pas allonger canvas.js.

// Lit --ui-font (style.css) plutôt qu'une pile dupliquée ici : un changement
// de police dans le thème doit aussi s'appliquer au texte dessiné sur le
// canevas, pas seulement à l'interface autour.
const TEXT_FONT_STACK = getComputedStyle(document.documentElement).getPropertyValue("--ui-font").trim();
const TEXT_LINE_HEIGHT_RATIO = 1.3; // interligne, proportion de la taille de police

function textFont(fontSize) {
    return `${fontSize}px ${TEXT_FONT_STACK}`;
}

function textLineHeight(fontSize) {
    return fontSize * TEXT_LINE_HEIGHT_RATIO;
}

// Découpe `contenu` en lignes tenant dans maxWidth. Respecte les retours à la
// ligne saisis par l'utilisateur, et coupe entre les mots au-delà.
// `ctx` doit déjà avoir la bonne police active (voir textFont).
function wrapText(ctx, contenu, maxWidth) {
    const lines = [];

    for (const paragraph of contenu.split("\n")) {
        const words = paragraph.split(/\s+/).filter((word) => word !== "");
        if (words.length === 0) {
            lines.push(""); // ligne vide volontaire
            continue;
        }

        let current = words[0];
        for (const word of words.slice(1)) {
            const candidate = `${current} ${word}`;
            if (ctx.measureText(candidate).width <= maxWidth) {
                current = candidate;
            } else {
                lines.push(current);
                current = word; // un mot plus long que le cadre débordera, on ne le coupe pas
            }
        }
        lines.push(current);
    }

    return lines;
}

// Hauteur nécessaire pour afficher ces lignes : sert à ajuster le cadre du
// texte à son contenu après une édition.
function textBlockHeight(lineCount, fontSize) {
    return Math.max(1, lineCount) * textLineHeight(fontSize);
}
