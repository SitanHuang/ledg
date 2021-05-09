#!/usr/bin/env ruby
require 'time'
require 'optparse'

version = nil
opts_parser = OptionParser.new do |opts|
  opts.banner = "Usage: bump_version.rb [options]"

  opts.on("-v", "--version VERSION",
          "The VERSION to bump to in Maj.Min.Pat format.") do |v|
    version = v.strip
  end
end
opts_parser.parse!

unless version and version.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/)
  puts opts_parser.help
  exit 1
end

print 'git repo check: '
if `git branch --list master`.empty?
  puts 'master branch not found!'
  exit 1
end
unless `git name-rev --name-only HEAD`.strip == 'develop'
  puts 'Not on develop branch!'
  exit 1
end
unless `git status --porcelain`.empty?
  puts 'Repo is not clean!'
  exit 1
end
puts 'OK'


print 'make test: '
output = `make test`
unless output['passing'] and !output['Error '] and $?.exitstatus == 0
  puts 'Failed!'
  exit 1
end
puts 'OK'

print 'Update version.js: '
unless `sed -E "s/version [^']+'/version #{version}'/g" lib/cli/commands/version.js -i`.empty?
  puts 'Failed!'
  exit 1
end
puts 'OK'

print 'Update ChangeLog.md: '
unless `sed -E 's/\\[unreleased\\]/[#{version}] #{Date.today.iso8601}/gi' ChangeLog.md -i`.empty?
  puts 'Failed!'
  exit 1
end
puts 'OK'

def try_exec cmd
  puts cmd
  exit 1 unless system cmd
end

try_exec "git add -A"
try_exec "git commit -m 'bump to v#{version}'"

try_exec "git checkout master"
try_exec "git merge develop --no-ff -m \"v#{version}; Merge branch 'develop'\""

try_exec "git tag -a v#{version} -m 'Release Version #{version}'"
try_exec "git checkout develop"
try_exec "git reset --hard master"
