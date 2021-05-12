#!/usr/bin/env ruby

# This script should only be used when we enter 1.0!

latest_tag = `git describe --abbrev=0 --tags`.strip
throw latest_tag unless $?.exitstatus == 0

lines_changed = `git diff --shortstat #{latest_tag}`
throw lines_changed unless $?.exitstatus == 0
lines_changed = lines_changed.scan(/\d+/).map { |x| x.to_i }
$lines = lines_changed.sum

commits = `git log #{latest_tag}..HEAD --oneline`
throw commits unless $?.exitstatus == 0
$breaking = commits.scan('breaking:').size

$feat = commits.scan('feat:').size
$change = commits.scan('change:').size
$fix = commits.scan('fix:').size

$mod = $feat + $change + $fix

class String
  def colorize(color_code)
    "\e[#{color_code}m#{self}\e[0m"
  end

  def red
    colorize(31)
  end

  def green
    colorize(32)
  end
end

def bump_to? name, breaking: 0, feat: 0, change: 0, fix: 0, lines: 0, mod: 0, noadd: false
  puts "#{name}: "
  if breaking == 0
  elsif $breaking >= breaking
    puts "  breaking changes(#{$breaking} #{">".green} #{breaking})"
  else
    puts "  breaking changes(#{$breaking} #{">".red} #{breaking})"
  end
  if mod == 0
  elsif $mod >= mod
    puts "  feat/fix/chng(#{$mod} #{">".green} #{mod})"
  else
    puts "  feat/fix/chng(#{$mod} #{">".red} #{mod})"
  end
  if !noadd
  elsif $feat > 0
    puts "  features(#{$feat} #{"=".red} #{feat})"
  else
    puts "  features(#{$feat} #{"=".green} #{feat})"
  end
  if change == 0
  elsif $change >= change
    puts "  changes(#{$change} #{">".green} #{change})"
  else
    puts "  changes(#{$change} #{">".red} #{change})"
  end
  if feat == 0
  elsif $feat >= feat
    puts "  features(#{$feat} #{">".green} #{feat})"
  else
    puts "  features(#{$feat} #{">".red} #{feat})"
  end
  if fix == 0
  elsif $fix >= fix
    puts "  fixes(#{$fix} #{">".green} #{fix})"
  else
    puts "  fixes(#{$fix} #{">".red} #{fix})"
  end
  if lines == 0
  elsif $lines >= lines
    puts "  lines(#{$lines} #{">".green} #{lines})"
  else
    puts "  lines(#{$lines} #{">".red} #{lines})"
  end
end

bump_to?(
  "Major",
  mod: 10,
  breaking: 1
)

bump_to?(
  "Minor",
  mod: 10,
  feat: 3,
  lines: 1500
)

bump_to?(
  "Patch",
  noadd: true,
  mod: 10,
  fix: 1,
  lines: 700
)
