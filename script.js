function getHistory() {
  window.postMessage({ type: "GET_HISTORY" }, "*");
}

window.addEventListener("message", (event) => {
  if (event.data.type === "HISTORY_DATA") {
    document.getElementById("output").innerText =
      JSON.stringify(event.data.data.slice(0, 20), null, 2);
  }
});
