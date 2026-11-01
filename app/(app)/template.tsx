/** Re-mounted on every page change: each new page slides in instead of popping. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
