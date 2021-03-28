let notification = document.querySelector("#notification");
let doctabs = document.querySelector('x-doctabs');
let views = document.querySelector('views');

let tabViews = [];
let currentView;
let defaultTabView;

doctabs.addEventListener('open', async (e) => {
  e.preventDefault();
  ui_open_tabview(defaultTabView);
});

function ui_update_menu() {
  let $mbud = $('x-menuitem.budgets');
  let budgets = Object.keys(data.budgets);
  if (!budgets.length) $mbud.attr('disabled', 'disabled');
  else $mbud.removeAttr('disabled');
  $mbud.find('> x-menu > x-menuitem').each((i, val) => {
    console.log(val)
    let $t = $(val);
    $t.find('> x-menu').remove();
    let html = `<x-menu>`;
    budgets.forEach(x => {
      html += `<x-menuitem onclick='ui_open_tabview(PartitionBudget, { budget: ${escHtml(JSON.stringify(x))} })'><x-label>${escHtml(x)}</x-label></x-menuitem>`;
    });
    $t.append(html + `</x-menu>`);
  });
}

function escHtml(str) {
  return str
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;")
       .replace(/'/g, "&#039;");
}

async function ui_open_tabview(type, data) {
  let tab = document.createElement('x-doctab');

  let tabView = new type(tab, data);
  tab.tabView = tabView;
  tabViews.push(tabView);

  await doctabs.openTab(tab);
  await doctabs.selectTab(tab);
}

class TabView {
  constructor(tab) {
    this.tab = tab;
    this.view = document.createElement('view');
    this.view.style.display = "none";
    views.appendChild(this.view);

    this.updateContent();
  }

  get title() {
    return this.tab.innerText;
  }

  set title(t) {
    this.tab.innerText = t;
  }

  async updateContent() {
    this.view.innerHTML = '';
  }

  onShow() {
    this.view.style.display = "block";
    currentView = this;
  }

  onHide() {
    this.view.style.display = "none";
  }

  onClose() {
    this.view.remove();
  }
}