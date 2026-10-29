import { useEffect, useRef } from 'react';

const PROLOGUE_SRC = encodeURI('/assets/LogiCade Prologue Concept and Cinematics · Take 1.mp4');

export default function PrologueVideo({ onComplete }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const startPlayback = async () => {
      try {
        await video.play();
      } catch {
        // Autoplay with sound may be blocked; muted autoplay is allowed by
        // browsers and keeps the prologue from getting stuck on a blank screen.
        video.muted = true;
        try { await video.play(); } catch { /* the video remains full-screen */ }
      }
    };
    const keepPlaying = () => {
      if (!video.ended) void startPlayback();
    };
    const preventContextMenu = (event) => event.preventDefault();
    const preventPauseKeys = (event) => {
      if (event.code === 'Space' || event.key === 'MediaPlayPause') event.preventDefault();
    };

    void startPlayback();
    video.addEventListener('pause', keepPlaying);
    video.addEventListener('contextmenu', preventContextMenu);
    window.addEventListener('keydown', preventPauseKeys, true);
    return () => {
      video.removeEventListener('pause', keepPlaying);
      video.removeEventListener('contextmenu', preventContextMenu);
      window.removeEventListener('keydown', preventPauseKeys, true);
    };
  }, []);

  return (
    <main className="prologue-screen">
      <video
        ref={videoRef}
        className="prologue-video"
        src={PROLOGUE_SRC}
        autoPlay
        playsInline
        preload="auto"
        disablePictureInPicture
        controlsList="nodownload noplaybackrate noremoteplayback"
        aria-label="LogiCade prologue cinematic"
        onEnded={onComplete}
      />
    </main>
  );
}
