/** Speech bubble with a smile: friendlier than a plain chat icon. */
export default function ChatFace({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M12 3.2c-4.97 0-9 3.47-9 7.75 0 2.3 1.17 4.37 3.03 5.79l-.78 3.33a.6.6 0 0 0 .88.66l3.6-2.06c.73.15 1.49.23 2.27.23 4.97 0 9-3.47 9-7.75S16.97 3.2 12 3.2Z"
        fill="currentColor"
      />
      <circle cx="8.9" cy="9.9" r="1.15" style={{ fill: "var(--chat)" }} />
      <circle cx="15.1" cy="9.9" r="1.15" style={{ fill: "var(--chat)" }} />
      <path d="M8.6 12.6c.85 1.15 2.03 1.75 3.4 1.75s2.55-.6 3.4-1.75" style={{ stroke: "var(--chat)" }} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
