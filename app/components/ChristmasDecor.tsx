const BULBS = 18;

/** Purely decorative Christmas trim for the guest check-in screens. */
export default function ChristmasDecor() {
  return (
    <>
      <ul className="xmas-lights" aria-hidden="true">
        {Array.from({ length: BULBS }, (_, i) => <li key={i} />)}
      </ul>
      <p className="xmas-greeting" aria-hidden="true">🎄 Merry Christmas 🎄</p>
    </>
  );
}
