#!/usr/bin/env node
/**
 * Git SLOC History Visualizer
 *
 * This CLI tool goes through your git history (in chronological order),
 * and for each commit it does the following:
 *
 *  1. Exports the commit’s files to a temporary directory.
 *  2. Runs three series of SLOC counts using npx node-sloc:
 *      - Series 1: All code in the “lib/” folder.
 *      - Series 2: Non-testing library code (ignoring **\*.test.ts).
 * - Series 3: Effective compiled code in “out /” (ignoring **\*.test.js).
 *  3. Parses the SLOC output from each command.
 *  4. Aggregates the commit’s date, hash, and SLOC counts.
 *
 * Finally, it produces a polished HTML file (with Plotly.js) that you can open in your browser.
 *
 * This tool is written as an ES6 module for NodeJS and is Windows‐friendly.
 */

import { exec as execCb } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import * as tar from "tar";

const exec = promisify(execCb);

/**
 * Retrieve the full list of commits (chronological order).
 * Uses "git log" with a custom format: <commit hash> <commit timestamp>.
 */
async function getCommits() {
  const { stdout } = await exec('git log --reverse --pretty=format:"%H %ct"');
  return stdout
    .trim()
    .split("\n")
    .map((line) => {
      const [hash, timestamp] = line.split(" ");
      return { hash, timestamp: Number(timestamp) };
    });
}

/**
 * Run the node-sloc command with the given arguments in the provided working directory.
 * Returns the SLOC number (or 0 on error or if not found).
 */
async function runNodeSloc(cwd, argsArray) {
  // Build command string, e.g.,
  // npx node-sloc lib/
  // npx node-sloc lib/ --ignore-paths "**/*.test.ts"
  const command = `npx node-sloc ${argsArray.join(" ")}`;
  try {
    const { stdout } = await exec(command, { cwd });
    // Expect a table row like: | SLOC                          | 925               |
    const match = stdout.match(/\|\s*SLOC\s*\|\s*(\d+)/);
    if (match) {
      return Number(match[1]);
    }
  } catch (err) {
  }
  return 0;
}

/**
 * Process a single commit:
 *   - Create a temporary directory.
 *   - Archive and extract the commit into it.
 *   - Run the three node-sloc commands.
 *   - Clean up and return an object with commit info and SLOC numbers.
 */
async function processCommit(commit) {
  // Create a unique temporary directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-sloc-"));
  const archivePath = path.join(tmpDir, "archive.tar");

  try {
    // Archive the commit to a tar file.
    await exec(`git archive ${commit.hash} --format=tar -o "${archivePath}"`);
  } catch (err) {
    console.error(`Error archiving commit ${commit.hash}:`, err);
    return null;
  }

  try {
    // Extract the tar archive into the temporary directory.
    await tar.extract({ file: archivePath, cwd: tmpDir });
  } catch (err) {
    console.error(`Error extracting commit ${commit.hash}:`, err);
    return null;
  }

  // Run the three series of node-sloc commands.
  const series1 = await runNodeSloc('.', [tmpDir + "/lib/"]);
  const series2 = await runNodeSloc('.', [tmpDir + "/lib/", "--ignore-paths", `"**/*.test.ts"`]);
  const series3 = await runNodeSloc('.', [tmpDir + "/out/", "--ignore-paths", `"**/*.test.js"`]);

  // Clean up the temporary directory.
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return { ...commit, series1, series2, series3 };
}

/**
 * Generate an HTML file with an embedded Plotly.js chart.
 * The chart shows three lines (one for each series) versus commit date.
 */
function generateHTML(data) {
  // Prepare arrays for dates, SLOC counts, and commit hashes (for hover text).
  const dates = data.map((d) => new Date(d.timestamp * 1000).toISOString().split("T")[0]);
  const series1 = data.map((d) => d.series1);
  const series2 = data.map((d) => d.series2);
  const series3 = data.map((d) => d.series3);
  const commitHashes = data.map((d) => d.hash);

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Git History SLOC Progression</title>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; }
      h1 { text-align: center; }
      #chart { width: 100%; height: 600px; }
    </style>
  </head>
  <body>
    <h1>Git History SLOC Progression</h1>
    <div id="chart"></div>
    <script>
      var dates = ${JSON.stringify(dates)};
      var series1 = ${JSON.stringify(series1)};
      var series2 = ${JSON.stringify(series2)};
      var series3 = ${JSON.stringify(series3)};
      var commitHashes = ${JSON.stringify(commitHashes)};

      var trace1 = {
        x: dates,
        y: series1,
        mode: 'lines+markers',
        name: 'All Code (lib/)',
        text: commitHashes,
        hovertemplate: 'Commit: %{text}<br>Date: %{x}<br>SLOC: %{y}<extra></extra>'
      };
      var trace2 = {
        x: dates,
        y: series2,
        mode: 'lines+markers',
        name: 'Non-testing Library Code (lib/)',
        text: commitHashes,
        hovertemplate: 'Commit: %{text}<br>Date: %{x}<br>SLOC: %{y}<extra></extra>'
      };
      var trace3 = {
        x: dates,
        y: series3,
        mode: 'lines+markers',
        name: 'Effective Compiled Code (out/)',
        text: commitHashes,
        hovertemplate: 'Commit: %{text}<br>Date: %{x}<br>SLOC: %{y}<extra></extra>'
      };

      var plotData = [trace1, trace2, trace3];
      var layout = {
        title: 'Git History SLOC Progression',
        xaxis: { title: 'Commit Date' },
        yaxis: { title: 'SLOC' },
        hovermode: 'closest'
      };

      Plotly.newPlot('chart', plotData, layout);
    </script>
  </body>
</html>
  `;
}

/**
 * Main execution function:
 *  - Retrieves commit history.
 *  - Processes each commit.
 *  - Generates the HTML visualization.
 */
async function main() {
  console.log("Gathering git commit history...");
  const commits = await getCommits();
  console.log(`Found ${commits.length} commits.`);

  const results = [];
  for (const commit of commits) {
    console.log(`Processing commit ${commit.hash}...`);
    const res = await processCommit(commit);
    if (res) {
      results.push(res);
    }
  }

  // Generate and write the HTML visualization.
  const htmlContent = generateHTML(results);
  const outputPath = path.join(process.cwd(), "git-sloc-history.html");
  fs.writeFileSync(outputPath, htmlContent);
  console.log(`Visualization generated: ${outputPath}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
