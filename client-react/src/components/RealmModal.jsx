import { useEffect, useId, useRef } from 'react';

export default function RealmModal({ title, children, onDismiss, className = '', lead }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`realm-dialog realm-paper ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss?.();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss?.();
      }}
    >
      <div className="realm-dialog-body">
        {lead}
        <h2 id={titleId} className="realm-heading">{title}</h2>
        <div className="realm-divider" aria-hidden="true" />
        {children}
      </div>
    </dialog>
  );
}
