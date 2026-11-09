import { useEffect, useRef, useState } from 'react';

export default function OracleDialogue({ step, title, text, onNext }) {
  const [typing, setTyping] = useState({ text: null, shown: 0 });
  const shown = typing.text === text ? typing.shown : 0;
  const [voiceBlocked, setVoiceBlocked] = useState(false);
  const audioRef = useRef(null);
  const dialogueRef = useRef(null);

  const playVoice = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().then(() => setVoiceBlocked(false)).catch(() => setVoiceBlocked(true));
  };

  useEffect(() => {
    playVoice();
    dialogueRef.current.focus();
  }, [step]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTyping((current) => {
        const shown = current.text === text ? current.shown : 0;
        if (shown >= text.length) {
          window.clearInterval(timer);
          return current.text === text ? current : { text, shown: text.length };
        }
        return { text, shown: Math.min(text.length, shown + 1) };
      });
    }, 24);
    return () => window.clearInterval(timer);
  }, [text]);

  const clickToContinue = () => {
    // Clicking while text is typing skips it and advances; clicking after the
    // line finishes closes this dialogue and advances to the next one.
    if (voiceBlocked) playVoice();
    onNext();
  };

  return (
    <div className="oracle-dialogue-shade" onClick={(event) => {
      if (event.target === event.currentTarget) clickToContinue();
    }}>
      <audio ref={audioRef} src="/assets/oracles_voice.mp3" preload="auto" />
      <section
        className="oracle-dialogue realm-paper"
        ref={dialogueRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="oracle-dialogue-speaker"
        aria-describedby="oracle-dialogue-title"
        tabIndex={0}
        onClick={clickToContinue}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            clickToContinue();
          }
        }}
      >
        <img className="oracle-dialogue-character" src="/assets/oracle/oracle_frame_01.png" alt="Oracle" />
        <div className="oracle-dialogue-copy">
          <p id="oracle-dialogue-speaker" className="oracle-dialogue-speaker realm-plaque"><strong>Oracle</strong><span>{title}</span></p>
          <h2 id="oracle-dialogue-title" className="oracle-dialogue-text">
            {text.slice(0, shown)}{shown < text.length && <span className="oracle-dialogue-caret" aria-hidden="true">▌</span>}
          </h2>
          <div className="oracle-dialogue-footer">
            <small className="oracle-dialogue-caption">Click anywhere to {shown < text.length ? 'skip' : step === 5 ? 'close' : 'continue'} <span aria-hidden="true">▸</span></small>
          </div>
        </div>
      </section>
    </div>
  );
}
