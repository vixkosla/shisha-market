const SHAMSA_STAR =
  "32,4 36.14,16.55 46,7.75 43.31,20.69 56.25,18 47.45,27.86 60,32 47.45,36.14 56.25,46 43.31,43.31 46,56.25 36.14,47.45 32,60 27.86,47.45 18,56.25 20.69,43.31 7.75,46 16.55,36.14 4,32 16.55,27.86 7.75,18 20.69,20.69 18,7.75 27.86,16.55";

export function Shamsa({ className = "" }: { className?: string }) {
  return (
    <span className={`shamsa ${className}`.trim()} aria-hidden="true">
      <svg className="shamsa-ring" viewBox="0 0 64 64">
        <polygon fill="#29362d" points={SHAMSA_STAR} />
      </svg>
      <span className="shamsa-core">
        <span className="shamsa-ember" />
        <span className="shamsa-dot" />
      </span>
    </span>
  );
}

export function BrandMark({
  size = "header",
}: {
  size?: "header" | "hero" | "book";
}) {
  return (
    <span className={`lockup lockup-${size}`} aria-hidden="true">
      <span className="lockup-van" />
      <span className="lockup-row">
        <span className="lockup-words">
          <span>Shisha</span>
          <span>Market</span>
        </span>
        <Shamsa />
      </span>
      <span className="lockup-stamp">Back</span>
    </span>
  );
}
