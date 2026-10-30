// Re-monté à chaque navigation : chaque page entre en fondu glissé.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="mg-page">{children}</div>;
}
