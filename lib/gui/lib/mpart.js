function reload_disk_panel(disk, i) {
  let _d = i == -1 ? '_selectedPartition' : `disks[${i}]`;
  let html = `<disk>
  <h5 style="margin: 0">
    ${disk.label} -
    ${disk.size} total
  </h5><br>
  <table class="partition root"><tr>`;

  html += graph_partition(disk);
  if (disk.unallocated > 0.1) {
    let title = `Unallocated (${Math.round(disk.unallocated / disk.size * 10000)/100}%, ${format_size(disk.unallocated)})`;
    html += `<td class="partition" style="width: ${disk.unallocated / disk.size * 100}%">
    <table class="partition unallocated" title="${title}"><tr><td>
    <span>${title}</span>
    </td></tr></table>
    </td>`;
  }

  html += `</tr></table></disk>`;
  return html;
}

function format_size(s) {
  return (Math.round(s * 1) / 1)
}

function graph_partition(part) {
  let html = '';
  part.partitions.forEach(p => {
    let title = `${p.label} (${Math.round(p.size / part.size * 10000)/100}%, ${format_size(p.size)})`;
    html += `<td style="width: ${p.size / part.size * 100}%;">
      <table class="partition" style="background: ${p.color}" title="${title}"><tr>`;
    html += graph_partition(p);
    if (p.unallocated > 0.1 && p.partitions.length) {
      let title = `Unallocated (${Math.round(p.unallocated / p.size * 10000)/100}%, ${format_size(p.unallocated)})`;
      html += `<td class="partition" style="width: ${p.unallocated / p.size * 100}%">
      <table class="partition unallocated" title="${title}"><tr><td>
      <span>${title}</span>
      </td></tr></table>
      </td>`;
    }
    if (!p.partitions.length) html += `<td><span>${title}</span></td>`;
    else html += `</tr><tr><td colspan=${p.partitions.length}><span>${title}</span></td>`
    html += '</tr></table></td>';
  });
  return html;
}