```shell
npx esbuild lib/cli/entry.ts --bundle --minify --platform=node --outfile=out.cjs --packages=external
npx esbuild lib/cli/entry.ts --bundle --minify --platform=node --outfile=../bundled.cjs
```

```
-rw-r--r--. 1 180K ../bundled.cjs
-rw-r--r--. 1  51K ./out.cjs
```

# Results

``` shell
hyperfine 'bash -c "l --no-config -Fnull --do-not-write-books --do-not-write-config"' 'bash -c "node out/cli/entry.js acc -F null"' 'bash -c "node out.cjs acc -F null"' 'bash -c "cd ..;node bundled.cjs acc -F null"' -i --warmup 10
```

```
Benchmark 1: bash -c "l --no-config -Fnull --do-not-write-books --do-not-write-config"
  Time (mean ± σ):     227.1 ms ±  19.8 ms    [User: 200.7 ms, System: 28.4 ms]
  Range (min … max):   208.5 ms … 281.2 ms    13 runs

Benchmark 2: bash -c "node out/cli/entry.js acc -F null"
  Time (mean ± σ):     603.4 ms ±  66.2 ms    [User: 612.8 ms, System: 87.1 ms]
  Range (min … max):   509.3 ms … 703.4 ms    10 runs

Benchmark 3: bash -c "node out.cjs acc -F null"
  Time (mean ± σ):     379.5 ms ±  40.5 ms    [User: 365.6 ms, System: 50.5 ms]
  Range (min … max):   339.5 ms … 475.9 ms    10 runs

Benchmark 4: bash -c "cd ..;node bundled.cjs acc -F null"
  Time (mean ± σ):     198.1 ms ±   7.0 ms    [User: 174.5 ms, System: 24.9 ms]
  Range (min … max):   187.7 ms … 215.3 ms    14 runs

Summary
  bash -c "cd ..;node bundled.cjs acc -F null" ran
    1.15 ± 0.11 times faster than bash -c "l --no-config -Fnull --do-not-write-books --do-not-write-config"
    1.92 ± 0.22 times faster than bash -c "node out.cjs acc -F null"
    3.05 ± 0.35 times faster than bash -c "node out/cli/entry.js acc -F null"
```