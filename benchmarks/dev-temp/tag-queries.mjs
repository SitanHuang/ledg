#!/usr/bin/env node

/*
node .\benchmarks\dev-temp\tag-queries.mjs
┌─────────┬───────┬──────────────┬────────────┬──────────┬──────────┬─────────┐
│ (index) │ rows  │ tagsPerField │ queryCount │ regex_ms │ split_ms │ set_ms  │
├─────────┼───────┼──────────────┼────────────┼──────────┼──────────┼─────────┤
│ 0       │ 50000 │ 1            │ 1          │ '1.27'   │ '6.22'   │ '1.21'  │
│ 1       │ 50000 │ 1            │ 2          │ '1.27'   │ '5.97'   │ '1.47'  │
│ 2       │ 50000 │ 1            │ 3          │ '1.04'   │ '6.00'   │ '1.35'  │
│ 3       │ 50000 │ 1            │ 5          │ '1.83'   │ '6.04'   │ '1.35'  │
│ 4       │ 50000 │ 1            │ 8          │ '1.87'   │ '5.94'   │ '1.23'  │
│ 5       │ 50000 │ 1            │ 13         │ '1.74'   │ '6.06'   │ '1.59'  │
│ 6       │ 50000 │ 1            │ 21         │ '3.82'   │ '5.81'   │ '0.94'  │
│ 7       │ 50000 │ 1            │ 34         │ '1.39'   │ '6.04'   │ '0.94'  │
│ 8       │ 50000 │ 2            │ 1          │ '1.66'   │ '9.32'   │ '1.07'  │
│ 9       │ 50000 │ 2            │ 2          │ '2.07'   │ '9.79'   │ '1.60'  │
│ 10      │ 50000 │ 2            │ 3          │ '1.63'   │ '9.81'   │ '1.84'  │
│ 11      │ 50000 │ 2            │ 5          │ '1.48'   │ '9.61'   │ '1.23'  │
│ 12      │ 50000 │ 2            │ 8          │ '3.02'   │ '9.95'   │ '1.69'  │
│ 13      │ 50000 │ 2            │ 13         │ '1.99'   │ '9.89'   │ '1.64'  │
│ 14      │ 50000 │ 2            │ 21         │ '2.37'   │ '10.07'  │ '1.70'  │
│ 15      │ 50000 │ 2            │ 34         │ '2.52'   │ '10.07'  │ '1.46'  │
│ 16      │ 50000 │ 3            │ 1          │ '3.76'   │ '11.57'  │ '1.26'  │
│ 17      │ 50000 │ 3            │ 2          │ '2.95'   │ '12.42'  │ '1.96'  │
│ 18      │ 50000 │ 3            │ 3          │ '2.00'   │ '13.59'  │ '2.49'  │
│ 19      │ 50000 │ 3            │ 5          │ '2.15'   │ '12.88'  │ '2.58'  │
│ 20      │ 50000 │ 3            │ 8          │ '3.10'   │ '12.88'  │ '2.09'  │
│ 21      │ 50000 │ 3            │ 13         │ '5.58'   │ '12.87'  │ '2.62'  │
│ 22      │ 50000 │ 3            │ 21         │ '2.60'   │ '12.64'  │ '3.24'  │
│ 23      │ 50000 │ 3            │ 34         │ '1.84'   │ '13.99'  │ '2.38'  │
│ 24      │ 50000 │ 5            │ 1          │ '2.90'   │ '17.43'  │ '1.62'  │
│ 25      │ 50000 │ 5            │ 2          │ '3.47'   │ '17.00'  │ '2.42'  │
│ 26      │ 50000 │ 5            │ 3          │ '4.13'   │ '17.86'  │ '3.43'  │
│ 27      │ 50000 │ 5            │ 5          │ '3.58'   │ '19.28'  │ '4.34'  │
│ 28      │ 50000 │ 5            │ 8          │ '5.94'   │ '20.02'  │ '4.36'  │
│ 29      │ 50000 │ 5            │ 13         │ '3.97'   │ '19.68'  │ '3.90'  │
│ 30      │ 50000 │ 5            │ 21         │ '3.83'   │ '19.57'  │ '4.22'  │
│ 31      │ 50000 │ 5            │ 34         │ '4.98'   │ '19.39'  │ '4.19'  │
│ 32      │ 50000 │ 8            │ 1          │ '3.63'   │ '21.43'  │ '1.73'  │
│ 33      │ 50000 │ 8            │ 2          │ '3.83'   │ '22.64'  │ '2.96'  │
│ 34      │ 50000 │ 8            │ 3          │ '2.61'   │ '24.16'  │ '3.58'  │
│ 35      │ 50000 │ 8            │ 5          │ '5.45'   │ '27.79'  │ '6.06'  │
│ 36      │ 50000 │ 8            │ 8          │ '7.13'   │ '31.39'  │ '7.55'  │
│ 37      │ 50000 │ 8            │ 13         │ '6.93'   │ '32.48'  │ '7.47'  │
│ 38      │ 50000 │ 8            │ 21         │ '6.91'   │ '32.59'  │ '8.15'  │
│ 39      │ 50000 │ 8            │ 34         │ '7.04'   │ '32.35'  │ '8.11'  │
│ 40      │ 50000 │ 13           │ 1          │ '3.40'   │ '34.21'  │ '2.74'  │
│ 41      │ 50000 │ 13           │ 2          │ '2.64'   │ '33.17'  │ '3.57'  │
│ 42      │ 50000 │ 13           │ 3          │ '5.65'   │ '34.38'  │ '4.23'  │
│ 43      │ 50000 │ 13           │ 5          │ '10.60'  │ '39.79'  │ '5.45'  │
│ 44      │ 50000 │ 13           │ 8          │ '10.88'  │ '45.72'  │ '8.48'  │
│ 45      │ 50000 │ 13           │ 13         │ '14.70'  │ '54.59'  │ '12.47' │
│ 46      │ 50000 │ 13           │ 21         │ '13.73'  │ '54.65'  │ '12.16' │
│ 47      │ 50000 │ 13           │ 34         │ '14.02'  │ '56.22'  │ '12.66' │
│ 48      │ 50000 │ 21           │ 1          │ '5.81'   │ '47.32'  │ '4.06'  │
│ 49      │ 50000 │ 21           │ 2          │ '7.66'   │ '49.49'  │ '5.15'  │
│ 50      │ 50000 │ 21           │ 3          │ '9.13'   │ '53.77'  │ '6.88'  │
│ 51      │ 50000 │ 21           │ 5          │ '23.53'  │ '59.31'  │ '8.06'  │
│ 52      │ 50000 │ 21           │ 8          │ '25.08'  │ '67.59'  │ '10.82' │
│ 53      │ 50000 │ 21           │ 13         │ '21.81'  │ '81.90'  │ '14.08' │
│ 54      │ 50000 │ 21           │ 21         │ '27.61'  │ '105.38' │ '20.44' │
│ 55      │ 50000 │ 21           │ 34         │ '28.96'  │ '102.53' │ '20.62' │
│ 56      │ 50000 │ 34           │ 1          │ '9.48'   │ '73.56'  │ '5.17'  │
│ 57      │ 50000 │ 34           │ 2          │ '17.00'  │ '77.65'  │ '7.65'  │
│ 58      │ 50000 │ 34           │ 3          │ '9.50'   │ '80.46'  │ '9.11'  │
│ 59      │ 50000 │ 34           │ 5          │ '22.91'  │ '90.31'  │ '11.20' │
│ 60      │ 50000 │ 34           │ 8          │ '25.64'  │ '101.68' │ '13.46' │
│ 61      │ 50000 │ 34           │ 13         │ '31.99'  │ '111.84' │ '16.61' │
│ 62      │ 50000 │ 34           │ 21         │ '45.58'  │ '146.65' │ '25.37' │
│ 63      │ 50000 │ 34           │ 34         │ '65.62'  │ '188.28' │ '32.47' │
└─────────┴───────┴──────────────┴────────────┴──────────┴──────────┴─────────┘
*/

