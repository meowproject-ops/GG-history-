window.addEventListener("message", (event) => {
  if (event.data.type === "GET_HISTORY") {
    chrome.runtime.sendMessage({ type: "GET_HISTORY" }, (data) => {
      window.postMessage({ type: "HISTORY_DATA", data }, "*");
    });
  }
});
