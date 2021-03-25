class QueryView extends TabView {
  constructor(tab) {
    super(tab);

    this._accordionOpened = false;

    this.dataSets = "";

    this.resetDefaultQueries();
  }

  async updateContent() {
    await super.updateContent();
    let graphs = this.graphs = document.createElement('div');
    graphs.className = 'graphs';
    this.view.appendChild(graphs);
  }

  resetDefaultQueries() {
    this.max = new Date(CMD_MODIFER_REPLACE['@max']() * 1000);

    this.from = this.min = new Date(CMD_MODIFER_REPLACE['@min']() * 1000);
    this.to = new Date(CMD_MODIFER_REPLACE['@tomorrow']() * 1000);

    this.interval = "--daily";
    this.toggles = {};
    this.arguments = "";
  }

  _toISO(date) {
    return date.toISOString().split('T')[0];
  }

  parseArgQueries() {
    return this._argQueries = this.dataSets.replace(/\r/g, '').split("\n").map(x => {
      x = x.trim();
      if (!x.length) return null;
      let args2 = argsparser(parseArgSegmentsFromStr(x));
      report_extract_account(args2);
      args2._collect_concat = (args2.flags.collect || 'sum').split(",");
      return args2;
    }).filter(x => !!x);
  }

  async submitQuery() {
    if (!this.form.reportValidity()) return false;

    let argQueries = this.parseArgQueries();
    let args = this._generalArgs = argsparser(parseArgSegmentsFromStr(this.arguments + ' ' + this.interval));

    this._query = {
      cumulative: this.toggles.cumulative && argQueries.length,
      queries: [],
      from: this.from / 1000 | 0,
      to: this.to / 1000 | 0,
      mergeTemplate: (args2) => {
        let q = query_args_to_filter(args);
        q.flags['skip-book-close'] = q.flags['skip-book-close'] !== false;
        Object.assign(q.flags, args2.flags);
        q.accounts = q.accounts.concat(args2.accounts || []);
        Object.assign(q.modifiers, args2.modifiers);
        q.collect = args2._collect_concat;
        Object.assign(q, args2);
        return q;
      }
    };
  }

  async execIntervalQuery() {
    let argQueries = this._argQueries;
    let args = this._generalArgs;
    let query = this._query;
    let int = report_get_reporting_interval(args);

    let crntD = new Date(query.from * 1000);
    while (crntD < this.to) {
      let a = crntD.getTime() / 1000 | 0;
      crntD.setFullYear(crntD.getFullYear() + int[0]);
      crntD.setMonth(crntD.getMonth() + int[1]);
      crntD.setDate(crntD.getDate() + int[2]);
      let b = Math.min(crntD.getTime(), this.to) / 1000 | 0;

      for (let i = 0;i < argQueries.length;i++) {
        let q = query.mergeTemplate(argQueries[i]);
        q.from = a;
        q.to = b;
        query.queries.push(q);
      }
    }

    this._data = await query_exec(query);
  }

  async updateQueryContent() {
    let queryView = this.queryView = document.createElement('div');
    let that = this;
    queryView.className = 'query';

    queryView.innerHTML = `
    <form post="#" onsubmit="return false">
      <main>
        <x-button style="display: inline-block" onclick="currentView.updateContent();">
          <x-box>
            <x-label>Update</x-label>
          </x-box>
        </x-button>
        <x-button style="display: inline-block;" onclick="currentView._accordionOpened = currentView.accordion.expanded;currentView.resetDefaultQueries();currentView.updateContent()">
          <x-box>
            <x-label>Reset</x-label>
          </x-box>
        </x-button>
      </main>
      <x-card style="margin-top: 10px;">
        <main>
          <x-box>
            <x-dateselect class="from" required min="${this._toISO(this.min)}" max=${this._toISO(this.to)} value="${this._toISO(this.from)}"></x-dateselect>
            <strong>Reporting range</strong>
            <x-dateselect class="to" required min="${this._toISO(this.from)}" max=${this._toISO(this.max)} value="${this._toISO(this.to)}"></x-dateselect>
          </x-box>
        </main>
      </x-card>
      <x-card>
        <main>
          <x-box>
            <strong>Step interval</strong>
            <x-select class="interval">
              <x-menu>
                <x-menuitem value="">
                  <x-label>Auto</x-label>
                </x-menuitem>

                <x-menuitem value="--yearly">
                  <x-label>Yearly</x-label>
                </x-menuitem>

                <x-menuitem value="--quarterly">
                  <x-label>Quarterly</x-label>
                </x-menuitem>

                <x-menuitem value="--monthly">
                  <x-label>Monthly</x-label>
                </x-menuitem>

                <x-menuitem value="--biweekly">
                  <x-label>Biweekly</x-label>
                </x-menuitem>

                <x-menuitem value="--weekly">
                  <x-label>Weekly</x-label>
                </x-menuitem>

                <x-menuitem value="--daily" toggled>
                  <x-label>Daily</x-label>
                </x-menuitem>
              </x-menu>
            </x-select>
          </x-box>
        </main>
      </x-card>
      <x-accordion ${this._accordionOpened ? 'expanded' : ''}>
        <header>
          <x-label>Advanced</x-label>
        </header>
        <main>
          <x-card>
          <main>
              <x-box>
                <div style="width: 100%">
                  <strong>Datasets</strong>
                  Separated by newline,<br>
                  use --name=" ... " to indicate dataset label
                </div>
                <x-textarea class="dataSets"></x-textarea>
              </x-box>
            </main>
          </x-card>
          <x-card>
            <main>
              <x-box>
                <strong>Absolute value</strong><x-switch class="abs" ${this.toggles.abs ? 'toggled' : ''}></x-switch>
              </x-box>
            </main>
            <main>
              <x-box>
                <strong>Cumulative</strong><x-switch class="cumulative" ${this.toggles.cumulative ? 'toggled' : ''}></x-switch>
              </x-box>
            </main>
            <main>
              <x-box>
                <strong>Additional Arguments</strong>
                <x-textarea class="modifiers"></x-textarea>
              </x-box>
            </main>
          </x-card>
        </main>
      </x-accordion>
    </form>
    `;

    let form = this.form = queryView.querySelector('form');
    this.accordion = queryView.querySelector('x-accordion');

    queryView.querySelectorAll('.from').forEach(x => {
      x.addEventListener('change', () => {
        if (!x.value) x.value = that._toISO(that.min);
        that.from = new Date(Date.parse(x.value + 'T00:00:00'));
        form.reportValidity();
      });
    });
    queryView.querySelectorAll('.to').forEach(x => {
      x.addEventListener('change', () => {
        if (!x.value) x.value = that._toISO(that.max);
        that.to = new Date(Date.parse(x.value + 'T00:00:00'));
        form.reportValidity();
      });
    });

    queryView.querySelectorAll('.cumulative, .abs').forEach(x => {
      x.addEventListener('toggle', () => {
        if (x.toggled) that.toggles[x.className] = 1;
        else delete that.toggles[x.className];
      });
    });

    queryView.querySelector('.interval').addEventListener('change', e => {
      that.interval = e.target.value;
    });

    let dataSets = queryView.querySelector('.dataSets');
    dataSets.value = that.dataSets;
    dataSets.addEventListener('change', e => {
      that.dataSets = e.target.value;
    });

    let modifiers = queryView.querySelector('.modifiers');
    modifiers.value = "--skip-book-close=true";
    modifiers.addEventListener('change', e => {
      that.arguments = e.target.value;
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      that.submitQuery();
      return false;
    });

    this.view.appendChild(queryView);
  }
}