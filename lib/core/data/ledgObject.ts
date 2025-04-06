
import { SourceDescriptor } from "./sourceDescriptor.ts";
import { timestamp } from '../types.ts';

export type Metadata = Record<string, unknown>;

export type UUID = string;

export interface LedgObject {
  id: UUID;
  date: timestamp,
  date2: timestamp,
  source: SourceDescriptor;
  metadata: Metadata;
}