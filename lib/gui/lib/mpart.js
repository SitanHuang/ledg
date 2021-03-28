function reload_disk_panel(disk, i) {
  let _d = i == -1 ? '_selectedPartition' : `disks[${i}]`;
  let html = `<disk>
  <h3 style="margin: 0">
    ${i == -1 ? "<button onclick=\"_selectedPartition=null;update_ui()\">X</button>" : ""}
    <input value="${disk.label}" onchange="${_d}.label=this.value.trim();update_ui()">
    ${disk.size} total
  </h3><br>
  <table class="partition root"><tr>`;

  html += graph_partition(disk);
  if (disk.unallocated > 0.1) {
    let title = `Unallocated (${Math.round(disk.unallocated / disk.size * 10000)/100}%, ${format_size(disk.unallocated)})`;
    html += `<td class="partition" style="width: ${disk.unallocated / disk.size * 100}%">
    <table class="partition unallocated" onclick="add_partition(${i == -1 ? `window._selectedPartition` : `disks[${i}]`})" title="${title}"><tr><td>
    <span>${title}</span>
    </td></tr></table>
    </td>`;
  }

  html += `</tr></table></disk>`;
  return html;
}

function graph_partition(part) {
  let html = '';
  part.partitions.forEach(p => {
    partitionsDrew.push(part);
    partitionsDrew.push(p);
    let title = `${p.label} (${Math.round(p.size / part.size * 10000)/100}%, ${format_size(p.size)})`;
    html += `<td
      oncontextmenu="partition_delete(partitionsDrew[${partitionsDrew.length - 2}], partitionsDrew[${partitionsDrew.length - 1}]); return false;"
      onclick="partition_onclick(this, partitionsDrew[${partitionsDrew.length - 1}])"
      style="width: ${p.size / part.size * 100}%;">
      <table class="partition" style="background: ${p.color}" title="${title}"><tr>`;
    html += graph_partition(p);
    if (p.unallocated > 0.1 && p.partitions.length) {
      let title = `Unallocated (${Math.round(p.unallocated / p.size * 10000)/100}%, ${format_size(p.unallocated)})`;
      html += `<td class="partition" style="width: ${p.unallocated / p.size * 100}%">
      <table class="partition unallocated" onclick="add_partition(partitionsDrew[${partitionsDrew.length - 1}])" title="${title}"><tr><td>
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