export default function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-center mb-12 text-3xl md:text-4xl font-bold">
      {children}
    </h1>
  );
}
