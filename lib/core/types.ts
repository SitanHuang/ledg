type timestamp = number;

class NoneClass {
  private readonly __noneTypeBrand = undefined;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static readonly instance: NoneType = Object.freeze(new NoneClass());
}

class OkClass {
  private readonly __okTypeBrand = undefined;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() { }

  public static readonly instance: OkType = Object.freeze(new OkClass());
}

type NoneType = Readonly<NoneClass>;
type OkType = Readonly<OkClass>;

const None: NoneType = NoneClass.instance;
const Ok: OkType = OkClass.instance;

type Some<T> = T;
type Optional<T> = T | NoneType;
type Maybe<E extends Error = Error> = OkType | E;

type Result<T, E extends Error = Error> = T | E;

function isSome<T>(opt: Optional<T>): opt is T {
  return opt !== None && !(opt instanceof Error);
}
function isNone<T>(opt: Optional<T>): opt is NoneType {
  return opt === None;
}

function hasResult<T>(opt: Result<T>): opt is T {
  return opt !== None && !(opt instanceof Error);
}
function hasError<E extends Error=Error>(opt: Result<unknown, E>): opt is E {
  return opt instanceof Error;
}

function isOk(maybe: Maybe): maybe is OkType {
  return maybe === Ok;
}

function chainMaybes(...funcs: (() => Maybe)[]): Maybe {
  for (const func of funcs) {
    const result = func();
    if (!isOk(result)) {
      return result;
    }
  }
  return Ok;
}
async function chainMaybesAsync(...funcs: (() => Promise<Maybe>)[]): Promise<Maybe> {
  for (const func of funcs) {
    const result = await func();
    if (!isOk(result)) {
      return result;
    }
  }
  return Ok;
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
function unwrap<T>(opt: Optional<T>): T {
  if (opt instanceof Error) {
    throw opt;
  }
  if (isSome(opt)) {
    return opt;
  }
  throw new Error("PANIC: Called unwrap on a None value");
}

export { timestamp, Optional, Some, None, isSome, isNone, hasResult, hasError, unwrap, unwrapResult, chainMaybes, chainMaybesAsync, Result, Ok, Maybe, NoneType, OkType, isOk };
