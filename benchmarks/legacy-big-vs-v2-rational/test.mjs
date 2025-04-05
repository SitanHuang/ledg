#!/usr/bin/env node
import { Rational, Big } from './lib.mjs';

import { performance } from 'perf_hooks';

// === Configurable parameters ===
const iterations = 100000;
const warmup = 5000;

// Define a set of test cases with different integer and decimal digit counts.
const testCases = [
  { integerDigits: 3, decimalDigits: 0 },
  { integerDigits: 3, decimalDigits: 1 },
  { integerDigits: 3, decimalDigits: 2 },
  { integerDigits: 3, decimalDigits: 3 },
  { integerDigits: 3, decimalDigits: 4 },
  { integerDigits: 3, decimalDigits: 5 },
  { integerDigits: 4, decimalDigits: 2 },
  { integerDigits: 5, decimalDigits: 2 },
  { integerDigits: 3, decimalDigits: 5 },
  { integerDigits: 6, decimalDigits: 0 },
  { integerDigits: 6, decimalDigits: 2 },
  { integerDigits: 6, decimalDigits: 3 },
  { integerDigits: 6, decimalDigits: 4 },
  { integerDigits: 6, decimalDigits: 5 },
  { integerDigits: 9, decimalDigits: 0 },
  { integerDigits: 9, decimalDigits: 2 },
  { integerDigits: 9, decimalDigits: 5 },
  { integerDigits: 9, decimalDigits: 8 },
  { integerDigits: 9, decimalDigits: 9 },
];

// --- Helper functions ---

// Generate a random digit (as a character)
function randomDigit(allowZero = true) {
  const min = allowZero ? 0 : 1;
  const digit = Math.floor(Math.random() * (10 - min)) + min;
  return digit.toString();
}

// Generate a random number string with a given number of integer and decimal digits.
// For the integer part, if more than one digit is required, the first digit is nonzero.
function generateRandomNumberString(integerDigits, decimalDigits) {
  let intPart = "";
  if (integerDigits > 0) {
    // first digit nonzero if more than one digit
    intPart += integerDigits > 1 ? randomDigit(false) : randomDigit();
    for (let i = 1; i < integerDigits; i++) {
      intPart += randomDigit();
    }
  }
  let fracPart = "";
  if (decimalDigits > 0) {
    for (let i = 0; i < decimalDigits; i++) {
      fracPart += randomDigit();
    }
    return intPart + "." + fracPart;
  }
  return intPart;
}

// For arithmetic tests we want a JS number value.
function generateRandomNumber(integerDigits, decimalDigits) {
  return parseFloat(generateRandomNumberString(integerDigits, decimalDigits));
}

// --- Test definitions ---
//
// Each test definition includes a name, a type ("construct", "binary", or "unary")
// and for "construct" tests, separate constructor functions for Rational and Big.
// For binary/unary tests, an op function is defined (which is common to both classes).
const tests = [
  {
    name: "constructFromString",
    type: "construct",
    inputType: "string", // input is a string representation
    constructor: {
      Rational: (s) => Rational.parse(s),
      Big: (s) => new Big(s),
    }
  },
  {
    name: "constructFromNumber",
    type: "construct",
    inputType: "number", // input is a JS number
    constructor: {
      Rational: (n) => Rational.fromNumber(n),
      Big: (n) => new Big(n),
    }
  },
  {
    name: "add",
    type: "binary",
    op: (a, b) => a.plus(b)
  },
  {
    name: "subtract",
    type: "binary",
    op: (a, b) => a.minus(b)
  },
  {
    name: "multiply",
    type: "binary",
    op: (a, b) => a.times(b)
  },
  {
    name: "divide",
    type: "binary",
    op: (a, b) => {
      // Ensure b is not zero; if it is, return a (should not happen for our random generators)
      // (Alternatively, one could re-generate b.)
      return b.eq(0) ? a : a.div(b);
    }
  },
  {
    name: "equal",
    type: "binary",
    op: (a, b) => a.eq(b)
  },
  {
    name: "round",
    type: "unary",
    op: (a) => a.round(10)
  },
  {
    name: "toNumber",
    type: "unary",
    op: (a) => a.toNumber()
  },
  {
    name: "valueOf",
    type: "unary",
    op: (a) => a.valueOf()
  },
];

// For arithmetic tests we use the following conversion functions to create operands:
// For Rational, we use Rational.fromNumber and for Big, new Big(x)
// (This mirrors the sample code and keeps the input similar.)
function convertArithmeticOperand(className, x) {
  if (className === "Rational") {
    return Rational.fromNumber(x);
  } else if (className === "Big") {
    return new Big(x);
  }
  throw new Error("Unknown class: " + className);
}

// --- Benchmark runner functions ---
//
// runConstructTest: inside the loop, generate an input (string or number) and call the constructor.
function runConstructTest(constructorFn, inputType, className, iterations, warmup, integerDigits, decimalDigits) {
  let dummy = 0;
  // Warmup
  for (let i = 0; i < warmup; i++) {
    const input = inputType === "string"
      ? generateRandomNumberString(integerDigits, decimalDigits)
      : generateRandomNumber(integerDigits, decimalDigits);
    const inst = constructorFn(input);
    // Use a property from the instance so the call isn’t optimized away.
    dummy += (inst.toString().length);
  }
  // Measured loop
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const input = inputType === "string"
      ? generateRandomNumberString(integerDigits, decimalDigits)
      : generateRandomNumber(integerDigits, decimalDigits);
    const inst = constructorFn(input);
    dummy += (inst.toString().length);
  }
  const end = performance.now();
  // Return the elapsed time (ms)
  // (dummy is here to prevent dead-code elimination)
  if (dummy === 0) console.log(dummy);
  return end - start;
}

