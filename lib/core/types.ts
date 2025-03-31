type timestamp = number;

class NoneType {
  private constructor() {}

  public static readonly instance: NoneType = Object.freeze(new NoneType());
}

const None: NoneType = NoneType.instance;

type Some<T> = T;
type Option<T> = Some<T> | NoneType;

function isSome<T>(opt: Option<T>): opt is T {
  return opt !== None;
}
function isNone<T>(opt: Option<T>): opt is NoneType {
  return opt === None;
}

function unwrap<T>(opt: Option<T>): T {
  if (isSome(opt)) {
    return opt;
  }
  throw new Error("Called unwrap on a None value");
}

export { timestamp, Option, Some, None, isSome, isNone, unwrap };
