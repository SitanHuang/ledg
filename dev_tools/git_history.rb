#!/usr/bin/env ruby
#
# A cross-platform Ruby re-implementation of the Node.js git-sloc-history script.
#
# It gathers commit history, archives and extracts each commit,
# runs "npx node-sloc" on various subdirectories,
# caches commit results (in "git_sloc_cache.json" next to this script),
# and generates an HTML visualization (with Plotly charts and a daily summary table).
#
# The daily table now shows “SLOC with tests” (all lib/ code) vs.
# “SLOC without tests” (lib/ with test files ignored).
#
require 'json'
require 'fileutils'
require 'tmpdir'
require 'open3'
require 'time'
require 'rubygems/package'

# Escape HTML special characters
def escape_html(str)
  str.to_s.gsub('&', '&amp;')
          .gsub('<', '&lt;')
          .gsub('>', '&gt;')
          .gsub('"', '&quot;')
          .gsub("'", '&#39;')
end

# Run a shell command in a given directory and return stdout.
def run_command(cmd, cwd = '.')
  stdout, stderr, status = Open3.capture3(cmd, chdir: cwd)
  raise "Command failed: #{cmd}\n#{stderr}" unless status.success?
  stdout
end

# Get commit history from git.
def get_commits
  cmd = 'git log --reverse "--pretty=format:%H^^^%ct^^^%s"'
  output = run_command(cmd)
  output.strip.split("\n").map do |line|
    parts = line.split('^^^')
    {
      'hash' => parts[0],
      'timestamp' => parts[1].to_i,
      'message' => parts[2..-1].join('^^^').strip
    }
  end
end

# Extract a tar archive using Ruby’s built-in tar reader.
def extract_tar(archive_path, destination)
  File.open(archive_path, "rb") do |file|
    Gem::Package::TarReader.new(file) do |tar|
      tar.each do |entry|
        dest = File.join(destination, entry.full_name)
        if entry.directory?
          FileUtils.mkdir_p(dest)
        else
          FileUtils.mkdir_p(File.dirname(dest))
          File.open(dest, "wb") { |f| f.write(entry.read) }
        end
      end
    end
  end
end

# Run node-sloc with the given arguments (relative to cwd) and parse its output.
def run_node_sloc(cwd, args_array)
  command = "npx node-sloc #{args_array.join(' ')}"
  output = run_command(command, cwd)
  result = { 'sloc' => 0, 'comments' => 0, 'blank' => 0, 'total' => 0 }
  result['sloc']     = output[/\|\s*SLOC\s*\|\s*(\d+)/, 1].to_i
  result['comments'] = output[/\|\s*Lines of comments\s*\|\s*(\d+)/, 1].to_i
  result['blank']    = output[/\|\s*Blank lines\s*\|\s*(\d+)/, 1].to_i
  result['total']    = output[/\|\s*Total LOC\s*\|\s*(\d+)/, 1].to_i
  result
end

# Process a single commit:
#   - Archive the commit into a tar file.
#   - Extract it to a temporary directory.
#   - Run three node-sloc commands on lib/ and out/ directories.
#   - Return a commit hash with added series stats.
def process_commit(commit)
  Dir.mktmpdir("git-sloc-") do |tmp_dir|
    archive_path = File.join(tmp_dir, "archive.tar")
    begin
      run_command("git archive #{commit['hash']} --format=tar -o \"#{archive_path}\"")
    rescue => e
      warn "Error archiving commit #{commit['hash']}: #{e}"
      return nil
    end

    begin
      extract_tar(archive_path, tmp_dir)
    rescue => e
      warn "Error extracting commit #{commit['hash']}: #{e}"
      return nil
    end

    # Run node-sloc on:
    #   series1: lib/ (all code, i.e. SLOC with tests)
    #   series2: lib/ ignoring test files (SLOC without tests)
    #   series3: out/ ignoring test files (compiled output)
    series1_stats = run_node_sloc('.', [File.join(tmp_dir, 'lib/')])
    series2_stats = run_node_sloc('.', [File.join(tmp_dir, 'lib/'), '--ignore-paths', '"**/*.test.ts"'])
    series3_stats = run_node_sloc('.', [File.join(tmp_dir, 'out/'), '--ignore-paths', '"**/*.test.js"'])

    commit.merge({
      'series1' => series1_stats,
      'series2' => series2_stats,
      'series3' => series3_stats
    })
  end
end

