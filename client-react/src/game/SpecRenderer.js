window.SpecRenderer = {
    computeLayout({ viewportW, viewportH, gridCols, gridRows, tileSize }) {
        // Force a fixed tile size to allow scrolling
        const displaySize = 64; 
        
        const boardW = gridCols * displaySize;
        const boardH = gridRows * displaySize;
        
        return {
            scale: displaySize / tileSize,
            displaySize,
            boardW,
            boardH,
            offsetX: 0, 
            offsetY: 0,
        };
    },

    cellCenter(layout, col, row) {
        return {
            x: layout.offsetX + col * layout.displaySize + layout.displaySize / 2,
            y: layout.offsetY + row * layout.displaySize + layout.displaySize / 2,
        };
    },
};