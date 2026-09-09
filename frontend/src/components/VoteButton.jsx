export default function VoteButton({ selected, disabled, onClick, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
        selected
          ? "border-zvote-600 bg-zvote-50 ring-2 ring-zvote-500"
          : "border-slate-200 bg-white hover:border-zvote-300"
      } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {children}
    </button>
  );
}
