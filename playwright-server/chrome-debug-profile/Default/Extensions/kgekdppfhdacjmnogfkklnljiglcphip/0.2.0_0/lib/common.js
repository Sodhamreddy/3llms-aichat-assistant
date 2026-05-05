var core = {
  "start": function () {
    core.load();
  },
  "install": function () {
    core.load();
  },
  "load": function () {
    config.addon.state = {};
    app.button.icon(null, "OFF");
  },
  "action": {
    "storage": function (changes, namespace) {
      /*  */
    },
    "inject": function (tab) {
      app.tab.inject.js({"target": {"tabId": tab.id}, "files": ["/data/content_script/inject.js"]}, function () {
        app.tab.inject.css({"target": {"tabId": tab.id}, "files": ["/data/content_script/inject.css"]}, function () {
          /*  */
        });
      });
    },
    "button": function (tab) {
      const state = config.addon.state;
      state[tab.id] = state[tab.id] === "ON" ? "OFF" : "ON";
      config.addon.state = state;
      /*  */
      core.action.inject(tab);
      app.button.icon(tab.id, state[tab.id]);
    },
    "tab": function (info, tab) {
      if (tab.active) {
        if (info.status === "loading") {
          const state = config.addon.state;
          state[tab.id] = "OFF";
          config.addon.state = state;
          /*  */
          app.button.icon(tab.id, state[tab.id]);
        }
      }
    },
    "page": {
      "font": function (e) {        
        app.page.send("result", e.font, e.tabId, e.frameId);
      },
      "load": function (e) {        
        const state = config.addon.state;
        app.page.send("storage", {"state": state[e.tabId]}, e.tabId, e.frameId);
      },
      "store": function (e) {        
        const state = config.addon.state;
        state[e.tabId] = e.state;
        config.addon.state = state;
        /*  */
        core.action.page.load(e);
        app.button.icon(e.tabId, state[e.tabId]);
      }
    }
  }
};

app.tab.on.updated(core.action.tab);
app.button.on.clicked(core.action.button);

app.page.receive("load", core.action.page.load);
app.page.receive("font", core.action.page.font);
app.page.receive("store", core.action.page.store);

app.on.startup(core.start);
app.on.installed(core.install);
app.on.storage(core.action.storage);