import { performance } from "node:perf_hooks";
import process from "node:process";
import crypto from "node:crypto";

const argv = process.argv.slice(2);
function getArg(flag, def) {
  const idx = argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < argv.length) return argv[idx + 1];
  return def;
}

const ROWS = Number(getArg("--rows", 50000));
const TAGS_PER_FIELD_LIST = (getArg("--tagsPerField", "1,2,3,5,8,13,21,34"))
  .split(/[,\s]+/)
  .filter(Boolean)
  .map(Number);
const QUERY_COUNTS_LIST = (getArg("--queries", "1,2,3,5,8,13,21,34"))
  .split(/[,\s]+/)
  .filter(Boolean)
  .map(Number);
const REPEAT = Number(getArg("--repeat", 5));

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
function randomInt(max) {
  return crypto.randomInt(max);
}
function randomWord(len = 6) {
  let out = "";
  for (let i = 0; i < len; ++i) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

function randomTag() {
  return randomWord(randomInt(5) + 3);
}

function generateDataset(rows, tagsPerField) {
  const dataset = new Array(rows);
  for (let i = 0; i < rows; ++i) {
    const tags = new Array(tagsPerField);
    for (let j = 0; j < tagsPerField; ++j) tags[j] = randomTag();
    dataset[i] = tags.join(",");
  }
  return dataset;
}


function buildRegex(queries) {
  return new RegExp(
    '(?:^|,)' + queries.map((q) => `${q}(?:,|$)`).join("|"),
    "i"
  );
}

function matchRegex(dataset, queries) {
  const rx = buildRegex(queries);
  let hits = 0;
  for (const field of dataset) if (rx.test(field)) ++hits;
  return hits;
}

function matchSplit(dataset, queries) {
  let hits = 0;
  for (const field of dataset) {
    const arr = field.split(",");
    for (const q of queries) {
      if (arr.includes(q)) {
        ++hits;
        break;
      }
    }
  }
  return hits;
}

function preprocessSets(dataset) {
  return dataset.map((field) => new Set(field.split(",")));
}

function matchSet(datasetsSets, queries) {
  let hits = 0;
  for (const tagSet of datasetsSets) {
    for (const q of queries) {
      if (tagSet.has(q)) {
        ++hits;
        break;
      }
    }
  }
  return hits;
}

function timeIt(fn) {
  const start = performance.now();
  const result = fn();
  const delta = performance.now() - start;
  return { ms: delta, result };
}

function runBench({ rows, tagsPerField, queryCount }) {
  const dataset = generateDataset(rows, tagsPerField);
  // Pick random queries from first record for realism
  const firstTags = dataset[0].split(",");
  const queries = firstTags.slice(0, queryCount);

  const datasetSets = preprocessSets(dataset);

  const benchFns = {
    regex: () => matchRegex(dataset, queries),
    split: () => matchSplit(dataset, queries),
    set: () => matchSet(datasetSets, queries),
  };

  const results = {};
  for (const [name, fn] of Object.entries(benchFns)) {
    let acc = 0;
    let spent = 0;
    for (let i = 0;i < 2; ++i) {
      fn();
    }
    for (let i = 0; i < REPEAT; ++i) {
      const { ms, result } = timeIt(fn);
      spent += ms;
      acc += result;
    }
    results[name] = (spent / REPEAT).toFixed(2);
  }

  return {
    rows,
    tagsPerField,
    queryCount,
    regex_ms: results.regex,
    split_ms: results.split,
    set_ms: results.set,
  };
}

function main() {
  const table = [];
  for (const tagsPerField of TAGS_PER_FIELD_LIST) {
    for (const queryCount of QUERY_COUNTS_LIST) {
      table.push(runBench({ rows: ROWS, tagsPerField, queryCount }));
    }
  }
  console.table(table);
}

main();
