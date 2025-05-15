#!/usr/bin/env ruby
(ARGV.size == 1 ? Dir.glob(ARGV[0]) : ARGV).each do |f|
  next if f.match(/(\.(config|test)\.)|namespace/)
  puts "/// #{f.sub('lib/', '')}"
  puts File.read(f)
end
