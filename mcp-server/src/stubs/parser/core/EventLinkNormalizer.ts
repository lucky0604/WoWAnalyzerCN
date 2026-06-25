// Stub: EventLinkNormalizer not needed for MCP runtime (it's a normalizer module, optional)
import type { AnyEvent } from 'parser/core/Events';
import EventsNormalizer from 'parser/core/EventsNormalizer';

export interface EventLink {
  relation: string;
  reverseRelation?: string;
  linkingEventId: number | number[];
  linkingEventType: string | string[];
  linkRelation?: string;
  referencedEventId?: number | number[];
  referencedEventType?: string | string[];
  forwardBufferMs?: number;
  backwardBufferMs?: number;
  anyTarget?: boolean;
  isActive?: (_event: AnyEvent) => boolean;
}

export default class EventLinkNormalizer extends EventsNormalizer {
  static eventLinks: EventLink[] = [];
  normalize(events: AnyEvent[]): AnyEvent[] {
    return events;
  }
}
