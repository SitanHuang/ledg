
import { NullSourceDescriptor, SourceDescriptor } from "./sourceDescriptor.ts";
import { Maybe, Ok, Result, timestamp } from '../types.ts';
import { nanoid } from "../legacy/nanoid.ts";
import { CommitRegistry } from "./commitRegistry.ts";

export interface Metadata {
  [index: string]: unknown;
  virt?: boolean;
  pending?: boolean;
  event?: string;
  tags?:string;
}

export type MetadataReservedKey = 'virt' | 'pending' | 'event' | 'tags';

/**
 * Validates whether a key/val pair can be put into Metadata. Returns an error message or null.
 */
export function validateMetadataKeyValPair(key: string, val: unknown): string | null {
  if (key.length == 0)
    return "Metadata field name cannot be empty.";

  const firstChar = key.charCodeAt(0);
  if (firstChar >= 48 && firstChar <= 57)
    return "Metadata field name cannot start with a digit.";
  if (firstChar === 61)
    return "Metadata field name cannot start with equal sign.";
  if (firstChar === 33)
    return "Metadata field name cannot start with exclamation mark.";

  switch (key) {
    case "virt":
      if (typeof val !== 'boolean')
        return "The field `virt` must be of boolean type.";
      break;
    case "pending":
      if (typeof val !== 'boolean')
        return "The field `pending` must be of boolean type.";
      break;
    case "event":
      if (typeof val !== 'string')
        return "The field `event` must be of string type.";
      break;
    case "tags":
      if (typeof val !== 'string')
        return "The field `tags` must be of string type.";
      break;
    case "description":
    case "id":
      return "The field `" + key + "` is not allowed.";
  }
  return null;
}

export type UUID = string;

export interface LedgObject {
  readonly id: UUID;
  readonly date: timestamp;
  readonly date2: timestamp;
  readonly description: string;
  readonly source: SourceDescriptor;
  readonly metadata: Metadata;
}

export abstract class LedgObjectBuilder<T extends LedgObject> {
  public id?: UUID;
  public source: SourceDescriptor = NullSourceDescriptor.INSTANCE;
  public date?: timestamp;
  public date2?: timestamp;
  public description = "";
  public metadata: Metadata = {};

  protected result?: T;
  protected modificationMessage?: string[];

  /**
   * Flag indicating if the object has modifications (to be registered with
   * CommitRegistry).
   */
  protected isModified = false;

  /**
   * Adds a modification message and marks the object as modified.
   *
   * @param message - A string description of the modification.
   * @returns The builder instance.
   */
  setModified(message: string): this {
    this.isModified = true;

    this.modificationMessage ??= [];

    this.modificationMessage.push(message);

    return this;
  }

  public getDate() {
    return this.date;
  }
  public getDate2() {
    return this.date2;
  }

  /**
   * Checks if the object has been modified.
   *
   * @returns True if modifications have occurred.
   */
  getIsModified(): boolean {
    return this.isModified;
  }

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

  withDescription(description: string): this {
    this.description = description;
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

  /**
   * Checks whether all required fields are set to build the ledger object.
   *
   * @returns Ok if buildable, otherwise an Error describing the issue.
   */
  isBuildable(): Maybe<Error> {
    return (
      this.id != null &&
      Number.isInteger(this.date) &&
      Number.isInteger(this.date2) &&
      this.source != null &&
      this.description != null &&
      this.metadata != null) ? Ok : new Error("Not a buildable object.");
  }

  /**
   * Checks whether the object has been successfully built.
   *
   * @returns True if build() has been invoked and a result exists.
   */
  isBuilt(): boolean {
    return this.result !== undefined;
  }

  /**
   * Abstract method to build the ledger object.
   *
   * @returns The built ledger object as a Result. If not buildable, returns an Error.
   */
  abstract build(): Result<T, Error>;

  /**
   * Commits any recorded modifications via the provided commit registry.
   *
   * @param commitRegistry - An instance of CommitRegistry for logging changes.
   */
  commitChanges(commitRegistry: CommitRegistry) {
    if (this.result === undefined || !this.isModified)
      return;

    commitRegistry.commitChange({
      messages: this.modificationMessage ?? [],
      object: this.result
    });
  }
}