import type { ChannelFilter } from '../data/channel-filter';

interface ChannelFiltersProps {
  filter: ChannelFilter;
  onChange: (filter: ChannelFilter) => void;
}

export function ChannelFilters({ filter, onChange }: ChannelFiltersProps) {
  return (
    <div className="channel-filters">
      <input
        type="search"
        aria-label="Search channels"
        placeholder="Search channels"
        value={filter.query}
        onChange={(event) => onChange({ ...filter, query: event.target.value })}
      />
      <label>
        <input
          type="checkbox"
          checked={filter.problemsOnly}
          onChange={(event) =>
            onChange({ ...filter, problemsOnly: event.target.checked })
          }
        />
        Show only problems
      </label>
      {filter.hidden.size > 0 && (
        <button
          type="button"
          onClick={() => onChange({ ...filter, hidden: new Set() })}
        >
          Show {filter.hidden.size} hidden
        </button>
      )}
    </div>
  );
}
