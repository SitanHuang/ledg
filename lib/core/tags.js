 
function tag_add(entry, tag) {
  entry.tags = new Set(entry.tags ? entry.tags.toString().split(",") : undefined);
  entry.tags.add(tag.toUpperCase());
  entry.tags = Array.from(entry.tags).sort().join(",");
}

function tag_remove(entry, tag) {
  entry.tags = new Set(entry.tags ? entry.tags.toString().split(",") : undefined);
  entry.tags.delete(tag.toUpperCase());
  if (entry.tags.size)
    entry.tags = Array.from(new Set(entry.tags)).sort().join(",");
  else
    delete entry.tags;
}
