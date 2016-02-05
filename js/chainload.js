(function() {
  "use strict";

  function verifyAppData(appdata) {
    console.log("Verifying app data...");
    // XXX do some actual verification here
    return Promise.reject(new Error("Could not verify app data"));
  }
  function loadApp(fileList) {
    var styles = fileList.styles;
    var scripts = fileList.scripts;
    //XXX de-dup code in the script/style blocks here :<
    for (var script of scripts) {
      var el = document.createElement("script");
      if (script.async) { el.async = true };
      if (script.defer) { el.defer = true };
      if (script.integrity) {
        el.integrity = script.integrity;
      } else {
        console.warn("Could not find integrity value for ", script);
      }
      el.src = script.src;
      document.head.appendChild(el); //XXX batch DOM access
    }
    for (var style of styles) {
      var el = document.createElement("link");
      el.rel = "stylesheet";
      el.type = "text/css";
      if (style.integrity) {
        el.integrity = style.integrity;
      } else {
        console.warn("Could not find integrity value for ", style);
      }
      el.href = style.href;
      document.head.appendChild(el); //XXX batch DOM access
    }
  }

  function validateURLParams(s,p) {
    return new Promise(function(resolve, reject) {
      console.log(s, p);
      if (!s || !p) {
        reject(new Error("Couldn't find Start URL and public keys"));
      }
      try {
        var url = new URL(s, document.baseURI);
        if (!url.protocol.startsWith("http")) {
          reject(new Error("Start URL must be http or https"));
        }
        //XXX verify public keys to make sure it's not a no-op
        //Hint: p is an array.
        resolve(s, p);
      }
      catch(e) {
        reject(e); // TypeError … is not a valid URL
      }
    });

  }

  var params = new URLSearchParams(location.search.slice(1));
  var p_startURL = params.get("start");
  var p_pubKeys = params.getAll("pubkey");
  validateURLParams(p_startURL, p_pubKeys).then((startURL, pubKeys) => {
    console.log("Identified a starting point. Fetching", startURL);
    fetch(startURL)
      .then(r => r.json())
      .catch(err => {
        console.error("Could not initialize web app. Missing initialization" +
          " data.", err)
      })
      .then(ad => verifyAppData(ad, pubKeys))
      .catch(err => {
        throw err;
      })
      .then(files => loadApp(files));
  });
})();
