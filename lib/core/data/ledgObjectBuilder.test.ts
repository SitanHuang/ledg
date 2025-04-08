import { describe, it, expect, beforeEach } from 'vitest';
import { LedgObject, LedgObjectBuilder } from './ledgObject.ts';
import { SourceDescriptor } from './sourceDescriptor.ts';
import { isOk, isSome, Result, unwrapResult } from '../types.ts';
import { CommitRegistry } from './commitRegistry.ts';

class ShamLedgObjectBuilder extends LedgObjectBuilder<LedgObject> {
  override build(): Result<LedgObject, Error> {
    const buildable = this.isBuildable();
    if (!isOk(buildable)) {
      return buildable;
    }
    return {
      id: this.id!,
      date: this.date!,
      date2: this.date2!,
      source: this.source,
      metadata: this.metadata,
    };
  }
}

describe("LedgObjectBuilder", () => {
  let builder: ShamLedgObjectBuilder;

  beforeEach(() => {
    builder = new ShamLedgObjectBuilder();
  });

  it("should not be buildable when required fields are missing", () => {
    // Only source and metadata have default values.
    expect(isOk(builder.isBuildable())).toBe(false);
  });

  it("should become buildable when all required fields are set", () => {
    builder.withId("123").withDate(1000).withDate2(2000);
    expect(isOk(builder.isBuildable())).toBe(true);
  });

  it("should set id via withId", () => {
    builder.withId("my-id").withDate(1000).withDate2(2000);
    const built = unwrapResult(builder.build());
    expect(built.id).toBe("my-id");
  });

  it("should override a previously set id when withId is called again", () => {
    builder.withId("first-id").withId("second-id").withDate(1000).withDate2(2000);
    const built = unwrapResult(builder.build());
    expect(built.id).toBe("second-id");
  });

  it("should generate an id with genId", () => {
    builder.genId().withDate(1000).withDate2(2000);
    const built = unwrapResult(builder.build());
    // Assuming nanoid(8) generates an 8-character id.
    expect(built.id).toHaveLength(8);
  });

  it("should override a generated id if withId is called after genId", () => {
    builder.genId().withId("override-id").withDate(1000).withDate2(2000);
    const built = unwrapResult(builder.build());
    expect(built.id).toBe("override-id");
  });

  it("should set the source via withSource", () => {
    const dummySource: SourceDescriptor = { modifiable: true, sourceText: "asdf" } as SourceDescriptor;
    builder.withSource(dummySource).withId("1").withDate(1000).withDate2(2000);
    const built = unwrapResult(builder.build());
    expect(built.source).toBe(dummySource);
  });

  it("should set the metadata via withMetadata", () => {
    const meta = { key: "value", count: 5 };
    builder.withMetadata(meta).withId("1").withDate(1000).withDate2(2000);
    const built = unwrapResult(builder.build());
    expect(built.metadata).toEqual(meta);
  });

  it("should set date and date2 via withDate and withDate2", () => {
    builder.withDate(1000).withDate2(2000).withId("1");
    const built = unwrapResult(builder.build());
    expect(built.date).toBe(1000);
    expect(built.date2).toBe(2000);
  });

  it("should allow chaining of methods", () => {
    const dummySource: SourceDescriptor = { modifiable: false } as SourceDescriptor;
    const meta = { a: 1, b: "test" };

    const built = unwrapResult(builder
      .withId("chain-id")
      .withDate(1000)
      .withDate2(2000)
      .withSource(dummySource)
      .withMetadata(meta)
      .build());

    expect(built.id).toBe("chain-id");
    expect(built.date).toBe(1000);
    expect(built.date2).toBe(2000);
    expect(built.source).toBe(dummySource);
    expect(built.metadata).toEqual(meta);
  });

  it("should throw an error when build is called and builder is not buildable", () => {
    builder.withId("incomplete");
    expect(isSome(builder.build())).toBe(false);
  });
});