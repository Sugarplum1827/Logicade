// Layout helpers for the DSL interpreter (§11).
// Kept separate from GameScene so the geometry math is testable and the
// scene file stays focused on rule evaluation.

window.SpecRenderer = {
    /**
     * Compute tile display size given a target viewport and grid dims.
     * Returns integer scale factor so pixels stay crisp.
     */
    computeLayout({viewportW, viewportH, gridCols, gridRows, tileSize}) {
        const rawScale = Math.min(
            (viewportW * 0.95) / (gridCols * tileSize),
            (viewportH * 0.9) / (gridRows * tileSize),
        );
        const scale = Math.max(1, Math.floor(rawScale));
        const displaySize = tileSize * scale;
        return {
            scale,
            displaySize,
            boardW: gridCols * displaySize,
            boardH: gridRows * displaySize,
            offsetX: Math.floor((viewportW - gridCols * displaySize) / 2),
            offsetY: Math.floor((viewportH - gridRows * displaySize) / 2),
        };
    },

    cellCenter(layout, col, row) {
        return {
            x: layout.offsetX + col * layout.displaySize + layout.displaySize / 2,
            y: layout.offsetY + row * layout.displaySize + layout.displaySize / 2,
        };
    },
};