import { Project, ts } from "ts-morph";
import {
  getExported,
  getPotentiallyUnused,
  importsForSideEffects,
  trackWildcardUses,
} from "./analyzer";

const fooSrc = `
export const x = 'x';
export const y = 'y';
export const z = {a: 'a'};
export const w = 'w';
export type ABC = 'a' | 'b' | 'c';

export const unusedC = 'c';
export type UnusedT = 'T';
`;

const starImportSrc = `
import * as foo from './foo';
import {UseFoo} from './use-foo';

const x = foo.x;
const {y} = foo;
const {z: {a}} = foo;
const w = foo['w'];
type ABC = foo.ABC;
`;

const useFooSrc = `
export function UseFoo(foo: string) {
  alert(foo);
}
`;

const barSrc = `
export const bar = () => false;
`;

const testBarSrc = `
import { bar } from './bar';

describe("bar", () => {
  it("should return false", () => {
    expect(bar()).toBe.toBeFalsy;
  });
});
`;

describe("analyzer", () => {
  const project = new Project();
  const foo = project.createSourceFile("/project/foo.ts", fooSrc);
  const useFoo = project.createSourceFile("/project/use-foo.ts", useFooSrc);
  const star = project.createSourceFile("/project/star.ts", starImportSrc);
  const bar = project.createSourceFile("/project/bar.ts", barSrc);
  const testBar = project.createSourceFile("/project/bar.test.ts", testBarSrc);

  it("should track import wildcards", () => {
    // TODO(danvk): rename this to importSideEffects()
    expect(importsForSideEffects(star)).toEqual([]);
  });

  it("should track named exports", () => {
    expect(getExported(foo)).toEqual([
      { name: "x", start: { line: 2, column: 14 }, end: { line: 2, column: 21 } },
      { name: "y", start: { line: 3, column: 14 }, end: { line: 3, column: 21 } },
      { name: "z", start: { line: 4, column: 14 }, end: { line: 4, column: 26 } },
      { name: "w", start: { line: 5, column: 14 }, end: { line: 5, column: 21 } },
      { name: "ABC", start: { line: 6, column: 1 }, end: { line: 6, column: 35 } },
      { name: "unusedC", start: { line: 8, column: 14 }, end: { line: 8, column: 27 } },
      { name: "UnusedT", start: { line: 9, column: 1 }, end: { line: 9, column: 27 } },
    ]);

    expect(getExported(useFoo)).toEqual([{ name: "UseFoo", start: { line: 2, column: 1 }, end: { line: 4, column: 2 } }]);
  });

  it("should track named imports", () => {
    expect(getPotentiallyUnused(foo)).toEqual({
      file: "/project/foo.ts",
      symbols: [
        { 
          start:  {
            column: 14,
            line: 8,
          },
          end:  {
            column: 27,
            line: 8,
          },
          name: "unusedC",
          usedInModule: false
        },
        {
          start:  {
            column: 1,
            line: 9,
          },
          end:  {
            column: 27,
            line: 9,
          },
          name: "UnusedT",
          usedInModule: false
        },
      ],
      type: 0,
    });
  });

  it("should not skip source files without a pattern", () => {
    // while bar.test.ts is included, bar is used
    expect(getPotentiallyUnused(bar)).toEqual({
      file: "/project/bar.ts",
      symbols: [],
      type: 0,
    });
  });

  it("should skip source files matching a pattern", () => {
    // when bar.test.ts is exclude by the skip pattern, bar is unused
    const unused = getPotentiallyUnused(bar, /.test.ts/)

   expect( unused.symbols.map(({name}) => name)).toContain("bar")

  });

  it("should track usage through star imports", () => {
    const importNode = star.getFirstDescendantByKindOrThrow(
      ts.SyntaxKind.ImportDeclaration
    );

    expect(trackWildcardUses(importNode)).toEqual(["x", "y", "z", "w", "ABC"]);
  });
});
