#!/usr/bin/env ruby
# frozen_string_literal: true

require 'fileutils'

ROOT = File.join(__dir__, '..', 'lib')

# Detect the line delimiter from the existing lib/namespace.ts (defaults to "\n")
def line_delimiter
  root_ns = File.join(ROOT, 'namespace.ts')
  return "\n" unless File.exist?(root_ns)

  content = File.read(root_ns)
  content.include?("\r\n") ? "\r\n" : "\n"
end

DELIM = line_delimiter

# Delete all existing namespace.ts files so outdated ones are removed.
Dir.glob(File.join(ROOT, '**', 'namespace.ts')).each { |f| File.delete(f) }

# Recursively generate namespace.ts for each directory under lib/
# Returns true if a namespace.ts was created for +dir+.
def generate(dir)
  entries = Dir.children(dir)
               .reject { |e| e.start_with?('.') }
               .sort

  subdirs = []
  files   = []

  entries.each do |name|
    path = File.join(dir, name)
    if File.directory?(path)
      subdirs << name if generate(path)
    elsif name.end_with?('.ts') &&
          name != 'namespace.ts' &&
          !name.end_with?('.test.ts') &&
          !name.end_with?('.config.ts')
      files << name
    end
  end

  exports = []
  subdirs.sort.each { |sd| exports << "export * from './#{sd}/namespace.ts';" }
  files.sort.each   { |fn| exports << "export * from './#{fn}';" }

  return false if exports.empty?

  File.write(File.join(dir, 'namespace.ts'), exports.join(DELIM) + DELIM)
  true
end

generate(ROOT)
