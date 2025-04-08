type timestamp = number;

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class NoneType {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static readonly instance: NoneType = Object.freeze(new NoneType());
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class OkType {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() { }

  public static readonly instance: OkType = Object.freeze(new OkType());
}

const None: NoneType = NoneType.instance;
const Ok: OkType = OkType.instance;

type Some<T> = T;
type Option<T> = Some<T> | NoneType;
type Maybe<E extends Error = Error> = OkType | E;

type Result<T, E extends Error = Error> = Some<T> | E;

function isSome<T>(opt: Option<T>): opt is T {
  return opt !== None && !(opt instanceof Error);
}
function isNone<T>(opt: Option<T>): opt is NoneType {
  return opt === None;
}

function isOk(maybe: Maybe): maybe is OkType {
  return maybe === Ok;
}

function unwrapResult<T>(opt: Result<T>): T {
  if (opt instanceof Error) {
    throw opt;
  }
  if (isSome(opt)) {
    return opt;
  }
  throw new Error("PANIC: Called unwrap on a None value");
}
function unwrap<T>(opt: Option<T>): T {
  if (opt instanceof Error) {
    throw opt;
  }
  if (isSome(opt)) {
    return opt;
  }
  throw new Error("PANIC: Called unwrap on a None value");
}

export { timestamp, Option, Some, None, isSome, isNone, unwrap, unwrapResult, Result, Ok, Maybe, NoneType, OkType, isOk };
