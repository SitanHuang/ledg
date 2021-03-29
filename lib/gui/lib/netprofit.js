class NetprofitView extends QueryView {
  constructor(tab) {
    super(tab);
    this.title = 'Net Profit';
  }

  resetDefaultQueries() {
    super.resetDefaultQueries();
    this.dataSets = '"inc*" --name="Income" --collect=sum --skip-book-close\n' +
                    '"exp*" --name="Expenses" --collect=sum --skip-book-close\n' +
                    '"inc*|exp*" --name="Net Profit" --collect=sum --skip-book-close\n';
  }

  async updateContent() {
    await super.updateContent();
    await this.updateQueryContent();
    await this.submitQuery();
    await this.execIntervalQuery();

    let data = this._data;
    let _d = this._d = [];
    FOR: for (let i = 0;i < data.length;i += this._argQueries.length) {
      for (let j = 0;j < this._argQueries.length;j++) {
        let row = { date: this._query.queries[i].to * 1000 };
        row.label = this._argQueries[j].flags.name;
        row.sum = -data[i + j].sum;
        _d.push(row);
      }
    }
    this.graphs.appendChild(await vegaEmbed(this.spec = {
      "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
      "description": "Stock sums of 5 Tech Companies over Time.",
      "height": window.innerHeight*0.75|0,
      "width": window.innerWidth*0.75|0,
      "data": { "values": _d },
      "layer": [
        {
          "encoding": {
            "x": {"field": "date", "type": "temporal"},
            "y": {"field": "sum", "type": "quantitative"},
            "color": {"field": "label", "type": "nominal"}
          },
          "layer": [
            {"mark": "line"},
            {
              "params": [{
                "name": "label",
                "select": {
                  "type": "point",
                  "encodings": ["x"],
                  "nearest": true,
                  "on": "mouseover"
                }
              }],
              "mark": "point",
              "encoding": {
                "opacity": {
                  "condition": {
                    "param": "label",
                    "empty": false,
                    "value": 1
                  },
                  "value": 0
                }
              }
            }
          ]
        },
        {
          "transform": [{"filter": {"param": "label", "empty": false}}],
          "layer": [
            {
              "mark": {"type": "rule", "color": "gray"},
              "encoding": {
                "x": {"type": "temporal", "field": "date", "aggregate": "min"}
              }
            },
            {
              "encoding": {
                "text": {"type": "quantitative", "field": "sum"},
                "x": {"type": "temporal", "field": "date"},
                "y": {"type": "quantitative", "field": "sum"}
              },
              "layer": [
                {
                  "mark": {
                    "type": "text",
                    "stroke": "white",
                    "strokeWidth": 2,
                    "align": "left",
                    "dx": 5,
                    "dy": -5
                  }
                },
                {
                  "mark": {"type": "text", "align": "left", "dx": 5, "dy": -5},
                  "encoding": {
                    "color": {"type": "nominal", "field": "label"}
                  }
                }
              ]
            }
          ]}],
      "config": {"view": {"stroke": null}}
    }));
  }
}