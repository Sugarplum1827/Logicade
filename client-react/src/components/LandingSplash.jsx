import { useEffect, useState } from 'react';

const SPLASH_DURATION_MS = 5000;

export default function LandingSplash({ onComplete }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const next = Math.min(100, ((performance.now() - startedAt) / SPLASH_DURATION_MS) * 100);
      setProgress(next);
      if (next >= 100) {
        window.clearInterval(timer);
        onComplete();
      }
    }, 40);

    return () => window.clearInterval(timer);
  }, [onComplete]);

  return (
    <main className="landing-splash" aria-label="Loading LogiCade">
      <img className="landing-splash-background" src="/assets/landing_bg.jpg" alt="" />
      <div className="landing-splash-shade" />
      <section className="landing-splash-content" aria-live="polite">
        <p className="landing-splash-eyebrow">LOGICADE</p>
        <h1>Preparing your adventure</h1>
        <div
          className="landing-splash-progress"
          role="progressbar"
          aria-label="Loading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.floor(progress)}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="landing-splash-status">Loading… {Math.floor(progress)}%</p>
      </section>
    </main>
  );
}
