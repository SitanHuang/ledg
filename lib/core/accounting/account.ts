export type AccountIdentifier = string;

export class Account {
  constructor(
    public identifier: AccountIdentifier,
    // TODO: split by delimeter
  ) {}
}