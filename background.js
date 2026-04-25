chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_HISTORY") {
    chrome.history.search(
      { text: "", maxResults: 5000 },
      (results) => {
        sendResponse(results);
      }
    );
    return true;
  }
});
