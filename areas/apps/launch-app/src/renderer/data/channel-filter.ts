import {
  getChannelStatus,
  type ChannelState,
  type ChannelStatus,
} from './channel-store';

export interface ChannelFilter {
  /** Case-insensitive match against the channel label or signal ID. */
  query: string;
  problemsOnly: boolean;
  /** Signal IDs the operator has hidden. */
  hidden: ReadonlySet<string>;
}

export const EMPTY_FILTER: ChannelFilter = {
  query: '',
  problemsOnly: false,
  hidden: new Set(),
};

/** Anything other than `active` needs an operator's attention. */
export function isProblem(status: ChannelStatus): boolean {
  return status !== 'active';
}

export function filterChannels(
  channels: readonly ChannelState[],
  filter: ChannelFilter,
  nowMs: number,
  staleAfterMs?: number,
): ChannelState[] {
  const query = filter.query.trim().toLowerCase();
  return channels.filter((channel) => {
    const { id, label } = channel.signal;
    if (filter.hidden.has(id)) return false;
    if (
      query &&
      !label.toLowerCase().includes(query) &&
      !id.toLowerCase().includes(query)
    )
      return false;
    return (
      !filter.problemsOnly ||
      isProblem(getChannelStatus(channel, nowMs, staleAfterMs))
    );
  });
}
