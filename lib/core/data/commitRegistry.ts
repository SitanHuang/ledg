import { LedgObject } from "./ledgObject.ts";

class Commit {
  constructor(
    public readonly messages: string[],
    public readonly object: LedgObject,
  ) {}
}

export class CommitRegistry {
  private commits: Commit[] = [];

  commitChange({
    messages,
    object
  }: {
    messages: string[],
    object: LedgObject
  }): void {
    this.commits.push(new Commit(messages, object));
  }
}