
import { NullSourceDescriptor, SourceDescriptor } from "./sourceDescriptor.ts";
import { timestamp } from '../types.ts';
import { nanoid } from "../legacy/nanoid.ts";

export type Metadata = Record<string, unknown>;

export type UUID = string;

export interface LedgObject {
  readonly id: UUID;
  readonly date: timestamp,
  readonly date2: timestamp,
  readonly source: SourceDescriptor;
  readonly metadata: Metadata;
}

export abstract class LedgObjectBuilder<T extends LedgObject> {
  protected id?: UUID;
  protected source: SourceDescriptor = NullSourceDescriptor.INSTANCE;
  protected metadata: Metadata = {};
  protected date?: timestamp;
  protected date2?: timestamp;

  withId(id: UUID): this {
    this.id = id;
    return this;
  }

  genId(): this {
    this.id = nanoid(8);
    return this;
  }

  withSource(source: SourceDescriptor): this {
    this.source = source;
    return this;
  }

  withMetadata(metadata: Metadata): this {
    this.metadata = metadata;
    return this;
  }

  withDate(date: timestamp): this {
    this.date = date;
    return this;
  }

  withDate2(date2: timestamp): this {
    this.date2 = date2;
    return this;
  }

  isBuildable(): boolean {
    return (
      this.id != null &&
      this.date != null &&
      this.date2 != null &&
      this.source != null &&
      this.metadata != null);
  }

  abstract build(): T;
}