export type AccountIdentifier = string;

export class Account {
  public static readonly DELIMITER = ".";

  protected readonly _delimitedGroups: string[];

  constructor(
    public identifier: AccountIdentifier
  ) {
    this._delimitedGroups = Account.splitIdentifier(identifier);
  }

  getDelimitedGroups(): string[] {
    return this._delimitedGroups;
  }

  public static splitIdentifier(identifier: AccountIdentifier): string[]  {
    return identifier.split(Account.DELIMITER);
  }

  public static joinDelimitedGroups(delimitedGroups: string[]): string  {
    return delimitedGroups.join(Account.DELIMITER);
  }
}
