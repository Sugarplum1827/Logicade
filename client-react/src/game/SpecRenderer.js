window.SpecRenderer = {
  /**
   * Compute a board layout that fits the viewport.
   *
   * - displaySize is clamped to [16, 64] px so tiles stay readable on small
   *   screens and don't get absurd on huge ones.
   * - If the board fits with 40px padding, it is centered and `fits` is
   *   true (callers should NOT enable camera-follow).
   * - Otherwise the board is drawn from (0,0) and callers should let the
   *   camera follow the player.
   */
  computeLayout({ viewportW, viewportH, gridCols, gridRows, tileSize }) {
    const PADDING = 40;
    const availW = Math.max(0, viewportW - PADDING * 2);
    const availH = Math.max(0, viewportH - PADDING * 2);
    const maxByW = Math.floor(availW / Math.max(1, gridCols));
    const maxByH = Math.floor(availH / Math.max(1, gridRows));
    const displaySize = Math.max(16, Math.min(64, maxByW, maxByH));

    const boardW = gridCols * displaySize;
    const boardH = gridRows * displaySize;
    const fits =
      boardW + PADDING * 2 <= viewportW &&
      boardH + PADDING * 2 <= viewportH;

    return {
      scale: displaySize / tileSize,
      displaySize,
      boardW,
      boardH,
      offsetX: fits ? Math.floor((viewportW - boardW) / 2) : 0,
      offsetY: fits ? Math.floor((viewportH - boardH) / 2) : 0,
      fits,
    };
  },

  cellCenter(layout, col, row) {
    return {
      x: layout.offsetX + col * layout.displaySize + layout.displaySize / 2,
      y: layout.offsetY + row * layout.displaySize + layout.displaySize / 2,
    };
  },
};