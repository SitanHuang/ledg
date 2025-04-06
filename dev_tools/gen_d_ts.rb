#!/usr/bin/env ruby
File.open("~combined.d.ts.ai","w") do |out|
  Dir.glob("types/**/*.d.ts").each do |f|
    next if f.match(/config|test|namespace/)
    out.puts "/// #{f.sub('types/', '').sub('.d.ts', '.ts')}"
    out.puts File.read(f).gsub('    ', '  ')
  end
end
