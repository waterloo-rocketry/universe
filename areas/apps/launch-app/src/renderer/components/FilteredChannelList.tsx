import { useState } from 'react';
import type { ChannelState } from '../data/channel-store';
import { filterChannels, type ChannelFilter } from '../data/channel-filter';
import { ChannelFilters } from './ChannelFilters';
import { ChannelList } from './ChannelList';

interface FilteredChannelListProps {
  channels: readonly ChannelState[];
  nowMs: number;
  /** Starting filter values; read once when the widget first appears. */
  problemsOnly?: boolean;
  hidden?: readonly string[];
}

/** Channel list widget with its own search, problem filter, and hidden channels. */
export function FilteredChannelList({
  channels,
  nowMs,
  problemsOnly = false,
  hidden = [],
}: FilteredChannelListProps) {
  const [filter, setFilter] = useState<ChannelFilter>(() => ({
    query: '',
    problemsOnly,
    hidden: new Set(hidden),
  }));

  return (
    <>
      <ChannelFilters filter={filter} onChange={setFilter} />
      <ChannelList
        channels={filterChannels(channels, filter, nowMs)}
        nowMs={nowMs}
        emptyMessage="No channels match the filters"
        onHide={(signalId) =>
          setFilter((current) => ({
            ...current,
            hidden: new Set(current.hidden).add(signalId),
          }))
        }
      />
    </>
  );
}
