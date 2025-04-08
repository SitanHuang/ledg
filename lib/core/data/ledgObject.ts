
import { NullSourceDescriptor, SourceDescriptor } from "./sourceDescriptor.ts";
import { Maybe, Ok, Result, timestamp } from '../types.ts';
import { nanoid } from "../legacy/nanoid.ts";
import { CommitRegistry } from "./commitRegistry.ts";

export type Metadata = Record<string, unknown>;

export type UUID = string;

export interface LedgObject {
  readonly id: UUID;
  readonly date: timestamp;
  readonly date2: timestamp;
  readonly source: SourceDescriptor;
  readonly metadata: Metadata;
}

export abstract class LedgObjectBuilder<T extends LedgObject> {
  protected id?: UUID;
  protected source: SourceDescriptor = NullSourceDescriptor.INSTANCE;
  protected metadata: Metadata = {};
  public date?: timestamp;
  public date2?: timestamp;

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
      this.date != null &&
      this.date2 != null &&
      this.source != null &&
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