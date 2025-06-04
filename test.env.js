globalThis.$task = { fetch: globalThis.fetch.bind(globalThis) };

globalThis.$done = (result) => {
  if (result && typeof result === "object") {
    console.log("Done:", JSON.stringify(result, null, 2));
  } else {
    console.log("Done:", result);
  }
};

globalThis.$notify = (title, subTitle, desc, options) => {
  console.log("Notify:", { title, subTitle, desc, options });
};

globalThis.$prefs = {
  valueForKey: (key) => {
    return globalThis[key];
  },
  setValueForKey: (value, key) => {
    globalThis[key] = value;
    return true;
  },
};
