
export interface SourceDescriptor {
  readonly sourceText?: string
  readonly modifiable: boolean
}

export class NullSourceDescriptor implements SourceDescriptor {
  readonly modifiable: boolean = false;

  static INSTANCE = new NullSourceDescriptor();

  constructor(
    readonly sourceText?: string
  ){}
}