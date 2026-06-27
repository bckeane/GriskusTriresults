export default function FunStats({ results, estimatedMiles, totalHours }) {
  if (!results || results.length === 0) return null;

  const hoursDisplay = Number.isFinite(totalHours) && totalHours > 0
    ? totalHours.toFixed(1).replace(/\.0$/, '')
    : null;
  const milesDisplay = estimatedMiles > 0 ? Math.round(estimatedMiles).toLocaleString() : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      <h3 className="font-display text-base font-semibold text-brand-900 tracking-tight uppercase mb-2">
        Your Griskus Story
      </h3>
      <p className="text-sm text-slate-600 leading-relaxed">
        {hoursDisplay && milesDisplay ? (
          <>
            You've spent <span className="font-semibold text-brand-900">{hoursDisplay} hours</span> racing
            Griskus across{' '}
            <span className="font-semibold text-brand-900">{results.length} event{results.length !== 1 ? 's' : ''}</span> — an
            estimated <span className="font-semibold text-brand-900">~{milesDisplay} miles</span> covered.*
          </>
        ) : (
          <>
            You've raced Griskus <span className="font-semibold text-brand-900">{results.length} time{results.length !== 1 ? 's' : ''}</span>.
          </>
        )}
      </p>
      {(hoursDisplay || milesDisplay) && (
        <p className="mt-2 text-[10px] text-slate-400">
          *Distances estimated: Olympic ~32 mi, Sprint ~16 mi, Duathlon ~31 mi. Racing time only.
        </p>
      )}
    </div>
  );
}
