interface PlaceholderPageProps {
  title: string;
  phase: string;
}

export function PlaceholderPage({ title, phase }: PlaceholderPageProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      <p className="mt-4 rounded-lg border border-dashed border-charcoal-700 bg-charcoal-900 p-8 text-center text-gray-400">
        Coming in {phase}
      </p>
    </div>
  );
}