# Generate the HTML output (with Plotly charts and a daily summary table).
def generate_html(data)
  # Prepare arrays for charting.
  dates         = data.map { |d| Time.at(d['timestamp']).utc.iso8601.split('T')[0] }
  series1_sloc  = data.map { |d| d['series1']['sloc'] }
  series2_sloc  = data.map { |d| d['series2']['sloc'] }
  series3_sloc  = data.map { |d| d['series3']['sloc'] }
  messages      = data.map { |d| escape_html(d['message']) }
  indices       = (1..data.size).to_a

  # Build daily summaries for lib/:
  # "with tests" is series1.sloc and "without tests" is series2.sloc.
  daily_commits = {}
  data.each do |commit|
    day = Time.at(commit['timestamp']).utc.iso8601.split('T')[0]
    # Overwrite to keep the last commit of each day.
    daily_commits[day] = {
      'with_tests'    => commit['series1']['sloc'],
      'without_tests' => commit['series2']['sloc']
    }
  end
  sorted_days = daily_commits.keys.sort
  prev_with = 0
  prev_without = 0
  daily_rows = sorted_days.map do |day|
    with_tests    = daily_commits[day]['with_tests']
    without_tests = daily_commits[day]['without_tests']
    diff_with     = with_tests - prev_with
    diff_without  = without_tests - prev_without
    prev_with = with_tests
    prev_without = without_tests
    "<tr>
      <td>#{day}</td>
      <td>#{with_tests}</td>
      <td>#{diff_with}</td>
      <td>#{without_tests}</td>
      <td>#{diff_without}</td>
    </tr>"
  end.join("\n")

  <<~HTML
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Git History SLOC Progression</title>
      <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1, h2 { text-align: center; }
        #chart-date, #chart-index {
          width: 100%;
          height: 600px;
          margin-bottom: 50px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 40px;
        }
        th, td {
          border: 1px solid #ccc;
          padding: 6px 10px;
          text-align: left;
        }
        th {
          background: #f9f9f9;
        }
      </style>
    </head>
    <body>
      <h1>Git History SLOC Progression</h1>

      <!-- Chart 1: X-axis = Dates -->
      <div id="chart-date"></div>

      <!-- Chart 2: X-axis = Commit # -->
      <div id="chart-index"></div>

      <!-- Daily Summaries for lib/:
           Showing end-of-day SLOC (with tests) vs.
           SLOC (without tests) plus the daily differences. -->
      <h2>Daily Summaries (lib/)</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>End-of-Day SLOC (with tests)</th>
            <th>Daily Lines (with tests)</th>
            <th>End-of-Day SLOC (without tests)</th>
            <th>Daily Lines (without tests)</th>
          </tr>
        </thead>
        <tbody>
          #{daily_rows}
        </tbody>
      </table>

      <script>
        // Data for charts
        var dates = #{dates.to_json};
        var indices = #{indices.to_json};
        var series1 = #{series1_sloc.to_json};
        var series2 = #{series2_sloc.to_json};
        var series3 = #{series3_sloc.to_json};
        var messages = #{messages.to_json};

        // Chart 1: by commit date
        var trace1_date = {
          x: dates,
          y: series1,
          mode: 'lines+markers',
          name: 'All Code (lib/)',
          text: messages,
          hovertemplate: 'Message: %{text}<br>Date: %{x}<br>SLOC: %{y}<extra></extra>'
        };
        var trace2_date = {
          x: dates,
          y: series2,
          mode: 'lines+markers',
          name: 'Non-testing (lib/)',
          text: messages,
          hovertemplate: 'Message: %{text}<br>Date: %{x}<br>SLOC: %{y}<extra></extra>'
        };
        var trace3_date = {
          x: dates,
          y: series3,
          mode: 'lines+markers',
          name: 'Compiled (out/)',
          text: messages,
          hovertemplate: 'Message: %{text}<br>Date: %{x}<br>SLOC: %{y}<extra></extra>'
        };

        var layout_date = {
          title: 'SLOC vs Commit Date',
          xaxis: { title: 'Commit Date' },
          yaxis: { title: 'SLOC' },
          hovermode: 'closest'
        };
        Plotly.newPlot('chart-date', [trace1_date, trace2_date, trace3_date], layout_date);

        // Chart 2: by commit index
        var trace1_index = {
          x: indices,
          y: series1,
          mode: 'lines+markers',
          name: 'All Code (lib/)',
          text: messages,
          hovertemplate: 'Message: %{text}<br>Commit # %{x}<br>SLOC: %{y}<extra></extra>'
        };
        var trace2_index = {
          x: indices,
          y: series2,
          mode: 'lines+markers',
          name: 'Non-testing (lib/)',
          text: messages,
          hovertemplate: 'Message: %{text}<br>Commit # %{x}<br>SLOC: %{y}<extra></extra>'
        };
        var trace3_index = {
          x: indices,
          y: series3,
          mode: 'lines+markers',
          name: 'Compiled (out/)',
          text: messages,
          hovertemplate: 'Message: %{text}<br>Commit # %{x}<br>SLOC: %{y}<extra></extra>'
        };

        var layout_index = {
          title: 'SLOC vs Commit Number',
          xaxis: { title: 'Commit # (chronological)' },
          yaxis: { title: 'SLOC' },
          hovermode: 'closest'
        };
        Plotly.newPlot('chart-index', [trace1_index, trace2_index, trace3_index], layout_index);
      </script>
    </body>
  </html>
  HTML
end

# Main execution
def main
  puts "Loading cache..."
  script_dir = File.dirname(__FILE__)
  cache_file = File.join(script_dir, "~git_sloc_cache.json")
  cache = File.exist?(cache_file) ? JSON.parse(File.read(cache_file)) : {}

  puts "Gathering git commit history..."
  commits = get_commits
  puts "Found #{commits.size} commits."
  results = []
  commits.each_with_index do |commit, idx|
    if cache.key?(commit['hash'])
      puts "Using cached data for commit #{idx + 1}/#{commits.size}: #{commit['hash']}"
      results << cache[commit['hash']]
    else
      puts "Processing commit #{idx + 1}/#{commits.size}: #{commit['hash']}"
      res = process_commit(commit)
      if res
        results << res
        cache[commit['hash']] = res
      end
    end
  end

  # Write updated cache next to the script.
  File.write(cache_file, JSON.pretty_generate(cache))
  puts "Cache updated."

  html_content = generate_html(results)
  output_path = File.join(Dir.pwd, "~git-sloc-history.html")
  File.write(output_path, html_content)
  puts "Visualization generated: #{output_path}"
end

begin
  main
rescue => e
  warn "Error: #{e}"
  exit 1
end