// runBinaryTest: pre-generate two arrays of operands and loop calling op(a,b).
function runBinaryTest(opFn, className, iterations, warmup, integerDigits, decimalDigits) {
  let dummy = 0;
  // Pre-generate raw JS number arrays for operands.
  const operandsA = [];
  const operandsB = [];
  for (let i = 0; i < iterations + warmup; i++) {
    let a = generateRandomNumber(integerDigits, decimalDigits);
    let b = generateRandomNumber(integerDigits, decimalDigits);
    // Avoid zero for division tests (if needed)
    if (opFn === tests.find(t => t.name === "divide").op && b === 0) {
      b = 1;
    }
    operandsA.push(a);
    operandsB.push(b);
  }
  // Warmup loop
  for (let i = 0; i < warmup; i++) {
    const a = convertArithmeticOperand(className, operandsA[i]);
    const b = convertArithmeticOperand(className, operandsB[i]);
    const res = opFn(a, b);
    // For eq, res is a boolean; for others, call toString()
    dummy += typeof res === "boolean" ? (res ? 1 : 0) : res.toString().length;
  }
  // Measured loop
  const start = performance.now();
  for (let i = warmup; i < iterations + warmup; i++) {
    const a = convertArithmeticOperand(className, operandsA[i]);
    const b = convertArithmeticOperand(className, operandsB[i]);
    const res = opFn(a, b);
    dummy += typeof res === "boolean" ? (res ? 1 : 0) : res.toString().length;
  }
  const end = performance.now();
  if (dummy === 0) console.error(dummy);
  return end - start;
}

// runUnaryTest: pre-generate an array of operands and loop calling op(a).
function runUnaryTest(opFn, className, iterations, warmup, integerDigits, decimalDigits) {
  let dummy = 0;
  const operands = [];
  for (let i = 0; i < iterations + warmup; i++) {
    const num = generateRandomNumber(integerDigits, decimalDigits);
    operands.push(num);
  }
  // Warmup
  for (let i = 0; i < warmup; i++) {
    const a = convertArithmeticOperand(className, operands[i]);
    const res = opFn(a);
    dummy += typeof res === "boolean" ? (res ? 1 : 0) : (typeof res === "number" ? res : res.toString().length);
  }
  // Measured loop
  const start = performance.now();
  for (let i = warmup; i < iterations + warmup; i++) {
    const a = convertArithmeticOperand(className, operands[i]);
    const res = opFn(a);
    dummy += typeof res === "boolean" ? (res ? 1 : 0) : (typeof res === "number" ? res : res.toString().length);
  }
  const end = performance.now();
  if (dummy === 0) console.error(dummy);
  return end - start;
}

// --- Main Benchmark Runner ---
//
// For each test and for each test case (combination of integerDigits and decimalDigits),
// run the test for both Rational and Big and output a CSV row comparing them.
function runBenchmarks() {
  // Print CSV header.
  console.log("operation,integerDigits,decimalDigits,decimalToIntegerRatio,iterations,quantity_total_ms,quantity_avg_ms,big_total_ms,big_avg_ms,relative_ratio");

  // For each test definition...
  for (const testDef of tests) {
    // For each combination of integer/decimal digits.
    for (const { integerDigits, decimalDigits } of testCases) {
      const ratio = (decimalDigits / integerDigits).toFixed(2);
      let qtyTime, bigTime;
      // Branch on test type.
      if (testDef.type === "construct") {
        // For Rational
        qtyTime = runConstructTest(testDef.constructor.Rational, testDef.inputType, "Rational", iterations, warmup, integerDigits, decimalDigits);
        // For Big
        bigTime = runConstructTest(testDef.constructor.Big, testDef.inputType, "Big", iterations, warmup, integerDigits, decimalDigits);
      } else if (testDef.type === "binary") {
        qtyTime = runBinaryTest(testDef.op, "Rational", iterations, warmup, integerDigits, decimalDigits);
        bigTime = runBinaryTest(testDef.op, "Big", iterations, warmup, integerDigits, decimalDigits);
      } else if (testDef.type === "unary") {
        qtyTime = runUnaryTest(testDef.op, "Rational", iterations, warmup, integerDigits, decimalDigits);
        bigTime = runUnaryTest(testDef.op, "Big", iterations, warmup, integerDigits, decimalDigits);
      } else {
        continue;
      }
      // Compute averages and relative ratio.
      const qtyAvg = qtyTime / iterations;
      const bigAvg = bigTime / iterations;
      const relative = bigTime > 0 ? (qtyTime / bigTime).toFixed(2) : "NaN";
      // Output CSV row.
      console.log(`${testDef.name},${integerDigits},${decimalDigits},${ratio},${iterations},${qtyTime.toFixed(2)},${qtyAvg.toFixed(5)},${bigTime.toFixed(2)},${bigAvg.toFixed(5)},${relative}`);
    }
  }
  // (Optionally, you could output a final dummy value to prevent dead-code elimination; here we assume our accumulation prevents optimization.)
}

runBenchmarks();