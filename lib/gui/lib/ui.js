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

async function ui_open_tabview(type) {
  let tab = document.createElement('x-doctab');

  let tabView = new type(tab);
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