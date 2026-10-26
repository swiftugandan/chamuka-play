/** What the child said, as a chat bubble on the right. */
export function ChildBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-grape px-3.5 py-2 text-[15px] font-bold text-white shadow-[0_3px_0_var(--color-grape-dark)]">
        <span className="mr-1.5" aria-hidden="true">
          🧒
        </span>
        {children}
      </div>
    </div>
  );
}
